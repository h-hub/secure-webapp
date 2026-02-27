import { NextRequest, NextResponse } from "next/server";
import mongoService from "@/lib/MongoService";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { generateCsrfToken } from "@/lib/csrf";

const JWT_SECRET = process.env.JWT_SECRET || "";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password required" },
        { status: 400 },
      );
    }

    const user = await mongoService.findUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    // Collect user-agent and IP from the request
    const userAgent = req.headers.get("user-agent") || "unknown";
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    // Save a new session and get the session ID
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

    const token = jwt.sign(
      { id: user._id, email: user.email, sid: sessionId },
      JWT_SECRET,
      {
        expiresIn: `${sessionExpiryMinutes}m`,
      },
    );

    const refreshTokenExpiryMinutes = parseInt(
      process.env.REFRESH_TOKEN_EXPIRY_MINUTES || "10080", // 7 days in minutes
      10,
    );

    const refreshToken = jwt.sign(
      { id: user._id, email: user.email, type: "refresh", sessionId },
      JWT_SECRET,
      { expiresIn: `${refreshTokenExpiryMinutes}m` },
    );

    await mongoService.upsertRefreshToken(
      user._id,
      refreshToken,
      userAgent,
      ipAddress,
    );

    const response = NextResponse.json({
      success: true,
      newCsrfToken,
    });
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: sessionExpiryMinutes * 60, // session expiry in seconds
    });
    response.cookies.set("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: refreshTokenExpiryMinutes * 60, // refresh token expiry in seconds
    });
    return response;
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
