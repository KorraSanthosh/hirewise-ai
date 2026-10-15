import { ReactNode, Suspense } from "react";
import Sidebar from "./SideBar";
import Navbar from "./NavBar";

interface Props {
  children: ReactNode;
}

export default function DashboardLayout({ children }: Props) {
  return (
    <div className="flex h-screen bg-slate-100">
      <Sidebar />

      <div className="flex-grow flex flex-col min-w-0 h-full">
        {/* Fixed Navbar Area */}
        <div className="p-8 pb-0 shrink-0">
          <Suspense fallback={<div className="h-[76px] bg-white rounded-2xl animate-pulse"></div>}>
            <Navbar />
          </Suspense>
        </div>

        {/* Scrollable Main Content Area */}
        <main className="flex-grow overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  );
}