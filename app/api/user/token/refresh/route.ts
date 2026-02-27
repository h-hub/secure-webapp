import { NextResponse } from "next/server";
import mongoService from "@/lib/MongoService";
import jwt from "jsonwebtoken";
import { getRefreshToken } from "@/lib/auth";
import { RefreshJWTPayload } from "@/model/jwt";
import { ObjectId } from "mongodb";
import { generateCsrfToken } from "@/lib/csrf";
import { use } from "react";

const JWT_SECRET = process.env.JWT_SECRET || "";

export async function GET(req: Request) {
  try {
    const refreshTokenValue = await getRefreshToken();
    if (!refreshTokenValue) {
      return NextResponse.json(
        { error: "Missing refreshToken" },
        { status: 400 },
      );
    }

    const decoded = jwt.verify(
      refreshTokenValue,
      JWT_SECRET,
    ) as RefreshJWTPayload;

    const refreshToken = await mongoService.findRefreshTokenByUserId(
      new ObjectId(decoded.id),
    );
    if (!refreshToken) {
      return NextResponse.json(
        { error: "Invalid refresh token" },
        { status: 401 },
      );
    }

    if (
      refreshToken.expiresAt &&
      new Date(refreshToken.expiresAt) < new Date()
    ) {
      return NextResponse.json(
        { error: "Refresh token expired" },
        { status: 401 },
      );
    }

    const user = await mongoService.findUserById(new ObjectId(decoded.id));
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userAgent = req.headers.get("user-agent") || "unknown";
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    await mongoService.revokeSession(user._id, userAgent, ipAddress);

    const newCsrfToken = generateCsrfToken();

    // Set session and JWT expiry in minutes
    const sessionExpiryMinutes = parseInt(
      process.env.SESSIONEXPIRY_MINUTES || "60",
      10,
    );
    const sessionExpiryMs = sessionExpiryMinutes * 60 * 1000;

    const sessionId = await mongoService.saveSession(
      user._id,
      userAgent,
      ipAddress,
      newCsrfToken,
      sessionExpiryMs,
    );

    const newToken = jwt.sign(
      { id: user._id, email: user.email, sid: sessionId },
      JWT_SECRET,
      {
        expiresIn: `${sessionExpiryMinutes}m`,
      },
    );

    const response = NextResponse.json({ success: true, newCsrfToken });
    response.cookies.set("token", newToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: sessionExpiryMinutes * 60, // session expiry in seconds
    });

    return response;
  } catch (err) {
    console.error("[refresh token] Exception:", err);
    throw err;
    // Optionally, you can keep the error response below if you want to return JSON as well:
    // return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
