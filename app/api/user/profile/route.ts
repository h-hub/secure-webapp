import { NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth";
import jwt from "jsonwebtoken";
import client from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import User from "@/model/user";
import { JWTPayload } from "@/model/jwt";
const JWT_SECRET = process.env.JWT_SECRET || "";

export async function GET(request: Request) {
  try {
    const token = await getAuthToken();
    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    await client.connect();
    const db = client.db();
    const users = db.collection("Users");
    const user = await users.findOne<User>({ _id: new ObjectId(decoded.id) });
    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }
    return NextResponse.json({
      id: user._id,
      email: user.email,
    });
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to fetch user details" },
      { status: 500 },
    );
  }
}
