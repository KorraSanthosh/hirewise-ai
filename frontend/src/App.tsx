import { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import Layout from "./components/Layout";
import Applications from "./pages/Applications";
import CandidateProfile from "./pages/CandidateProfile";
import Dashboard from "./pages/Dashboard";
import Evaluate from "./pages/Evaluate";
import Jobs from "./pages/Jobs";
import { Login, Register } from "./pages/AuthPages";
import Rankings from "./pages/Rankings";
import UploadResume from "./pages/UploadResume";

function Guard({ roles, children }: { roles?: string[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center muted">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={user.role === "candidate" ? "/candidates/profile" : "/dashboard"} replace />;
  return <>{children}</>;
}

function Home() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={!user ? "/login" : user.role === "candidate" ? "/candidates/profile" : "/dashboard"} replace />;
}

export default function App() {
  const staff = ["recruiter", "admin"];
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<Guard><Layout /></Guard>}>
        <Route path="/dashboard" element={<Guard roles={staff}><Dashboard /></Guard>} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/jobs/:jobId/evaluate" element={<Guard roles={staff}><Evaluate /></Guard>} />
        <Route path="/rankings" element={<Guard roles={staff}><Rankings /></Guard>} />
        <Route path="/upload-resume" element={<UploadResume />} />
        <Route path="/applications" element={<Guard roles={["candidate"]}><Applications /></Guard>} />
        <Route path="/candidates/:candidateId" element={<CandidateProfile />} />
      </Route>
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
