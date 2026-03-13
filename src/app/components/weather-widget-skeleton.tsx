export function WeatherWidgetSkeleton() {
  return (
    <div className="flex flex-col gap-2 animate-pulse">
      {/* Weather section skeleton */}
      <div className="flex items-center gap-1.5 bg-black/20 backdrop-blur-sm rounded-md px-2 py-1 h-8 w-16">
        <div className="w-5 h-5 bg-white/20 rounded"></div>
        <div className="h-4 w-8 bg-white/20 rounded"></div>
      </div>
      
      {/* Sun times section skeleton */}
      <div className="flex flex-col gap-1 bg-black/15 backdrop-blur-sm rounded-md px-2 py-1.5 w-20">
        <div className="flex items-center justify-between">
          <div className="w-3 h-3 bg-white/20 rounded"></div>
          <div className="h-3 w-10 bg-white/20 rounded"></div>
        </div>
        <div className="flex items-center justify-between">
          <div className="w-3 h-3 bg-white/20 rounded"></div>
          <div className="h-3 w-10 bg-white/20 rounded"></div>
        </div>
        <div className="flex items-center justify-between mt-0.5 pt-1 border-t border-white/20">
          <div className="h-3 w-6 bg-white/20 rounded"></div>
          <div className="h-3 w-6 bg-white/20 rounded"></div>
        </div>
      </div>
    </div>
  );
}
