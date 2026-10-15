import { NextResponse } from "next/server";
import { getDashboardAnalytics } from "@/services/dashboard.service";
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

    const analytics = await getDashboardAnalytics();

    return NextResponse.json(analytics, {
      status: 200,
    });
  } catch (error) {
    console.error("Dashboard Analytics Error:", error);

    return NextResponse.json(
      {
        message: "Failed to fetch dashboard analytics",
      },
      {
        status: 500,
      }
    );
  }
}
