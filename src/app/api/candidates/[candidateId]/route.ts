import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { candidateId } = await params;
    const lookupId = candidateId === "profile" ? session.user.id : candidateId;
    
    const candidate = await prisma.candidate.findFirst({
      where: {
        OR: [
          { id: lookupId },
          { candidateId: lookupId },
          { userId: lookupId }
        ]
      },
      include: {
        skills: true,
        education: true,
        careerHistory: true,
        matches: {
          include: {
            job: true
          }
        }
      },
    });

    if (!candidate) {
      return NextResponse.json({ message: "Candidate not found" }, { status: 404 });
    }

    // Role-based access and ownership check
    const userRole = (session.user as any).role;
    if (userRole === "candidate" && candidate.userId !== session.user.id) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(candidate, { status: 200 });
  } catch (error: any) {
    console.error("Fetch Candidate Error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to fetch candidate details" },
      { status: 500 }
    );
  }
}
