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

    // Extract CSRF token from request headers
    const csrfToken = request.headers.get("x-csrf-token");

    await client.connect();
    const db = client.db();
    const sessions = db.collection("Sessions");
    // Check session by session id in JWT token
    if (!decoded.sid) {
      return NextResponse.json(
        { message: "Session ID missing in token" },
        { status: 401 },
      );
    }
    const session = await sessions.findOne({
      _id: new ObjectId(decoded.sid),
    });
    if (!session || session.revoked) {
      return NextResponse.json(
        { message: "Invalid or expired session" },
        { status: 401 },
      );
    }

    // Validate CSRF token against session in DB
    if (!csrfToken || session.csrfToken !== csrfToken) {
      return NextResponse.json(
        { message: "Invalid CSRF token" },
        { status: 403 },
      );
    }

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
    throw error;
    // Optionally, you can keep the error response below if you want to return JSON as well:
    // return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
