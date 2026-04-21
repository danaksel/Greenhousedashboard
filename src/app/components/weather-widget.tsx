import { WeatherData } from "../utils/api";
import SunCalc from "suncalc";
import { useState } from "react";
import { CloudDrizzleIcon, CloudFogIcon, CloudIcon, CloudLightningIcon, CloudRainIcon, CloudSnowIcon, CloudyIcon, SunIcon, SunriseIcon, SunsetIcon } from "./icons";

interface WeatherWidgetProps {
  data: WeatherData;
  compact?: boolean;
  rainToday?: number | null;
}

// Map symbol codes to appropriate icons
const getWeatherIcon = (symbolCode: string, compact = false) => {
  const iconClass = compact ? "w-5 h-5" : "w-8 h-8";
  const color = compact ? "text-white" : "";
  
  // Thunder variants (check first since they can contain rain/snow/sleet)
  if (symbolCode.includes("thunder")) {
    return <CloudLightningIcon className={`${iconClass} ${color || "text-yellow-400"}`} />;
  }
  
  // Snow variants
  if (symbolCode.includes("snow")) {
    return <CloudSnowIcon className={`${iconClass} ${color || "text-blue-200"}`} />;
  }
  
  // Sleet variants
  if (symbolCode.includes("sleet")) {
    return <CloudSnowIcon className={`${iconClass} ${color || "text-blue-300"}`} />;
  }
  
  // Rain variants (heavyrain before rain to match correctly)
  if (symbolCode.includes("heavyrain")) {
    return <CloudRainIcon className={`${iconClass} ${color || "text-blue-500"}`} />;
  }
  if (symbolCode.includes("rain")) {
    return <CloudRainIcon className={`${iconClass} ${color || "text-blue-400"}`} />;
  }
  if (symbolCode.includes("drizzle")) {
    return <CloudDrizzleIcon className={`${iconClass} ${color || "text-blue-400"}`} />;
  }
  
  // Fog
  if (symbolCode.includes("fog")) {
    return <CloudFogIcon className={`${iconClass} ${color || "text-gray-400"}`} />;
  }
  
  // Clear sky
  if (symbolCode.includes("clearsky")) {
    return <SunIcon className={`${iconClass} ${color || "text-[#d28c31]"}`} />;
  }
  
  // Fair or partly cloudy
  if (symbolCode.includes("fair") || symbolCode.includes("partlycloudy")) {
    return <CloudyIcon className={`${iconClass} ${color || "text-gray-400"}`} />;
  }
  
  // Default cloudy
  return <CloudIcon className={`${iconClass} ${color || "text-gray-400"}`} />;
};

export function WeatherWidget({ data, compact, rainToday }: WeatherWidgetProps) {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const formatTime = (date: Date | undefined) => {
    if (!date) return '--:--';
    return date.toLocaleTimeString('nb-NO', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Calculate sun times for Høybråten, Nesodden
  const lat = 59.8667;
  const lon = 10.7167;
  const now = new Date();
  const sunTimes = SunCalc.getTimes(now, lat, lon);

  // Use live UV data, or 0 if not available
  const displayUvIndex = data.uvIndex ?? 0;

  const handleTooltipClick = (id: string) => {
    setActiveTooltip(activeTooltip === id ? null : id);
  };

  if (compact) {
    return (
      <div className="flex flex-col gap-2">
        {/* Weather section */}
        <div className="flex flex-col gap-1 bg-black/20 backdrop-blur-sm rounded-md px-2 py-1.5">
          <div className="relative">
            <button
              onClick={() => handleTooltipClick('weather')}
              className="w-full flex items-center gap-1.5 touch-manipulation active:bg-white/5 rounded px-1 py-0.5 transition-colors"
            >
              {getWeatherIcon(data.symbolCode, true)}
              <span className="text-white text-sm font-medium">{data.temperature.toFixed(1)}°</span>
            </button>
            {activeTooltip === 'weather' && (
              <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 bg-black/90 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap z-50 pointer-events-none before:content-[''] before:absolute before:left-full before:top-1/2 before:-translate-y-1/2 before:border-4 before:border-transparent before:border-l-black/90">
                {data.description}
              </div>
            )}
          </div>
          {rainToday !== null && rainToday !== undefined && (
            <div className="relative">
              <button
                onClick={() => handleTooltipClick('rain')}
                className="w-full flex flex-col gap-0.5 mt-1 text-left touch-manipulation active:bg-white/5 rounded px-1 py-0.5 transition-colors"
              >
                <span className="text-white/70 text-[9px]">Akkumulert:</span>
                <span className="text-white text-xs font-medium">{rainToday.toFixed(1)} mm</span>
              </button>
              {activeTooltip === 'rain' && (
                <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 bg-black/90 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap z-50 pointer-events-none before:content-[''] before:absolute before:left-full before:top-1/2 before:-translate-y-1/2 before:border-4 before:border-transparent before:border-l-black/90">
                  Total nedbør fra midnatt til nå. Måles i Kristins hage.
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Sun times section */}
        <div className="flex flex-col gap-1 bg-black/15 backdrop-blur-sm rounded-md px-2 py-1.5 text-white/90">
          <div className="relative">
            <button
              onClick={() => handleTooltipClick('sunrise')}
              className="w-full flex items-center justify-between text-[11px] touch-manipulation active:bg-white/5 rounded px-1 py-0.5 transition-colors"
            >
              <SunriseIcon className="w-3 h-3" />
              <span className="font-medium">{formatTime(sunTimes.sunrise)}</span>
            </button>
            {activeTooltip === 'sunrise' && (
              <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 bg-black/90 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap z-50 pointer-events-none before:content-[''] before:absolute before:left-full before:top-1/2 before:-translate-y-1/2 before:border-4 before:border-transparent before:border-l-black/90">
                Soloppgang
              </div>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => handleTooltipClick('sunset')}
              className="w-full flex items-center justify-between text-[11px] touch-manipulation active:bg-white/5 rounded px-1 py-0.5 transition-colors"
            >
              <SunsetIcon className="w-3 h-3" />
              <span className="font-medium">{formatTime(sunTimes.sunset)}</span>
            </button>
            {activeTooltip === 'sunset' && (
              <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 bg-black/90 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap z-50 pointer-events-none before:content-[''] before:absolute before:left-full before:top-1/2 before:-translate-y-1/2 before:border-4 before:border-transparent before:border-l-black/90">
                Solnedgang
              </div>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => handleTooltipClick('uv')}
              className="w-full flex items-center justify-between text-[11px] touch-manipulation active:bg-white/5 rounded px-1 py-0.5 transition-colors"
            >
              <span className="opacity-90">UV</span>
              <span className="font-medium">{displayUvIndex.toFixed(1)}</span>
            </button>
            {activeTooltip === 'uv' && (
              <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 bg-black/90 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap z-50 pointer-events-none before:content-[''] before:absolute before:left-full before:top-1/2 before:-translate-y-1/2 before:border-4 before:border-transparent before:border-l-black/90">
                UV akkurat nå
              </div>
            )}
          </div>
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
