import { useState } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

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
}

export function DeviceStatusRow({ items, darkMode = false, desktopCardLayout = false }: DeviceStatusRowProps) {
  const [openTooltip, setOpenTooltip] = useState<string | null>(null);
  const labelColor = darkMode ? "text-white/45" : "text-stone-500";
  const labelClass = `text-[10px] uppercase tracking-[0.02em] leading-[1.15] whitespace-nowrap ${labelColor}`;
  const rowClass = desktopCardLayout
    ? "mb-8 flex items-start justify-center gap-7 pt-2 md:mb-0 md:gap-6 md:pt-0 xl:gap-10"
    : "mb-8 flex items-start justify-center gap-7 pt-2 md:mb-0 md:justify-start md:gap-6 md:pt-0";

  return (
    <div className={rowClass}>
      {items.map((item) => (
        <div
          key={item.label}
          className={`flex w-[110px] flex-col items-center text-center ${
            desktopCardLayout
              ? "md:w-[110px]"
              : "md:w-[100px]"
          }`}
        >
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
                  <img
                    src={item.iconSrc}
                    alt={item.label}
                    className={`max-h-full max-w-full object-contain ${item.spinning ? "animate-spin [animation-duration:2.4s]" : ""}`}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={-8}>
                {item.tooltip}
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex h-[72px] w-[72px] items-center justify-center">
              <img
                src={item.iconSrc}
                alt={item.label}
                className={`max-h-full max-w-full object-contain ${item.spinning ? "animate-spin [animation-duration:2.4s]" : ""}`}
              />
            </div>
          )}
          <div className="mt-2 flex h-[28px] items-start justify-center">
            <p className={labelClass}>{item.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
