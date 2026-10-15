import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { MatchingService } from "@/services/matching.service";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");

    const role = (session.user as any).role;
    const where: any = {};
    
    if (role === "candidate") {
      const candidateRecord = await prisma.candidate.findFirst({
        where: { userId: session.user.id }
      });
      if (!candidateRecord) {
        return NextResponse.json([], { status: 200 });
      }
      where.candidateId = candidateRecord.id;
    } else {
      if (jobId) {
        where.jobId = jobId;
      }
    }

    const matches = await prisma.match.findMany({
      where,
      orderBy: { overallScore: "desc" },
      include: {
        candidate: {
          include: {
            skills: true,
          },
        },
        job: true,
      },
    });

    return NextResponse.json(matches, { status: 200 });
  } catch (error: any) {
    console.error("Fetch Matches Error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to fetch matches" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as any).role;
    if (role !== "candidate") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const candidateRecord = await prisma.candidate.findFirst({
      where: { userId: session.user.id }
    });
    if (!candidateRecord || !candidateRecord.rawResumeText || candidateRecord.rawResumeText.trim() === "") {
      return NextResponse.json(
        { message: "No resume profile found. Please upload your resume first." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { jobId } = body;
    if (!jobId) {
      return NextResponse.json({ message: "Job ID is required" }, { status: 400 });
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId }
    });
    if (!job) {
      return NextResponse.json({ message: "Job not found" }, { status: 404 });
    }

    // Run matching to generate the Match record for this candidate and job
    await MatchingService.runJobMatching(jobId);

    // Retrieve the created/updated Match record
    const match = await prisma.match.findUnique({
      where: {
        jobId_candidateId: {
          jobId,
          candidateId: candidateRecord.id
        }
      }
    });

    return NextResponse.json({ success: true, match }, { status: 201 });
  } catch (error: any) {
    console.error("Apply Job Error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to apply for job" },
      { status: 500 }
    );
  }
}
