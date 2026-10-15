import { NextResponse } from "next/server";
import { getTopCandidates } from "@/services/candidate-dashboard.service";
import { auth } from "@/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as any).role;
    if (role !== "recruiter" && role !== "admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const candidates = await getTopCandidates();

    return NextResponse.json(candidates, {
      status: 200,
    });
  } catch (error) {
    console.error("Dashboard Candidates Error:", error);

    return NextResponse.json(
      {
        message: "Failed to fetch top candidates",
      },
      {
        status: 500,
      }
    );
  }
}
