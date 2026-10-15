import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/auth";
import { handleError } from '../../../../core/errors/handler';
import { PdfParserService } from '../../../../services/pdf-parser.service';
import { MatchingService } from '../../../../services/matching.service';
import { ValidationError } from '../../../../core/errors';
import { prisma } from '../../../../lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      throw new ValidationError('Resume file is required for upload.');
    }

    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      throw new ValidationError('Only PDF files are supported for candidate resume uploads.');
    }

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as any).role;
    if (role !== "recruiter" && role !== "admin" && role !== "candidate") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const userId = session.user.id;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Extract raw text from PDF
    const resumeText = await PdfParserService.parsePdf(buffer);

    // 2. Parse using Gemini and save to Postgres
    const candidate = await MatchingService.createCandidateProfile(userId, resumeText);

    return NextResponse.json(
      {
        success: true,
        message: 'Resume parsed and candidate profile created successfully.',
        data: {
          id: candidate.id,
          candidateId: candidate.candidateId,
          name: candidate.name,
          headline: candidate.headline,
          location: candidate.location,
          yearsOfExperience: candidate.yearsOfExperience,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return handleError(error);
  }
}
