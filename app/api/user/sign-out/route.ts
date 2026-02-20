import { NextResponse } from "next/server";
import client from "@/lib/mongodb";
import { getRefreshToken } from "@/lib/auth";
import jwt from "jsonwebtoken";
import { RefreshJWTPayload } from "@/model/jwt";
import { ObjectId } from "mongodb";

const JWT_SECRET = process.env.JWT_SECRET || "";

export async function POST() {
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

    await client.connect();
    const db = client.db();
    const refreshTokens = db.collection("RefreshTokens");
    await refreshTokens.deleteOne({ userId: new ObjectId(decoded.id) });

    const response = NextResponse.json({ success: true });
    response.cookies.set("token", "", {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });
    response.cookies.set("refreshToken", "", {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
