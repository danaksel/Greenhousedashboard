export function WeatherWidgetSkeleton() {
  return (
    <div className="flex flex-col gap-2 animate-pulse">
      {/* Weather section skeleton */}
      <div className="flex flex-col gap-1 bg-black/20 backdrop-blur-sm rounded-md px-2 py-1.5">
        <div className="flex items-center gap-1.5 px-1 py-0.5">
          <div className="w-5 h-5 bg-white/20 rounded"></div>
          <div className="h-4 w-8 bg-white/20 rounded"></div>
        </div>
        {/* Rain data skeleton */}
        <div className="flex flex-col gap-0.5 mt-1 px-1 py-0.5">
          <div className="h-2 w-16 bg-white/15 rounded"></div>
          <div className="h-3 w-12 bg-white/20 rounded"></div>
        </div>
      </div>
      
      {/* Sun times section skeleton */}
      <div className="flex flex-col gap-1 bg-black/15 backdrop-blur-sm rounded-md px-2 py-1.5">
        <div className="flex items-center justify-between px-1 py-0.5">
          <div className="w-3 h-3 bg-white/20 rounded"></div>
          <div className="h-3 w-10 bg-white/20 rounded"></div>
        </div>
        <div className="flex items-center justify-between px-1 py-0.5">
          <div className="w-3 h-3 bg-white/20 rounded"></div>
          <div className="h-3 w-10 bg-white/20 rounded"></div>
        </div>
        <div className="flex items-center justify-between px-1 py-0.5">
          <div className="h-3 w-6 bg-white/20 rounded"></div>
          <div className="h-3 w-6 bg-white/20 rounded"></div>
        </div>
      </div>
    </div>
  );
}