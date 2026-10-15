import { NextRequest, NextResponse } from 'next/server';
import { handleError } from '../../../../../core/errors/handler';
import { RankingWeightsSchema } from '../../../../../schemas/validation.schema';
import { MatchingService } from '../../../../../services/matching.service';
import { ValidationError, NotFoundError } from '../../../../../core/errors';
import { prisma } from '../../../../../lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;

    // Verify job exists
    const jobExists = await prisma.job.findUnique({ where: { id: jobId } });
    if (!jobExists) {
      throw new NotFoundError(`Job Description with ID ${jobId} was not found.`);
    }

    // Retrieve and parse optional custom weights
    let customWeights: Record<string, number> | undefined = undefined;
    const bodyText = await req.text();
    if (bodyText) {
      try {
        const body = JSON.parse(bodyText);
        if (body.weights) {
          const result = RankingWeightsSchema.safeParse(body.weights);
          if (!result.success) {
            throw new ValidationError('Invalid weights provided. Sum of weights must equal 1.0.');
          }
          customWeights = result.data as Record<string, number>;
        }
      } catch (err) {
        if (err instanceof ValidationError) throw err;
        throw new ValidationError('Malformed JSON payload in request body.');
      }
    }

    // Run matching engine
    const matchCount = await MatchingService.runJobMatching(jobId, customWeights);

    // Retrieve compiled matches ordered by rank (overallScore desc)
    const matches = await prisma.match.findMany({
      where: { jobId },
      orderBy: { overallScore: 'desc' },
      include: {
        candidate: {
          select: {
            id: true,
            candidateId: true,
            name: true,
            headline: true,
            yearsOfExperience: true,
            location: true,
            anomalyStatus: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully calculated matching scores for ${matchCount} candidates.`,
      data: {
        jobId,
        matchCount,
        matches: matches.map((m, index) => ({
          rank: index + 1,
          id: m.id,
          candidate: m.candidate,
          scores: {
            overall: m.overallScore,
            semantic: m.semanticSimilarity,
            skills: m.skillMatchScore,
            experience: m.experienceScore,
            education: m.educationScore,
            domain: m.domainScore,
            careerProgression: m.careerProgressionScore,
            availability: m.availabilityScore,
          },
          strengths: m.strengths,
          weaknesses: m.weaknesses,
          hiringRecommendation: m.hiringRecommendation,
        })),
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
