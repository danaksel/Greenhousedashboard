import { useState } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import type { DisplayThemeConfig } from "../utils/api";

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

interface DeviceStatusItem {
  id?: string;
  iconSrc: string;
  label: string;
  spinning?: boolean;
  tooltip?: string;
}

interface DeviceStatusRowProps {
  items: DeviceStatusItem[];
  darkMode?: boolean;
  desktopCardLayout?: boolean;
  theme?: DisplayThemeConfig;
}

export function DeviceStatusRow({ items, darkMode = false, desktopCardLayout = false, theme }: DeviceStatusRowProps) {
  const [openTooltip, setOpenTooltip] = useState<string | null>(null);
  const modeTheme = theme ? (darkMode ? theme.dark : theme.light) : null;
  const labelColor = modeTheme?.mutedColor;
  const labelClass = `text-[10px] uppercase tracking-[0.02em] leading-[1.15] whitespace-nowrap md:text-[12px] ${
    labelColor ? "" : darkMode ? "text-white/45" : "text-stone-500"
  }`;
  const rowClass = desktopCardLayout
    ? "mb-8 flex items-start justify-center gap-7 pt-2 md:mb-0 md:grid md:w-full md:grid-cols-3 md:items-stretch md:gap-6 md:pt-0 xl:gap-10"
    : "mb-8 flex items-start justify-center gap-7 pt-2 md:mb-0 md:justify-start md:gap-6 md:pt-0";

  return (
    <div className={rowClass}>
      {items.map((item) => {
        const configuredIconColor =
          item.id === "door"
            ? modeTheme?.doorIconColor
            : item.id === "window"
              ? modeTheme?.windowIconColor
              : item.id === "fan"
                ? modeTheme?.fanIconColor
                : undefined;
        const iconColor = isHexColor(configuredIconColor) ? configuredIconColor : "";
        const maskSize =
          item.id === "window"
            ? { width: 67, height: 56 }
            : { width: 54, height: 54 };
        const icon = iconColor ? (
          <span
            className={`block max-h-full max-w-full ${item.spinning ? "animate-spin [animation-duration:2.4s]" : ""}`}
            style={{
              backgroundColor: iconColor,
              ...maskSize,
              WebkitMask: `url("${item.iconSrc}") center / contain no-repeat`,
              mask: `url("${item.iconSrc}") center / contain no-repeat`,
            }}
            aria-hidden="true"
          />
        ) : (
          <img
            src={item.iconSrc}
            alt={item.label}
            className={`max-h-full max-w-full object-contain ${item.spinning ? "animate-spin [animation-duration:2.4s]" : ""}`}
          />
        );

        return (
        <div
          key={item.label}
          className={`flex w-[110px] flex-col items-center text-center ${
            desktopCardLayout
              ? "md:grid md:w-full md:grid-rows-[12px_72px_18px] md:items-center md:justify-items-center md:gap-y-3"
              : "md:w-[100px]"
          }`}
        >
          {desktopCardLayout && <span className="hidden md:block" aria-hidden="true" />}
          {item.tooltip ? (
            <Tooltip
              open={openTooltip === item.label}
              onOpenChange={(open) => setOpenTooltip(open ? item.label : null)}
            >
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setOpenTooltip(openTooltip === item.label ? null : item.label)}
                  className="flex h-[72px] w-[72px] items-center justify-center"
                  aria-label={item.label}
                >
                  {icon}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={-8}>
                {item.tooltip}
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex h-[72px] w-[72px] items-center justify-center">
              {icon}
            </div>
          )}
          <div className="mt-2 flex h-[28px] w-full items-start justify-center text-center md:mt-0 md:h-auto">
            <p className={labelClass} style={labelColor ? { color: labelColor } : undefined}>{item.label}</p>
          </div>
        </div>
        );
      })}
    </div>
  );
}
