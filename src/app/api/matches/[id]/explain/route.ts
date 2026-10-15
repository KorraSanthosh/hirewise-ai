import { NextRequest, NextResponse } from 'next/server';
import { handleError } from '../../../../../core/errors/handler';
import { GeminiService } from '../../../../../services/gemini.service';
import { NotFoundError } from '../../../../../core/errors';
import { prisma } from '../../../../../lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: matchId } = await params;

    // Retrieve match details along with candidate and job specifications
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        candidate: true,
        job: true,
      },
    });

    if (!match) {
      throw new NotFoundError(`Match report with ID ${matchId} was not found.`);
    }

    // Call Gemini Service to synthesize Explainable AI profile details
    const explanation = await GeminiService.generateMatchExplanation(
      {
        name: match.candidate.name,
        headline: match.candidate.headline || undefined,
        summary: match.candidate.summary || undefined,
        rawResumeText: match.candidate.rawResumeText,
      },
      {
        title: match.job.title,
        rawDescription: match.job.rawDescription,
      },
      {
        overallScore: match.overallScore,
        semanticSimilarity: match.semanticSimilarity,
        skillMatchScore: match.skillMatchScore,
        experienceScore: match.experienceScore,
        educationScore: match.educationScore,
        domainScore: match.domainScore,
        careerProgressionScore: match.careerProgressionScore,
        availabilityScore: match.availabilityScore,
      }
    );

    // Update match report with rich explainability
    const updatedMatch = await prisma.match.update({
      where: { id: matchId },
      data: {
        strengths: explanation.strengths,
        weaknesses: explanation.weaknesses,
        missingSkills: explanation.missingSkills,
        hiringRecommendation: explanation.hiringRecommendation,
        improvementSuggestions: explanation.improvementSuggestions,
      },
      include: {
        candidate: {
          select: {
            id: true,
            candidateId: true,
            name: true,
            headline: true,
          },
        },
        job: {
          select: {
            id: true,
            title: true,
            company: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Explainable AI report generated successfully.',
      data: {
        id: updatedMatch.id,
        candidate: updatedMatch.candidate,
        job: updatedMatch.job,
        scores: {
          overall: updatedMatch.overallScore,
          semantic: updatedMatch.semanticSimilarity,
          skills: updatedMatch.skillMatchScore,
          experience: updatedMatch.experienceScore,
          education: updatedMatch.educationScore,
          domain: updatedMatch.domainScore,
          careerProgression: updatedMatch.careerProgressionScore,
          availability: updatedMatch.availabilityScore,
        },
        explainability: {
          strengths: updatedMatch.strengths,
          weaknesses: updatedMatch.weaknesses,
          missingSkills: updatedMatch.missingSkills,
          hiringRecommendation: updatedMatch.hiringRecommendation,
          improvementSuggestions: updatedMatch.improvementSuggestions,
        },
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
