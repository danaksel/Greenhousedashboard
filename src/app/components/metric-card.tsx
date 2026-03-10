import { Card } from "./ui/card";
import { AlertCircle } from "lucide-react";

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  unit: string;
  status: "normal" | "warning";
  iconColor: string;
}

export function MetricCard({
  icon,
  label,
  value,
  unit,
  status,
  iconColor,
}: MetricCardProps) {
  return (
    <Card className="p-6 bg-white shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={iconColor}>{icon}</div>
          <div>
            <p className="text-sm text-gray-600 mb-1">{label}</p>
            <p className="text-4xl">
              {value !== null ? value.toFixed(1) : "--"}
              <span className="text-xl text-gray-500 ml-1">{unit}</span>
            </p>
          </div>
        </div>
        {status === "warning" && (
          <div className="flex flex-col items-center">
            <AlertCircle className="w-6 h-6 text-amber-500" />
            <span className="text-xs text-amber-600 mt-1">Alert</span>
          </div>
        )}
        {status === "normal" && (
          <div className="flex flex-col items-center">
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            <span className="text-xs text-emerald-600 mt-1">Normal</span>
          </div>
        )}
      </div>
    </Card>
  );
}