import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { handleError } from "@/core/errors/handler";
import { ValidationError, NotFoundError } from "@/core/errors";
import { prisma } from "@/lib/prisma";
import { PdfParserService } from "@/services/pdf-parser.service";
import { MatchingService } from "@/services/matching.service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;

    // 1. Verify job exists
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundError(`Job Description with ID ${jobId} was not found.`);
    }

    // 2. Parse file from form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      throw new ValidationError("Resume file is required for evaluation.");
    }

    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      throw new ValidationError("Only PDF files are supported for resume uploads.");
    }

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as any).role;
    if (role !== "recruiter" && role !== "admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const userId = session.user.id;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Extract text from PDF
    const resumeText = await PdfParserService.parsePdf(buffer);

    // 4. Parse using Gemini & create Candidate Profile
    const candidate = await MatchingService.createCandidateProfile(userId, resumeText);

    // 5. Run the existing ranking engine to generate/update Match records
    await MatchingService.runJobMatching(jobId);

    // 6. Fetch the newly created Match details
    const match = await prisma.match.findUnique({
      where: {
        jobId_candidateId: {
          jobId,
          candidateId: candidate.id,
        },
      },
      include: {
        candidate: {
          include: {
            skills: true,
            careerHistory: true,
            education: true,
          },
        },
      },
    });

    if (!match) {
      throw new Error("Failed to retrieve match evaluation results.");
    }

    return NextResponse.json(
      {
        success: true,
        message: "Resume evaluated successfully.",
        data: match,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleError(error);
  }
}
