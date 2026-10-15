import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MatchingService } from "@/services/matching.service";
import { auth } from "@/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const jobs = await prisma.job.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });
    return NextResponse.json(jobs, { status: 200 });
  } catch (error: any) {
    console.error("Fetch Jobs Error:", error);
    return NextResponse.json({ message: "Failed to fetch jobs" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as any).role;
    if (role !== "recruiter" && role !== "admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      title,
      company,
      department,
      rawDescription,
      experienceYears,
      educationLevel,
      seniority,
      domain,
    } = body;

    if (!rawDescription || rawDescription.length < 20) {
      return NextResponse.json(
        { message: "Job description must be at least 20 characters long." },
        { status: 400 }
      );
    }

    const finalUserId = session.user.id;

    // Call matching service to parse, generate embedding, and create Job
    const job = await MatchingService.createJobDescription(finalUserId, rawDescription, {
      title,
      company,
      department,
    });

    // Update with manual form overrides if they were specified
    const updateData: any = {};
    if (experienceYears !== undefined) updateData.experienceYears = Number(experienceYears);
    if (educationLevel !== undefined) updateData.educationLevel = educationLevel;
    if (seniority !== undefined) updateData.seniority = seniority;
    if (domain !== undefined) updateData.domain = domain;

    let updatedJob = job;
    if (Object.keys(updateData).length > 0) {
      updatedJob = await prisma.job.update({
        where: { id: job.id },
        data: updateData,
      });
    }

    return NextResponse.json(updatedJob, { status: 201 });
  } catch (error: any) {
    console.error("Create Job Error:", error);
    return NextResponse.json({ message: error.message || "Failed to create job" }, { status: 500 });
  }
}
