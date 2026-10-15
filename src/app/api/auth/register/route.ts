import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, role } = await req.json();

    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { message: "All fields (name, email, password, role) are required" },
        { status: 400 }
      );
    }

    // Role validation
    const validRoles = ["recruiter", "candidate"];
    if (!validRoles.includes(role.toLowerCase())) {
      return NextResponse.json(
        { message: "Only recruiter and candidate roles are publicly registrable." },
        { status: 400 }
      );
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: "A user with this email address already exists." },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email: email.trim().toLowerCase(),
        passwordHash,
        role: role.toLowerCase(),
      },
    });

    // If candidate registered, optionally pre-create a skeleton Candidate record
    if (user.role === "candidate") {
      await prisma.candidate.create({
        data: {
          userId: user.id,
          candidateId: `CAND_${Math.floor(1000000 + Math.random() * 9000000)}`,
          name: user.name,
          email: user.email,
          rawResumeText: "",
          headline: "Candidate Profile",
          summary: "Awaiting resume import and profile setup.",
        },
      });
    }

    return NextResponse.json(
      { 
        message: "Registration successful", 
        user: { id: user.id, name: user.name, email: user.email, role: user.role } 
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Registration Error:", error);
    return NextResponse.json(
      { message: error.message || "An error occurred during registration." },
      { status: 500 }
    );
  }
}
