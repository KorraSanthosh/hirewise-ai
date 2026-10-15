import { NextResponse } from "next/server";
import { getDashboardStats } from "@/services/dashboard.service";
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

    const stats = await getDashboardStats();

    return NextResponse.json(stats, {
      status: 200,
    });
  } catch (error) {
    console.error("Dashboard Stats Error:", error);

    return NextResponse.json(
      {
        message: "Failed to fetch dashboard statistics",
      },
      {
        status: 500,
      }
    );
  }
}