import { NextResponse } from "next/server";
import client from "@/lib/mongodb";
import jwt from "jsonwebtoken";
import { getAuthToken, getRefreshToken } from "@/lib/auth";

const JWT_SECRET = process.env.JWT_SECRET || "";

export async function GET() {
  try {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) {
      return NextResponse.json(
        { valid: false, error: "No refresh token found" },
        { status: 401 },
      );
    }

    // Verify JWT signature and expiry
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, JWT_SECRET);
    } catch (err) {
      return NextResponse.json(
        { valid: false, error: "Invalid or expired refresh token" },
        { status: 401 },
      );
    }

    // Check if the refresh token exists in the database
    await client.connect();
    const db = client.db();
    const refreshTokens = db.collection("RefreshTokens");
    const doc = await refreshTokens.findOne({ token: refreshToken });
    if (!doc) {
      return NextResponse.json(
        { valid: false, error: "Refresh token not found in database" },
        { status: 401 },
      );
    }

    // Check DB-level expiry
    if (doc.expiresAt && new Date(doc.expiresAt) < new Date()) {
      return NextResponse.json(
        { valid: false, error: "Refresh token expired" },
        { status: 401 },
      );
    }

    // Validate access token
    const authToken = await getAuthToken();
    if (!authToken) {
      return NextResponse.json(
        { valid: false, error: "No access token found" },
        { status: 401 },
      );
    }

    let authDecoded: jwt.JwtPayload;
    try {
      authDecoded = jwt.verify(authToken, JWT_SECRET) as jwt.JwtPayload;
    } catch {
      return NextResponse.json(
        { valid: false, error: "Access token invalid or expired" },
        { status: 401 },
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresIn = authDecoded.exp ? authDecoded.exp - now : 0;

    return NextResponse.json({
      valid: true,
      userId: doc.userId,
      expiresIn, // seconds remaining until access token expires
    });
  } catch (err) {
    return NextResponse.json(
      { valid: false, error: "Server error" },
      { status: 500 },
    );
  }
}
