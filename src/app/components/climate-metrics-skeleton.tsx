interface ClimateMetricsSkeletonProps {
  darkMode?: boolean;
}

export function ClimateMetricsSkeleton({ darkMode = false }: ClimateMetricsSkeletonProps) {
  const skeletonClass = darkMode ? "bg-white/14" : "bg-stone-200";
  const subtleSkeletonClass = darkMode ? "bg-white/10" : "bg-stone-200/80";

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <div className={`h-4 w-20 rounded-full ${subtleSkeletonClass} animate-pulse`} />
            <div className="flex items-end gap-1 sm:gap-1.5">
              <div className={`h-[56px] w-[76px] rounded-2xl ${skeletonClass} animate-pulse sm:h-[64px] sm:w-[88px]`} />
              <div className={`h-[28px] w-[24px] rounded-xl ${subtleSkeletonClass} animate-pulse sm:h-[32px] sm:w-[28px]`} />
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
              <div className={`h-3.5 w-14 rounded-full ${subtleSkeletonClass} animate-pulse`} />
              <div className={`h-1 w-1 rounded-full ${subtleSkeletonClass} animate-pulse`} />
              <div className={`h-3.5 w-14 rounded-full ${subtleSkeletonClass} animate-pulse`} />
              <div className={`h-4 w-4 rounded-full ${subtleSkeletonClass} animate-pulse`} />
            </div>
          </div>
        ))}
      </div>

      <div className="mb-8 flex items-start justify-center gap-10 pt-10">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex w-[92px] flex-col items-center gap-2 text-center">
            <div className={`flex h-[72px] w-[72px] items-center justify-center rounded-full ${skeletonClass} animate-pulse`}>
              <div className={`h-9 w-9 rounded-2xl ${subtleSkeletonClass} animate-pulse`} />
            </div>
            <div className={`h-3 w-16 rounded-full ${subtleSkeletonClass} animate-pulse`} />
          </div>
        ))}
      </div>
    </div>
  );
}
