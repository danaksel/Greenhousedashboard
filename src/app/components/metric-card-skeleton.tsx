import { Card } from "./ui/card";

interface MetricCardSkeletonProps {
  darkMode?: boolean;
}

export function MetricCardSkeleton({ darkMode = false }: MetricCardSkeletonProps) {
  const bgClass = darkMode ? 'bg-[#3d4d2e]/90' : 'bg-white/90';
  const borderClass = darkMode ? 'border-white/10' : 'border-stone-200';
  const skeletonClass = darkMode ? 'bg-white/20' : 'bg-stone-200';
  
  return (
    <Card className={`p-6 ${bgClass} backdrop-blur-sm shadow-lg border ${borderClass} transition-colors duration-300`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Icon skeleton */}
          <div className={`w-8 h-8 ${skeletonClass} rounded animate-pulse`}></div>
          <div>
            {/* Label skeleton */}
            <div className={`h-4 w-24 ${skeletonClass} rounded mb-2 animate-pulse`}></div>
            {/* Value with trend icon skeleton */}
            <div className="flex items-center gap-2">
              <div className={`h-10 w-28 ${skeletonClass} rounded animate-pulse`}></div>
              <div className={`h-5 w-5 ${skeletonClass} rounded animate-pulse mt-2`}></div>
            </div>
            {/* Min/Max with icons skeleton */}
            <div className="flex items-center gap-2 mt-2">
              <div className={`h-3 w-3 ${skeletonClass} rounded animate-pulse`}></div>
              <div className={`h-3 w-12 ${skeletonClass} rounded animate-pulse`}></div>
              <div className={`h-2 w-1 ${skeletonClass} rounded-full animate-pulse`}></div>
              <div className={`h-3 w-3 ${skeletonClass} rounded animate-pulse`}></div>
              <div className={`h-3 w-12 ${skeletonClass} rounded animate-pulse`}></div>
              <div className={`h-3 w-3 ${skeletonClass} rounded animate-pulse`}></div>
            </div>
          </div>
        </div>
        {/* Status indicator skeleton */}
        <div className="flex flex-col items-center gap-1">
          <div className={`w-3 h-3 rounded-full ${skeletonClass} animate-pulse`}></div>
          <div className={`h-3 w-12 ${skeletonClass} rounded animate-pulse`}></div>
        </div>
      </div>
    </Card>
  );
}