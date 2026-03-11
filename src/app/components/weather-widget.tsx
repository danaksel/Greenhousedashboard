import { Cloud, CloudRain, Sun, CloudDrizzle, CloudSnow, CloudFog, CloudLightning, Cloudy } from "lucide-react";
import { WeatherData } from "../utils/api";

interface WeatherWidgetProps {
  data: WeatherData;
  compact?: boolean;
}

// Map symbol codes to appropriate icons
const getWeatherIcon = (symbolCode: string, compact = false) => {
  const iconClass = compact ? "w-5 h-5" : "w-8 h-8";
  const color = compact ? "text-white" : "";
  
  if (symbolCode.includes("clearsky")) {
    return <Sun className={`${iconClass} ${color || "text-[#d28c31]"}`} />;
  }
  if (symbolCode.includes("fair") || symbolCode.includes("partlycloudy")) {
    return <Cloudy className={`${iconClass} ${color || "text-gray-400"}`} />;
  }
  if (symbolCode.includes("rain")) {
    return <CloudRain className={`${iconClass} ${color || "text-blue-400"}`} />;
  }
  if (symbolCode.includes("lightrain") || symbolCode.includes("drizzle")) {
    return <CloudDrizzle className={`${iconClass} ${color || "text-blue-400"}`} />;
  }
  if (symbolCode.includes("snow")) {
    return <CloudSnow className={`${iconClass} ${color || "text-blue-200"}`} />;
  }
  if (symbolCode.includes("fog")) {
    return <CloudFog className={`${iconClass} ${color || "text-gray-400"}`} />;
  }
  if (symbolCode.includes("thunder")) {
    return <CloudLightning className={`${iconClass} ${color || "text-yellow-400"}`} />;
  }
  // Default cloudy
  return <Cloud className={`${iconClass} ${color || "text-gray-400"}`} />;
};

export function WeatherWidget({ data, compact }: WeatherWidgetProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 bg-black/20 backdrop-blur-sm rounded-md px-2 py-1.5">
        {getWeatherIcon(data.symbolCode, true)}
        <div className="flex items-baseline gap-1.5">
          <span className="text-white text-sm font-medium">{data.description}</span>
          <span className="text-white text-xs">{data.temperature.toFixed(1)}°</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {getWeatherIcon(data.symbolCode)}
          <div>
            <p className="text-sm text-gray-600">Ute</p>
            <p className="text-lg font-semibold text-gray-900">{data.description}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">{data.temperature.toFixed(1)}°C</p>
        </div>
      </div>
    </div>
  );
}