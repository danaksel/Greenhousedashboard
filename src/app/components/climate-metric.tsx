import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { AlertCircleIcon, ArrowDownToLineIcon, ArrowUpToLineIcon, InfoIcon } from "./icons";
import { getResolvedDisplayTheme, getTemperatureValueTheme } from "../../shared/display-theme";
import type { DisplayThemeConfig } from "../utils/api";

interface ClimateMetricProps {
  label: string;
  value: number | null;
  unit: string;
  min?: number;
  max?: number;
  warningMessage?: string;
  darkMode?: boolean;
  theme?: DisplayThemeConfig;
}

export function ClimateMetric({
  label,
  value,
  unit,
  min,
  max,
  warningMessage,
  darkMode = false,
  theme,
}: ClimateMetricProps) {
  const isTemperatureMetric = label === "Temperatur";
  const hasWarning = Boolean(warningMessage);
  const resolvedTheme = getResolvedDisplayTheme(theme);
  const modeTheme = darkMode ? resolvedTheme.dark : resolvedTheme.light;
  let normalValueColor = modeTheme.defaultValueColor;
  let warningPulseColor = modeTheme.warningPulseColor;
  let valueColor = hasWarning ? "greenhouse-warning-pulse" : "";

  if (isTemperatureMetric && value !== null) {
    const valueTheme = getTemperatureValueTheme(value, darkMode, hasWarning, theme);
    normalValueColor = valueTheme.color;
    warningPulseColor = valueTheme.pulseColor || warningPulseColor;
    valueColor = valueTheme.shouldPulse ? "greenhouse-warning-pulse" : "";
  }

  const labelStyle: React.CSSProperties = { color: modeTheme.labelColor, opacity: modeTheme.labelOpacity };
  const unitStyle: React.CSSProperties = { color: modeTheme.unitColor };
  const metaStyle: React.CSSProperties = { color: modeTheme.mutedColor };
  const symbolStyle: React.CSSProperties = { color: modeTheme.symbolColor };

  return (
    <div className="space-y-1.5 md:space-y-3">
      <p className="ml-[10px] text-[10px] uppercase tracking-[0.02em] leading-[1.15]" style={labelStyle}>
        {label}
      </p>
      {hasWarning ? (
        <Dialog>
          <DialogTrigger asChild>
            <button
              className="ml-[10px] flex items-end gap-1 text-left transition-opacity hover:opacity-85 sm:gap-1.5"
              aria-label={`Vis varsel for ${label.toLowerCase()}`}
            >
              <span
                className={`text-[60px] leading-[0.92] font-light tracking-[0] md:text-[clamp(48px,6vw,72px)] ${valueColor}`}
                style={
                  {
                    color: normalValueColor,
                    "--warning-base-color": normalValueColor,
                    "--warning-pulse-color": warningPulseColor,
                  } as React.CSSProperties
                }
              >
                {value !== null ? value.toFixed(1) : "--"}
              </span>
              <span className="pb-0.5 text-[30px] leading-none font-light md:text-[clamp(24px,3vw,34px)]" style={unitStyle}>
                {unit}
              </span>
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircleIcon className="h-5 w-5 text-[#b3261e]" />
                {label} - varsel
              </DialogTitle>
              <DialogDescription className="pt-2 text-base">
                {warningMessage}
              </DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      ) : (
        <div className="ml-[10px] flex items-end gap-1 sm:gap-1.5">
          <span
            className={`text-[60px] leading-[0.92] font-light tracking-[0] md:text-[clamp(48px,6vw,72px)] ${valueColor}`}
            style={{ color: normalValueColor }}
          >
            {value !== null ? value.toFixed(1) : "--"}
          </span>
          <span className="pb-0.5 text-[30px] leading-none font-light md:text-[clamp(24px,3vw,34px)]" style={unitStyle}>
            {unit}
          </span>
        </div>
      )}

      {min !== undefined && max !== undefined && (
        <div className="ml-[10px] flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]" style={metaStyle}>
          <span className="flex items-center gap-1.5">
            <ArrowDownToLineIcon className="h-3.5 w-3.5 shrink-0" />
            {min.toFixed(1)}
            {unit}
          </span>
          <span className="h-1 w-1 rounded-full bg-current opacity-70" />
          <span className="flex items-center gap-1.5">
            <ArrowUpToLineIcon className="h-3.5 w-3.5 shrink-0" />
            {max.toFixed(1)}
            {unit}
          </span>
          <Dialog>
            <DialogTrigger asChild>
              <button
                className="flex items-center transition-opacity hover:opacity-75"
                style={symbolStyle}
                aria-label={`Forklaring for ${label.toLowerCase()}`}
              >
                <InfoIcon className="h-4 w-4" />
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>24-timers oversikt</DialogTitle>
                <DialogDescription className="mt-4 space-y-3 text-base">
                  <div className="flex items-start gap-3">
                    <ArrowDownToLineIcon className="mt-0.5 h-5 w-5 shrink-0" />
                    <span>Viser laveste registrerte {label.toLowerCase()} siste 24 timer.</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <ArrowUpToLineIcon className="mt-0.5 h-5 w-5 shrink-0" />
                    <span>Viser høyeste registrerte {label.toLowerCase()} siste 24 timer.</span>
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
