import { Card } from "./ui/card";
import { AlertCircle, TrendingUp, TrendingDown, Minus, RefreshCw, ArrowDownToLine, ArrowUpToLine } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "./ui/dialog";

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  unit: string;
  status: "normal" | "warning";
  iconColor: string;
  warningMessage?: string;
  min?: number;
  max?: number;
  trend?: "up" | "down" | "stable";
  updatedAt?: Date | null;
}

export function MetricCard({
  icon,
  label,
  value,
  unit,
  status,
  iconColor,
  warningMessage,
  min,
  max,
  trend,
  updatedAt,
}: MetricCardProps) {
  const getTrendIcon = () => {
    if (!trend) return null;
    switch (trend) {
      case "up":
        return <TrendingUp className="w-5 h-5 text-stone-600" />;
      case "down":
        return <TrendingDown className="w-5 h-5 text-stone-600" />;
      case "stable":
        return <Minus className="w-5 h-5 text-stone-600" />;
    }
  };

  return (
    <Card className="p-6 bg-white/90 backdrop-blur-sm shadow-lg border border-stone-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={iconColor}>{icon}</div>
          <div>
            <p className="text-sm text-stone-600 mb-1">{label}</p>
            <div className="flex items-center gap-2">
              <p className="text-4xl text-stone-900">
                {value !== null ? value.toFixed(1) : "--"}
                <span className="text-xl text-stone-500 ml-1">{unit}</span>
              </p>
              {trend && <div className="mt-2">{getTrendIcon()}</div>}
              {updatedAt && (
                <div className="flex items-center gap-1 text-xs text-stone-400 mt-2 ml-2">
                  <RefreshCw className="w-3 h-3" />
                  <span>{updatedAt.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              )}
            </div>
            {min !== undefined && max !== undefined && (
              <div className="text-xs text-stone-500 mt-2">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1">
                    <ArrowDownToLine className="w-3 h-3" />
                    {min.toFixed(1)}{unit}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <ArrowUpToLine className="w-3 h-3" />
                    {max.toFixed(1)}{unit}
                  </span>
                  <span className="text-stone-400">(24t)</span>
                </div>
              </div>
            )}
          </div>
        </div>
        {status === "warning" && warningMessage ? (
          <Dialog>
            <DialogTrigger asChild>
              <button className="flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity">
                <AlertCircle className="w-6 h-6 text-[#a02a2a]" />
                <span className="text-xs text-[#a02a2a] mt-1">Varsel</span>
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-[#a02a2a]" />
                  {label} - Varsel
                </DialogTitle>
                <DialogDescription className="text-base mt-2">
                  {warningMessage}
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        ) : status === "warning" ? (
          <div className="flex flex-col items-center">
            <AlertCircle className="w-6 h-6 text-[#a02a2a]" />
            <span className="text-xs text-[#a02a2a] mt-1">Varsel</span>
          </div>
        ) : null}
        {status === "normal" && (
          <div className="flex flex-col items-center">
            <div className="w-3 h-3 rounded-full bg-[#5d7342]"></div>
            <span className="text-xs text-[#5d7342] mt-1">Normal</span>
          </div>
        )}
      </div>
    </Card>
  );
}