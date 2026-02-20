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

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, {
      expiresIn: "1m",
    });

    const refreshToken = jwt.sign(
      { id: user._id, email: user.email, type: "refresh" },
      JWT_SECRET,
      { expiresIn: "7d" },
    );

    // Collect user-agent and IP from the request
    const userAgent = req.headers.get("user-agent") || "unknown";
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    await mongoService.upsertRefreshToken(
      user._id,
      refreshToken,
      userAgent,
      ipAddress,
    );

    // Generate a new CSRF token for the authenticated session
    const newCsrfToken = generateCsrfToken();

    const response = NextResponse.json({
      success: true,
      newCsrfToken,
    });
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 1, // 1 minute
    });
    response.cookies.set("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    return response;
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
