import { NextResponse } from "next/server";
import client from "@/lib/mongodb";
import jwt from "jsonwebtoken";
import { getAuthToken, getRefreshToken } from "@/lib/auth";
import mongoService from "@/lib/MongoService";
import { generateCsrfToken } from "@/lib/csrf";
import { ObjectId } from "mongodb";

const JWT_SECRET = process.env.JWT_SECRET || "";

function errorResponse(error: string, status: number = 401) {
  const response = NextResponse.json({ valid: false, error }, { status });
  response.cookies.set("token", "", {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function GET() {
  try {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) {
      return errorResponse("No refresh token found");
    }

    // Verify JWT signature and expiry
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, JWT_SECRET);
    } catch (err) {
      return errorResponse("Invalid or expired refresh token");
    }

    // Check if the refresh token exists in the database
    await client.connect();
    const db = client.db();
    const refreshTokens = db.collection("RefreshTokens");
    const doc = await refreshTokens.findOne({ token: refreshToken });
    if (!doc) {
      return errorResponse("Refresh token not found in database");
    }

    // Check DB-level expiry
    if (doc.expiresAt && new Date(doc.expiresAt) < new Date()) {
      return errorResponse("Refresh token expired");
    }

    // Validate access token
    const authToken = await getAuthToken();
    if (!authToken) {
      return errorResponse("No access token found");
    }

    let authDecoded: jwt.JwtPayload;
    try {
      authDecoded = jwt.verify(authToken, JWT_SECRET) as jwt.JwtPayload;
    } catch {
      return errorResponse("Access token invalid or expired");
    }
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = authDecoded.exp ? authDecoded.exp - now : 0;

    // Get session by sessionId from JWT
    const sessionId = authDecoded.sid;
    console.log("Decoded access token:");
    console.log(authDecoded);
    let session = null;
    if (sessionId) {
      session = await mongoService.getSessionById(new ObjectId(sessionId));
    } else {
      return errorResponse("Session ID missing in access token");
    }

    if (!session || session.revoked) {
      return errorResponse("Session revoked or not found");
    }

    return NextResponse.json({
      valid: true,
      userId: doc.userId,
      expiresIn,
    });
  } catch (err) {
    return errorResponse("Server error", 500);
  }
}
