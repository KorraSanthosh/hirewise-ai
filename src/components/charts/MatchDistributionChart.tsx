"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { MatchDistributionRange } from "@/types/dashboard";

interface Props {
  data: MatchDistributionRange[];
  loading?: boolean;
}

export default function MatchDistributionChart({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const isEmpty = !data || data.length === 0 || data.every((d) => d.candidates === 0);

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full text-slate-400">
        <span className="text-sm font-medium">No candidate scores analyzed yet</span>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
        <XAxis dataKey="range" stroke="#64748B" fontSize={12} tickLine={false} />
        <YAxis stroke="#64748B" fontSize={12} tickLine={false} />
        <Tooltip />
        <Bar dataKey="candidates" fill="#2563EB" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}