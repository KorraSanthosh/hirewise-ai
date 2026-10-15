"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Upload,
  BriefcaseBusiness,
  Users,
  Trophy,
  BarChart3,
  Settings,
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user as any)?.role || "recruiter";

  const recruiterMenus = [
    { name: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
    { name: "Import Candidate Resume", icon: Upload, href: "/upload-resume" },
    { name: "Jobs", icon: BriefcaseBusiness, href: "/jobs" },
    { name: "AI Rankings", icon: Trophy, href: "/rankings" },
    { name: "Analytics", icon: BarChart3, href: "#" },
    { name: "Settings", icon: Settings, href: "#" },
  ];

  const candidateMenus = [
    { name: "Available Jobs", icon: BriefcaseBusiness, href: "/jobs" },
    { name: "Upload Resume", icon: Upload, href: "/upload-resume" },
    { name: "My Applications", icon: Trophy, href: "/candidates/applications" },
    { name: "Application Status", icon: LayoutDashboard, href: "/candidates/status" },
    { name: "My Profile", icon: Users, href: `/candidates/${session?.user?.id || 'profile'}` },
  ];

  const adminMenus = [
    { name: "System Analytics", icon: BarChart3, href: "/admin/analytics" },
    { name: "Manage Jobs", icon: BriefcaseBusiness, href: "/jobs" },
    { name: "Manage Users", icon: Users, href: "/admin/users" },
    { name: "Manage Recruiters", icon: Trophy, href: "/admin/recruiters" },
    { name: "Settings", icon: Settings, href: "#" },
  ];

  let menus = recruiterMenus;
  if (role === "candidate") {
    menus = candidateMenus;
  } else if (role === "admin") {
    menus = adminMenus;
  }

  return (
    <aside className="w-72 bg-slate-900 text-white flex flex-col">
      <div className="px-8 py-8 border-b border-slate-800">
        <h1 className="text-3xl font-bold">
          HireWise <span className="text-blue-400">AI</span>
        </h1>
      </div>

      <nav className="flex-1 p-5 space-y-2">
        {menus.map((menu, index) => {
          const Icon = menu.icon;
          const isActive = pathname === menu.href;

          return (
            <Link
              key={index}
              href={menu.href}
              className={`flex items-center gap-4 w-full px-4 py-3 rounded-xl transition
              ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "hover:bg-slate-800 text-slate-300"
              }`}
            >
              <Icon size={20} />
              {menu.name}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-5">
        <p className="text-xs text-slate-400">Logged in as</p>
        <h3 className="font-semibold mt-1 text-slate-200 truncate">{session?.user?.name || "Guest"}</h3>
        <span className="text-[10px] bg-slate-850 border border-slate-700 text-slate-400 px-2 py-0.5 rounded font-bold uppercase tracking-wider mt-1.5 inline-block">
          {role}
        </span>
      </div>
    </aside>
  );
}