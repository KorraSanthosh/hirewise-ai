"use client";

import Link from "next/link";
import { ShieldAlert, ArrowLeft, Home } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center px-4 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute w-[50%] h-[50%] rounded-full bg-rose-600/5 blur-[120px] pointer-events-none"></div>

      <div className="text-center space-y-6 max-w-md z-10">
        <div className="mx-auto h-16 w-16 bg-rose-950/30 border border-rose-800/40 text-rose-500 rounded-2xl flex items-center justify-center shadow-lg">
          <ShieldAlert size={36} />
        </div>
        
        <h1 className="text-3xl font-black text-white tracking-tight">Access Denied</h1>
        
        <p className="text-slate-400 text-sm leading-relaxed">
          Your account role does not have authorization to view this section of the HireWise AI recruitment platform.
        </p>

        <div className="flex gap-4 justify-center pt-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 px-5 py-2.5 bg-slate-800 border border-slate-700 hover:bg-slate-750 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition"
          >
            <Home size={14} />
            Go to Hub
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-500/10"
          >
            Sign in as another User
          </Link>
        </div>
      </div>
    </div>
  );
}
