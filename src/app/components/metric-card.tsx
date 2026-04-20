import { Card } from "./ui/card";
import { AlertCircle, TrendingUp, TrendingDown, Minus, ArrowDownToLine, ArrowUpToLine, Clock, Info } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "./ui/dialog";

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  valueDisplay?: string;
  unit: string;
  status: "normal" | "warning";
  iconColor: string;
  warningMessage?: string;
  min?: number;
  max?: number;
  trend?: "up" | "down" | "stable";
  updatedAt?: Date | null;
  darkMode?: boolean;
  hideStatusIndicator?: boolean;
}

export function MetricCard({
  icon,
  label,
  value,
  valueDisplay,
  unit,
  status,
  iconColor,
  warningMessage,
  min,
  max,
  trend,
  updatedAt,
  darkMode = false,
  hideStatusIndicator = false,
}: MetricCardProps) {
  const getTrendIcon = () => {
    if (!trend) return null;
    const trendColor = darkMode ? 'text-white/60' : 'text-stone-600';
    switch (trend) {
      case "up":
        return <TrendingUp className={`w-5 h-5 ${trendColor}`} />;
      case "down":
        return <TrendingDown className={`w-5 h-5 ${trendColor}`} />;
      case "stable":
        return <Minus className={`w-5 h-5 ${trendColor}`} />;
    }
  };

  const bgClass = darkMode ? 'bg-[#3d4d2e]/90' : 'bg-white/90';
  const textPrimary = darkMode ? 'text-white' : 'text-stone-900';
  const textSecondary = darkMode ? 'text-white/70' : 'text-stone-600';
  const textTertiary = darkMode ? 'text-white/50' : 'text-stone-500';
  const borderClass = darkMode ? 'border-white/10' : 'border-stone-200';
  
  // Dark mode color adjustments for better contrast
  const warningColor = darkMode ? '#ff4444' : '#a02a2a'; // Brighter red in dark mode
  const normalColor = darkMode ? '#8fbc5f' : '#5d7342'; // Brighter green in dark mode

  return (
    <Card className={`p-6 ${bgClass} backdrop-blur-sm shadow-lg border ${borderClass} transition-colors duration-300`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={iconColor}>{icon}</div>
          <div>
            <p className={`text-sm ${textSecondary} mb-1`}>{label}</p>
            <div className="flex items-center gap-2">
              <p className={`text-4xl ${textPrimary}`}>
                {valueDisplay ?? (value !== null ? value.toFixed(1) : "--")}
                <span className={`text-xl ${textTertiary} ml-1`}>{unit}</span>
              </p>
              {trend && <div className="mt-2">{getTrendIcon()}</div>}
            </div>
            {updatedAt && (
              <div className={`text-xs ${textTertiary} mt-1 flex items-center gap-1`}>
                <Clock className="w-3 h-3" />
                <span>
                  Oppdatert{" "}
                  {updatedAt.toLocaleTimeString("nb-NO", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            )}
            {min !== undefined && max !== undefined && (
              <div className={`text-xs ${textTertiary} mt-2`}>
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
                  <Dialog>
                    <DialogTrigger asChild>
                      <button className="flex items-center cursor-pointer hover:opacity-70 transition-opacity">
                        <Info className={`w-3 h-3 ${darkMode ? 'text-white/40' : 'text-stone-400'}`} />
                      </button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <Info className="w-5 h-5" />
                          24-timers oversikt
                        </DialogTitle>
                        <DialogDescription className="text-base mt-4 space-y-3">
                          <div className="flex items-start gap-3">
                            <ArrowDownToLine className="w-5 h-5 mt-0.5 flex-shrink-0" />
                            <span>Viser laveste målte {label.toLowerCase()} siste 24 timer.</span>
                          </div>
                          <div className="flex items-start gap-3">
                            <ArrowUpToLine className="w-5 h-5 mt-0.5 flex-shrink-0" />
                            <span>Viser høyeste målte {label.toLowerCase()} siste 24 timer.</span>
                          </div>
                        </DialogDescription>
                      </DialogHeader>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            )}
          </div>
        </div>
        {!hideStatusIndicator && status === "warning" && warningMessage ? (
          <Dialog>
            <DialogTrigger asChild>
              <button className="flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity">
                <AlertCircle className="w-6 h-6" style={{ color: warningColor }} />
                <span className="text-xs mt-1" style={{ color: warningColor }}>Varsel</span>
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" style={{ color: warningColor }} />
                  {label} - Varsel
                </DialogTitle>
                <DialogDescription className="text-base mt-2">
                  {warningMessage}
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        ) : !hideStatusIndicator && status === "warning" ? (
          <div className="flex flex-col items-center">
            <AlertCircle className="w-6 h-6" style={{ color: warningColor }} />
            <span className="text-xs mt-1" style={{ color: warningColor }}>Varsel</span>
          </div>
        ) : null}
        {!hideStatusIndicator && status === "normal" && (
          <div className="flex flex-col items-center">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: normalColor }}></div>
            <span className="text-xs mt-1" style={{ color: normalColor }}>Normal</span>
          </div>
        )}
      </div>
    </Card>
  );
}
