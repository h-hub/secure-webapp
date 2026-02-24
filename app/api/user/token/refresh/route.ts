import { NextResponse } from "next/server";
import mongoService from "@/lib/MongoService";
import jwt from "jsonwebtoken";
import { getRefreshToken } from "@/lib/auth";
import { RefreshJWTPayload } from "@/model/jwt";
import { ObjectId } from "mongodb";

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

    const doc = await mongoService.findRefreshTokenByUserId(
      new ObjectId(decoded.id),
    );
    if (!doc) {
      return NextResponse.json(
        { error: "Invalid refresh token" },
        { status: 401 },
      );
    }

    if (doc.expiresAt && new Date(doc.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: "Refresh token expired" },
        { status: 401 },
      );
    }

    // Generate new JWT
    const newToken = jwt.sign({ id: doc.userId }, JWT_SECRET, {
      expiresIn: "1h",
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set("token", newToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 1, // 1 minute
    });

    return response;
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
