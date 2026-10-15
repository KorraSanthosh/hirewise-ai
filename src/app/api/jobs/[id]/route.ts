import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: jobId } = await params;

    // Check if job exists
    const existingJob = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!existingJob) {
      return NextResponse.json({ message: "Job not found" }, { status: 404 });
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (company !== undefined) updateData.company = company;
    if (department !== undefined) updateData.department = department;
    if (rawDescription !== undefined) updateData.rawDescription = rawDescription;
    if (experienceYears !== undefined) updateData.experienceYears = Number(experienceYears);
    if (educationLevel !== undefined) updateData.educationLevel = educationLevel;
    if (seniority !== undefined) updateData.seniority = seniority;
    if (domain !== undefined) updateData.domain = domain;

    // If rawDescription has changed, re-run Gemini parsing and embed calculation
    if (rawDescription && rawDescription !== existingJob.rawDescription) {
      const { GeminiService } = await import("@/services/gemini.service");
      const { MatchingService } = await import("@/services/matching.service");
      
      const parsedJd = await GeminiService.parseJobDescription(rawDescription);
      updateData.requiredSkills = parsedJd.requiredSkills;
      updateData.preferredSkills = parsedJd.preferredSkills;
      updateData.responsibilities = parsedJd.responsibilities;
      updateData.softSkills = parsedJd.softSkills;
      updateData.preferProductCompany = parsedJd.preferProductCompany;
      updateData.preferredDegrees = parsedJd.preferredDegrees;
      updateData.preferredUniversities = parsedJd.preferredUniversities;

      const updated = await prisma.job.update({
        where: { id: jobId },
        data: updateData,
      });

      const embedding = await GeminiService.generateEmbedding(rawDescription);
      const vectorStr = MatchingService.formatVectorString(embedding);
      await prisma.$executeRawUnsafe(
        `UPDATE "Job" SET "embedding" = $1::vector WHERE "id" = $2`,
        vectorStr,
        jobId
      );

      return NextResponse.json(updated, { status: 200 });
    }

    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: updateData,
    });

    return NextResponse.json(updatedJob, { status: 200 });
  } catch (error: any) {
    console.error("Update Job Error:", error);
    return NextResponse.json({ message: error.message || "Failed to update job" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as any).role;
    if (role !== "recruiter" && role !== "admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { id: jobId } = await params;

    const existingJob = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!existingJob) {
      return NextResponse.json({ message: "Job not found" }, { status: 404 });
    }

    await prisma.job.delete({
      where: { id: jobId },
    });

    return NextResponse.json({ message: "Job deleted successfully" }, { status: 200 });
  } catch (error: any) {
    console.error("Delete Job Error:", error);
    return NextResponse.json({ message: error.message || "Failed to delete job" }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id: jobId } = await params;
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });
    if (!job) {
      return NextResponse.json({ message: "Job not found" }, { status: 404 });
    }
    return NextResponse.json(job, { status: 200 });
  } catch (error: any) {
    console.error("Fetch Job Error:", error);
    return NextResponse.json({ message: error.message || "Failed to fetch job" }, { status: 500 });
  }
}
