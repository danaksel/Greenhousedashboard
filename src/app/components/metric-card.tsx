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
    <Card className="p-6 bg-white/90 backdrop-blur-sm shadow-lg border border-stone-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={iconColor}>{icon}</div>
          <div>
            <p className="text-sm text-stone-600 mb-1">{label}</p>
            <p className="text-4xl text-stone-900">
              {value !== null ? value.toFixed(1) : "--"}
              <span className="text-xl text-stone-500 ml-1">{unit}</span>
            </p>
          </div>
        </div>
        {status === "warning" && (
          <div className="flex flex-col items-center">
            <AlertCircle className="w-6 h-6 text-amber-600" />
            <span className="text-xs text-amber-700 mt-1">Varsel</span>
          </div>
        )}
        {status === "normal" && (
          <div className="flex flex-col items-center">
            <div className="w-3 h-3 rounded-full bg-teal-600"></div>
            <span className="text-xs text-teal-700 mt-1">Normal</span>
          </div>
        )}
      </div>
    </Card>
  );
}