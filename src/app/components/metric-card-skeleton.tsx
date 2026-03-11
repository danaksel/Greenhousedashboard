import { Card } from "./ui/card";

export function MetricCardSkeleton() {
  return (
    <Card className="p-6 bg-white/90 backdrop-blur-sm shadow-lg border border-stone-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-stone-200 rounded animate-pulse"></div>
          <div>
            <div className="h-4 w-24 bg-stone-200 rounded mb-2 animate-pulse"></div>
            <div className="h-10 w-32 bg-stone-200 rounded animate-pulse"></div>
            <div className="h-3 w-40 bg-stone-200 rounded mt-2 animate-pulse"></div>
          </div>
        </div>
        <div className="flex flex-col items-center">
          <div className="w-3 h-3 rounded-full bg-stone-200 animate-pulse"></div>
          <div className="h-3 w-12 bg-stone-200 rounded mt-1 animate-pulse"></div>
        </div>
      </div>
    </Card>
  );
}
