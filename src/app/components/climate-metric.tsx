import { ArrowDownToLine, ArrowUpToLine, AlertCircle, Info } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";

interface ClimateMetricProps {
  label: string;
  value: number | null;
  unit: string;
  min?: number;
  max?: number;
  warningMessage?: string;
  darkMode?: boolean;
}

export function ClimateMetric({
  label,
  value,
  unit,
  min,
  max,
  warningMessage,
  darkMode = false,
}: ClimateMetricProps) {
  const hasWarning = Boolean(warningMessage);
  const valueColor = hasWarning
    ? darkMode
      ? "text-[#ff8a80]"
      : "text-[#b3261e]"
    : darkMode
      ? "text-white"
      : "text-[#4D5D3E]";
  const unitColor = darkMode ? "text-[#b3bea3]" : "text-stone-500";
  const metaColor = darkMode ? "text-white/50" : "text-stone-500";

  return (
    <div className="space-y-1.5">
      {hasWarning ? (
        <Dialog>
          <DialogTrigger asChild>
            <button
              className="flex items-end gap-1 text-left transition-opacity hover:opacity-85 sm:gap-1.5"
              aria-label={`Vis varsel for ${label.toLowerCase()}`}
            >
              <span className={`text-[60px] leading-[0.92] font-light tracking-[0] ${valueColor}`}>
                {value !== null ? value.toFixed(1) : "--"}
              </span>
              <span className={`pb-0.5 text-[30px] leading-none font-light ${unitColor}`}>
                {unit}
              </span>
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-[#b3261e]" />
                {label} - varsel
              </DialogTitle>
              <DialogDescription className="pt-2 text-base">
                {warningMessage}
              </DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      ) : (
        <div className="flex items-end gap-1 sm:gap-1.5">
          <span className={`text-[60px] leading-[0.92] font-light tracking-[0] ${valueColor}`}>
            {value !== null ? value.toFixed(1) : "--"}
          </span>
          <span className={`pb-0.5 text-[30px] leading-none font-light ${unitColor}`}>
            {unit}
          </span>
        </div>
      )}

      {min !== undefined && max !== undefined && (
        <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] ${metaColor}`}>
          <span className="flex items-center gap-1.5">
            <ArrowDownToLine className="h-3.5 w-3.5 shrink-0" />
            {min.toFixed(1)}
            {unit}
          </span>
          <span className="h-1 w-1 rounded-full bg-current opacity-70" />
          <span className="flex items-center gap-1.5">
            <ArrowUpToLine className="h-3.5 w-3.5 shrink-0" />
            {max.toFixed(1)}
            {unit}
          </span>
          <Dialog>
            <DialogTrigger asChild>
              <button
                className="flex items-center transition-opacity hover:opacity-75"
                aria-label={`Forklaring for ${label.toLowerCase()}`}
              >
                <Info className="h-4 w-4" />
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>24-timers oversikt</DialogTitle>
                <DialogDescription className="mt-4 space-y-3 text-base">
                  <div className="flex items-start gap-3">
                    <ArrowDownToLine className="mt-0.5 h-5 w-5 shrink-0" />
                    <span>Viser laveste målte {label.toLowerCase()} siste 24 timer.</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <ArrowUpToLine className="mt-0.5 h-5 w-5 shrink-0" />
                    <span>Viser høyeste målte {label.toLowerCase()} siste 24 timer.</span>
                  </div>
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        </div>
      )}

    </div>
  );
}
