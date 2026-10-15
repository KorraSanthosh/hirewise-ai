import { GoogleGenerativeAI, Schema, SchemaType } from '@google/generative-ai';
import { AIError } from '../core/errors';
import { ParsedCandidate, ParsedJob } from '../types/domain';

export class GeminiService {
  private static genAI: GoogleGenerativeAI | null = null;

  private static getClient(): GoogleGenerativeAI {
    if (!this.genAI) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new AIError('GEMINI_API_KEY is not defined in the environment variables.');
      }
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
    return this.genAI;
  }

  /**
   * Centralized helper to run Gemini API operations with exponential backoff retries.
   * Retries on 429 and 503 errors, up to 3 times.
   */
  private static async runWithRetry<T>(
    operation: () => Promise<T>,
    errorMessagePrefix: string
  ): Promise<T> {
    const delays = [2000, 4000, 8000];
    for (let attempt = 0; attempt <= 3; attempt++) {
      try {
        return await operation();
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errObj = error as { status?: number; statusCode?: number; status_code?: number } | null | undefined;
        const status = errObj?.status || errObj?.statusCode || errObj?.status_code;

        const is429 = status === 429 || 
                      errorMessage.includes('429') || 
                      errorMessage.toLowerCase().includes('resource exhausted') || 
                      errorMessage.toLowerCase().includes('rate limit');
                      
        const is503 = status === 503 || 
                      errorMessage.includes('503') || 
                      errorMessage.toLowerCase().includes('service unavailable') || 
                      errorMessage.toLowerCase().includes('overloaded') || 
                      errorMessage.toLowerCase().includes('temporarily unavailable');

        if ((is429 || is503) && attempt < 3) {
          const delay = delays[attempt];
          console.warn(`${errorMessagePrefix} failed with transient error ${status || ''} (attempt ${attempt + 1}/4). Retrying in ${delay}ms... Error: ${errorMessage}`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        if (attempt === 3 && (is429 || is503)) {
          throw new AIError("AI resume parsing is temporarily unavailable. Please try again in a few minutes.");
        }

        throw error;
      }
    }
    throw new AIError("AI resume parsing is temporarily unavailable. Please try again in a few minutes.");
  }

  /**
   * Generates a 768-dimension dense vector embedding for the given text.
   */
  public static async generateEmbedding(text: string): Promise<number[]> {
    try {
      const client = this.getClient();
      const model = client.getGenerativeModel({ model: 'gemini-embedding-001' });
      
      const embeddingValues = await this.runWithRetry(async () => {
        const result = await model.embedContent({
          content: {
            parts: [{ text }],
          },
          outputDimensionality: 768,
        } as unknown as Parameters<typeof model.embedContent>[0]);
        if (!result?.embedding?.values) {
          throw new Error('Embedding generation returned empty values.');
        }
        return result.embedding.values;
      }, 'Gemini Embedding generation');

      return embeddingValues;
    } catch (error) {
      if (error instanceof AIError) throw error;
      throw new AIError(`Gemini Embedding generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Parses candidate resume text into a structured ParsedCandidate profile.
   */
  public static async parseResume(resumeText: string): Promise<ParsedCandidate> {
    try {
      const client = this.getClient();
      const model = client.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: this.getCandidateSchema(),
        },
      });

      const prompt = `
You are an expert recruitment parser. Analyze the following candidate resume text and extract all details according to the required schema.
Format the yearsOfExperience as a number. For education, categorize the school tier as either 'tier_1', 'tier_2', 'tier_3', 'tier_4', or 'unknown' (e.g. tier_1 for IITs, BITS, top tier universities; tier_2 for NITs, respectable state colleges; etc.).
If dates are incomplete, estimate or leave null. If details are missing, return null or empty lists, but adhere strictly to the schema structure.
For skills, estimate the active durationMonths based on the resume timeline, and assign a proficiency level ('beginner', 'intermediate', 'advanced', 'expert').

For careerHistory, extract all professional experiences, internships, training programs, roles, or volunteer/club involvements. If there is no dedicated 'Work Experience' or 'Employment' heading, look under sections like 'Achievements', 'Social Engagements and Experience', 'Experience', 'Volunteering', etc. to find these entries (e.g. 'DESIS Ascend Educare Program', 'GirlScript Summer of Code', 'UDAAN Career Club', 'CSETimes', 'KARTAVYA') and parse them. Ensure to clean and format their company/organization and title names.

Resume Text:
${resumeText}
      `;

      const responseText = await this.runWithRetry(async () => {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        if (!text) {
          throw new Error('Empty response received from Gemini during resume parsing.');
        }
        return text;
      }, 'Gemini resume parsing');

      return JSON.parse(responseText) as ParsedCandidate;
    } catch (error) {
      if (error instanceof AIError) throw error;
      throw new AIError(`Gemini resume parsing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Parses raw Job Description text into a structured ParsedJob object.
   */
  public static async parseJobDescription(jdText: string): Promise<ParsedJob> {
    try {
      const client = this.getClient();
      const model = client.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: this.getJobSchema(),
        },
      });

      const prompt = `
You are an expert recruitment parser. Analyze the following Job Description (JD) text and extract all parameters and preferences into the specified JSON structure.
Be thorough in extracting required vs. preferred technical skills, educational degrees, and universities (e.g., IIT, NIT, tier 1 colleges).
Estimate the minimum experienceYears required. Set preferProductCompany to true if there is any indication of preferring startups or product development over IT services/consulting.

Job Description:
${jdText}
      `;

      const responseText = await this.runWithRetry(async () => {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        if (!text) {
          throw new Error('Empty response received from Gemini during job description parsing.');
        }
        return text;
      }, 'Gemini Job Description parsing');

      return JSON.parse(responseText) as ParsedJob;
    } catch (error) {
      if (error instanceof AIError) throw error;
      throw new AIError(`Gemini Job Description parsing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generates recruiter-facing Explainable AI (XAI) reports based on candidates, jobs, and calculated matching scores.
   */
  public static async generateMatchExplanation(
    candidate: { name: string; headline?: string; summary?: string; rawResumeText: string },
    job: { title: string; rawDescription: string },
    scores: {
      overallScore: number;
      semanticSimilarity: number;
      skillMatchScore: number;
      experienceScore: number;
      educationScore: number;
      domainScore: number;
      careerProgressionScore: number;
      availabilityScore: number;
    }
  ): Promise<{
    strengths: string[];
    weaknesses: string[];
    missingSkills: string[];
    hiringRecommendation: string;
    improvementSuggestions: string[];
  }> {
    try {
      const client = this.getClient();
      const model = client.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: this.getExplanationSchema(),
        },
      });

      const prompt = `
You are an expert recruiter and talent consultant. You need to write an Explainable AI (XAI) feedback report for the candidate based on their matching metrics against the job description.
Do not use generic empty sentences. Ground your feedback on specific facts (e.g., years of experience, current title, named skills, anomalies, or notice periods).

Job Title: ${job.title}
Job Description Overview:
${job.rawDescription.slice(0, 1500)}

Candidate Name: ${candidate.name}
Candidate Summary: ${candidate.summary || candidate.headline || ''}
Key Resume Details:
${candidate.rawResumeText.slice(0, 2000)}

Scoring Metrics Breakdown (0.0 to 100.0 scale):
- Overall Fit Score: ${(scores.overallScore * 100).toFixed(1)}
- Semantic Resume Similarity: ${scores.semanticSimilarity.toFixed(1)}
- Technical Skill Match: ${scores.skillMatchScore.toFixed(1)}
- Experience & Seniority Score: ${scores.experienceScore.toFixed(1)}
- Education & College Score: ${scores.educationScore.toFixed(1)}
- Domain Alignment Score: ${scores.domainScore.toFixed(1)}
- Career Progression/Stability: ${scores.careerProgressionScore.toFixed(1)}
- Availability & Engagement Score: ${scores.availabilityScore.toFixed(1)}

Generate:
1. Strengths (Array of strings, 2-4 points citing facts)
2. Weaknesses (Array of strings, 1-3 points highlighting gaps or risks)
3. Missing Skills (Array of strings, specific technical skills from JD missing in resume)
4. Hiring Recommendation (A concise 2-3 sentence recruiter synthesis outlining final suitability and key fit/gap reasons)
5. Improvement Suggestions (Array of strings, actionable suggestions for the candidate)
      `;

      const responseText = await this.runWithRetry(async () => {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        if (!text) {
          throw new Error('Empty response received from Gemini during explainability report generation.');
        }
        return text;
      }, 'Gemini explainability report generation');

      return JSON.parse(responseText);
    } catch (error) {
      if (error instanceof AIError) throw error;
      throw new AIError(`Gemini explainability report generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // --- Gemini Response Schemas ---

  private static getCandidateSchema(): Schema {
    return {
      type: SchemaType.OBJECT,
      properties: {
        profile: {
          type: SchemaType.OBJECT,
          properties: {
            anonymizedName: { type: SchemaType.STRING, description: 'The candidate\'s full name (e.g. "Durga Naga Meghana Merla"). Ensure proper spacing between names.' },
            headline: { type: SchemaType.STRING },
            summary: { type: SchemaType.STRING },
            location: { type: SchemaType.STRING },
            country: { type: SchemaType.STRING },
            yearsOfExperience: { type: SchemaType.NUMBER },
            currentTitle: { type: SchemaType.STRING },
            currentCompany: { type: SchemaType.STRING },
            currentCompanySize: { type: SchemaType.STRING },
            currentIndustry: { type: SchemaType.STRING },
          },
          required: ['anonymizedName', 'yearsOfExperience'],
        },
        careerHistory: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              company: { type: SchemaType.STRING },
              title: { type: SchemaType.STRING },
              startDate: { type: SchemaType.STRING },
              endDate: { type: SchemaType.STRING },
              durationMonths: { type: SchemaType.INTEGER },
              isCurrent: { type: SchemaType.BOOLEAN },
              industry: { type: SchemaType.STRING },
              companySize: { type: SchemaType.STRING },
              description: { type: SchemaType.STRING },
            },
            required: ['company', 'title', 'durationMonths', 'isCurrent'],
          },
        },
        education: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              institution: { type: SchemaType.STRING },
              degree: { type: SchemaType.STRING },
              fieldOfStudy: { type: SchemaType.STRING },
              startYear: { type: SchemaType.INTEGER },
              endYear: { type: SchemaType.INTEGER },
              grade: { type: SchemaType.STRING },
              tier: {
                type: SchemaType.STRING,
                format: 'enum',
                enum: ['tier_1', 'tier_2', 'tier_3', 'tier_4', 'unknown'],
              },
            },
            required: ['institution', 'degree', 'fieldOfStudy', 'tier'],
          },
        },
        skills: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              name: { type: SchemaType.STRING },
              proficiency: {
                type: SchemaType.STRING,
                format: 'enum',
                enum: ['beginner', 'intermediate', 'advanced', 'expert'],
              },
              endorsements: { type: SchemaType.INTEGER },
              durationMonths: { type: SchemaType.INTEGER },
            },
            required: ['name', 'proficiency', 'endorsements', 'durationMonths'],
          },
        },
      },
      required: ['profile', 'careerHistory', 'education', 'skills'],
    };
  }

  private static getJobSchema(): Schema {
    return {
      type: SchemaType.OBJECT,
      properties: {
        title: { type: SchemaType.STRING },
        company: { type: SchemaType.STRING },
        department: { type: SchemaType.STRING },
        rawDescription: { type: SchemaType.STRING },
        requiredSkills: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
        },
        preferredSkills: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
        },
        responsibilities: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
        },
        experienceYears: { type: SchemaType.INTEGER },
        educationLevel: { type: SchemaType.STRING },
        seniority: { type: SchemaType.STRING },
        domain: { type: SchemaType.STRING },
        softSkills: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
        },
        preferProductCompany: { type: SchemaType.BOOLEAN },
        preferredDegrees: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
        },
        preferredUniversities: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
        },
      },
      required: [
        'title',
        'rawDescription',
        'requiredSkills',
        'preferredSkills',
        'experienceYears',
        'preferProductCompany',
        'preferredDegrees',
      ],
    };
  }

  private static getExplanationSchema(): Schema {
    return {
      type: SchemaType.OBJECT,
      properties: {
        strengths: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
        },
        weaknesses: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
        },
        missingSkills: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
        },
        hiringRecommendation: { type: SchemaType.STRING },
        improvementSuggestions: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
        },
      },
      required: ['strengths', 'weaknesses', 'missingSkills', 'hiringRecommendation', 'improvementSuggestions'],
    };
  }
}
