import { getResolvedDisplayTheme } from "../../shared/display-theme";
import type { DisplayThemeConfig } from "../utils/api";

interface ClimateMetricsSkeletonProps {
  darkMode?: boolean;
  theme?: DisplayThemeConfig;
}

export function ClimateMetricsSkeleton({ darkMode = false, theme }: ClimateMetricsSkeletonProps) {
  const modeTheme = darkMode ? getResolvedDisplayTheme(theme).dark : getResolvedDisplayTheme(theme).light;
  const skeletonStyle = { backgroundColor: `${modeTheme.defaultValueColor}24` };
  const subtleSkeletonStyle = { backgroundColor: `${modeTheme.mutedColor}26` };

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <div className="h-4 w-20 animate-pulse rounded-full" style={subtleSkeletonStyle} />
            <div className="flex items-end gap-1 sm:gap-1.5">
              <div className="h-[56px] w-[76px] animate-pulse rounded-2xl sm:h-[64px] sm:w-[88px]" style={skeletonStyle} />
              <div className="h-[28px] w-[24px] animate-pulse rounded-xl sm:h-[32px] sm:w-[28px]" style={subtleSkeletonStyle} />
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
              <div className="h-3.5 w-14 animate-pulse rounded-full" style={subtleSkeletonStyle} />
              <div className="h-1 w-1 animate-pulse rounded-full" style={subtleSkeletonStyle} />
              <div className="h-3.5 w-14 animate-pulse rounded-full" style={subtleSkeletonStyle} />
              <div className="h-4 w-4 animate-pulse rounded-full" style={subtleSkeletonStyle} />
            </div>
          </div>
        ))}
      </div>

      <div className="mb-8 flex items-start justify-center gap-10 pt-10">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex w-[92px] flex-col items-center gap-2 text-center">
            <div className="flex h-[72px] w-[72px] animate-pulse items-center justify-center rounded-full" style={skeletonStyle}>
              <div className="h-9 w-9 animate-pulse rounded-2xl" style={subtleSkeletonStyle} />
            </div>
            <div className="h-3 w-16 animate-pulse rounded-full" style={subtleSkeletonStyle} />
          </div>
        ))}
      </div>
    </div>
  );
}
