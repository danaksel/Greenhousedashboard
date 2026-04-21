interface ClimateMetricsSkeletonProps {
  darkMode?: boolean;
}

export function ClimateMetricsSkeleton({ darkMode = false }: ClimateMetricsSkeletonProps) {
  const skeletonClass = darkMode ? "bg-white/14" : "bg-stone-200";

  return (
    <div className="mb-8 grid grid-cols-2 gap-6 sm:gap-8">
      {Array.from({ length: 2 }).map((_, index) => (
        <div key={index} className="space-y-3">
          <div className={`h-24 w-full rounded ${skeletonClass} animate-pulse sm:h-32`} />
          <div className="flex items-center gap-3">
            <div className={`h-6 w-20 rounded ${skeletonClass} animate-pulse`} />
            <div className={`h-2 w-2 rounded-full ${skeletonClass} animate-pulse`} />
            <div className={`h-6 w-24 rounded ${skeletonClass} animate-pulse`} />
            <div className={`h-5 w-5 rounded-full ${skeletonClass} animate-pulse`} />
          </div>
        </div>
      ))}
    </div>
  );
}
