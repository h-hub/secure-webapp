import { NextRequest, NextResponse } from "next/server";
import client from "@/lib/mongodb";
import { sendSignUpConfirmationEmail } from "@/lib/email";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { password, email } = await req.json();
    if (!password || !email) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    await client.connect();
    const db = client.db();
    const users = db.collection("Users");

    // Check if user already exists
    const existing = await users.findOne({ email });
    if (existing) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 409 },
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const result = await users.insertOne({
      email,
      password: hashedPassword,
      createdAt: new Date(),
    });

    // Send confirmation email
    // await sendSignUpConfirmationEmail(email);

    return NextResponse.json(
      { message: "Sign up successful" },
      { status: 201 },
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  } finally {
    // Do not close client for serverless
  }
}
