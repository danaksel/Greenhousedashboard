import { getResolvedDisplayTheme } from "../../shared/display-theme";
import type { DisplayThemeConfig } from "../utils/api";

interface ChartSkeletonProps {
  darkMode?: boolean;
  theme?: DisplayThemeConfig;
}

export function ChartSkeleton({ darkMode = false, theme }: ChartSkeletonProps) {
  const modeTheme = darkMode ? getResolvedDisplayTheme(theme).dark : getResolvedDisplayTheme(theme).light;
  const mutedColor = `${modeTheme.mutedColor}33`;
  const lineColor = "#d28c31";
  const gridColor = `${modeTheme.graphPanelBorder}45`;
  const dotColor = darkMode ? "#8fbc5f" : "#5d7342";
  
  return (
    <div className="overflow-hidden rounded-lg border p-4 shadow-md transition-colors duration-300" style={{ backgroundColor: modeTheme.graphPanelBg, borderColor: modeTheme.graphPanelBorder }}>
      <div className="mb-4 flex items-center justify-between">
        <div className="h-4 w-36 animate-pulse rounded-full" style={{ backgroundColor: mutedColor }} />
        <div className="h-8 w-[132px] animate-pulse rounded-full" style={{ backgroundColor: mutedColor }} />
      </div>

      <div className="relative h-48 overflow-hidden rounded-md md:h-[260px]">
        <div
          className="absolute inset-0 opacity-80"
          style={{
            backgroundImage: `linear-gradient(${gridColor} 1px, transparent 1px), linear-gradient(90deg, ${gridColor} 1px, transparent 1px)`,
            backgroundSize: "100% 34px, 48px 100%",
          }}
        />
        <div className="absolute inset-x-4 bottom-6 top-5">
          <svg className="h-full w-full" viewBox="0 0 300 120" preserveAspectRatio="none" aria-hidden="true">
            <path
              d="M0 86 C28 68 42 74 62 55 C84 34 102 48 122 62 C144 78 160 76 182 52 C206 25 230 38 252 49 C274 60 284 52 300 36"
              fill="none"
              stroke={lineColor}
              strokeLinecap="round"
              strokeWidth="4"
              opacity="0.28"
            />
            <path
              d="M0 86 C28 68 42 74 62 55 C84 34 102 48 122 62 C144 78 160 76 182 52 C206 25 230 38 252 49 C274 60 284 52 300 36"
              fill="none"
              stroke={lineColor}
              strokeLinecap="round"
              strokeWidth="4"
              strokeDasharray="70 260"
              className="animate-[chart-line-scan_1.8s_ease-in-out_infinite]"
            />
            {[0, 62, 122, 182, 252, 300].map((x, index) => (
              <circle
                key={x}
                cx={x}
                cy={[86, 55, 62, 52, 49, 36][index]}
                r="4"
                fill={dotColor}
                opacity="0.35"
                className="animate-pulse"
                style={{ animationDelay: `${index * 120}ms` }}
              />
            ))}
          </svg>
        </div>

        <div className="absolute inset-x-0 top-0 h-full translate-x-[-60%] bg-linear-to-r from-transparent via-white/10 to-transparent animate-[chart-sheen_2.4s_ease-in-out_infinite]" />
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2 pb-1 text-xs" style={{ color: modeTheme.mutedColor }}>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ backgroundColor: modeTheme.symbolColor }} />
          Henter historikk
        </div>
      </div>
    </div>
  );
}
