import { NextRequest, NextResponse } from 'next/server';
import { handleError } from '../../../../core/errors/handler';
import { JobUploadSchema } from '../../../../schemas/validation.schema';
import { MatchingService } from '../../../../services/matching.service';
import { ValidationError } from '../../../../core/errors';
import { prisma } from '../../../../lib/prisma';
import { auth } from '@/auth';

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
    const result = JobUploadSchema.safeParse(body);

    if (!result.success) {
      const fieldErrors: Record<string, string[]> = {};
      result.error.issues.forEach((issue) => {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) {
          fieldErrors[path] = [];
        }
        fieldErrors[path].push(issue.message);
      });
      throw new ValidationError('Validation failed for job description details.', fieldErrors);
    }

    const { rawDescription, title, company, department } = result.data;
    let userId = body.userId as string | null;

    // Ensure a valid user exists in the database to prevent foreign key failures
    if (!userId) {
      let defaultUser = await prisma.user.findFirst();
      if (!defaultUser) {
        defaultUser = await prisma.user.create({
          data: {
            email: 'recruiter@hirewise.ai',
            passwordHash: 'placeholder_password_hash',
            name: 'Default Recruiter',
            role: 'recruiter',
          },
        });
      }
      userId = defaultUser.id;
    } else {
      const userExists = await prisma.user.findUnique({ where: { id: userId } });
      if (!userExists) {
        throw new ValidationError(`User with ID ${userId} does not exist in the database.`);
      }
    }

    // Call service to parse and save Job Description
    const job = await MatchingService.createJobDescription(userId, rawDescription, {
      title,
      company,
      department,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Job Description parsed and created successfully.',
        data: {
          id: job.id,
          title: job.title,
          company: job.company,
          department: job.department,
          requiredSkills: job.requiredSkills,
          experienceYears: job.experienceYears,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return handleError(error);
  }
}
