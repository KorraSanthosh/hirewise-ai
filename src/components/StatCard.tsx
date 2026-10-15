import { LucideIcon } from "lucide-react";

interface Props {
  title: string;
  value: string;
  change: string;
  icon: LucideIcon;
  color: string;
}

export default function StatCard({
  title,
  value,
  change,
  icon: Icon,
  color,
}: Props) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-lg transition">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500">{title}</p>

          <h2 className="text-4xl font-bold mt-3 text-slate-800">
            {value}
          </h2>

          <p className="text-green-600 text-sm mt-2">
            {change}
          </p>
        </div>

        <div className={`${color} p-4 rounded-2xl text-white`}>
          <Icon size={30} />
        </div>
      </div>
    </div>
  );
}