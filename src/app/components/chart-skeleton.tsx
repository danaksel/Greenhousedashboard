interface ChartSkeletonProps {
  darkMode?: boolean;
}

export function ChartSkeleton({ darkMode = false }: ChartSkeletonProps) {
  const bgClass = darkMode ? 'bg-[#2d3a21]' : 'bg-[#ebeee8]';
  const skeletonClass = darkMode ? 'bg-white/20' : 'bg-stone-300';
  
  return (
    <div className={`p-6 ${bgClass} rounded-lg shadow-md transition-colors duration-300`}>
      <div className={`h-5 w-32 ${skeletonClass} rounded mb-4 animate-pulse`}></div>
      <div className={`h-48 w-full ${skeletonClass} rounded animate-pulse`}></div>
    </div>
  );
}