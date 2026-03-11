export function ChartSkeleton() {
  return (
    <div className="p-6 bg-[#ebeee8] rounded-lg shadow-md">
      <div className="h-5 w-32 bg-stone-300 rounded mb-4 animate-pulse"></div>
      <div className="h-48 w-full bg-stone-300 rounded animate-pulse"></div>
    </div>
  );
}
