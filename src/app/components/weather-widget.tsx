import { WeatherData } from "../utils/api";
import SunCalc from "suncalc";
import { useState } from "react";
import { CloudDrizzleIcon, CloudFogIcon, CloudIcon, CloudLightningIcon, CloudRainIcon, CloudSnowIcon, CloudyIcon, SunIcon, SunriseIcon, SunsetIcon } from "./icons";

interface WeatherWidgetProps {
  data: WeatherData;
  compact?: boolean;
  rainToday?: number | null;
  rainHour?: number | null;
}

// Map symbol codes to appropriate icons
const getWeatherIcon = (symbolCode: string, compact = false, forceWhite = false, iconClassOverride?: string) => {
  const iconClass = iconClassOverride ?? (compact ? "w-5 h-5" : "w-8 h-8");
  const color = compact || forceWhite ? "text-white" : "";
  
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

export function WeatherWidget({ data, compact, rainToday, rainHour }: WeatherWidgetProps) {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const isRainingNow = typeof rainHour === "number" && rainHour > 0;
  const hasRainedToday = typeof rainToday === "number" && rainToday > 0;
  const showRain = isRainingNow || hasRainedToday;
  const showUv = !isRainingNow;

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
      <div className="h-full">
        <div className="hidden h-full w-[176px] flex-col gap-1.5 rounded-2xl bg-black/20 p-2.5 text-white shadow-xl shadow-black/15 backdrop-blur-sm md:flex xl:w-[204px] xl:gap-3 xl:p-4">
          <button
            type="button"
            onClick={() => handleTooltipClick('weather')}
            className="rounded-lg px-1 py-0.5 text-left transition hover:bg-white/5 xl:py-1"
          >
            <div className="min-w-0">
              <p className="text-[9px] uppercase leading-none tracking-[0.02em] text-white xl:text-[10px]">Ute nå</p>
              <p className="mt-0.5 line-clamp-2 text-sm font-semibold leading-tight xl:mt-1 xl:text-base">{data.description}</p>
              <div className="mt-1 flex items-center gap-2 xl:mt-1.5">
                {getWeatherIcon(data.symbolCode, true, true, "h-9 w-9 xl:h-10 xl:w-10")}
                <p className="text-[36px] font-light leading-none xl:text-4xl">{data.temperature.toFixed(1)}°</p>
              </div>
              {showUv && (
                <p className="mt-1 text-[9px] uppercase leading-tight tracking-[0.02em] text-white xl:text-[10px]">
                  UV <span className="font-semibold">{displayUvIndex.toFixed(1)}</span>
                </p>
              )}
            </div>
          </button>

          {showRain && (
            <button
              type="button"
              onClick={() => handleTooltipClick('rain')}
              className="grid grid-cols-2 gap-2 rounded-lg px-1 py-0.5 text-left transition hover:bg-white/5 xl:gap-3 xl:py-1"
            >
              {rainToday !== null && rainToday !== undefined && (
                <div>
                  <span className="block max-w-[10rem] text-[9px] uppercase leading-tight tracking-[0.02em] text-white xl:text-[10px]">
                    I dag
                  </span>
                  <span className="mt-0.5 block text-sm font-semibold leading-none xl:mt-1 xl:text-base">{rainToday.toFixed(1)} mm</span>
                </div>
              )}
              {rainHour !== null && rainHour !== undefined && (
                <div>
                  <span className="block max-w-[10rem] text-[9px] uppercase leading-tight tracking-[0.02em] text-white xl:text-[10px]">
                    Siste time
                  </span>
                  <span className="mt-0.5 block text-sm font-semibold leading-none xl:mt-1 xl:text-base">{rainHour.toFixed(1)} mm/t</span>
                </div>
              )}
            </button>
          )}

          <div className="grid grid-cols-2 gap-1.5 xl:gap-2">
            <button
              type="button"
              onClick={() => handleTooltipClick('sunrise')}
              className="flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-left transition hover:bg-white/5 xl:gap-2 xl:py-1"
              aria-label={`Soloppgang ${formatTime(sunTimes.sunrise)}`}
            >
              <SunriseIcon className="h-3.5 w-3.5 shrink-0 xl:h-4 xl:w-4" />
              <span className="text-sm font-semibold leading-none">{formatTime(sunTimes.sunrise)}</span>
            </button>
            <button
              type="button"
              onClick={() => handleTooltipClick('sunset')}
              className="flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-left transition hover:bg-white/5 xl:gap-2 xl:py-1"
              aria-label={`Solnedgang ${formatTime(sunTimes.sunset)}`}
            >
              <SunsetIcon className="h-3.5 w-3.5 shrink-0 xl:h-4 xl:w-4" />
              <span className="text-sm font-semibold leading-none">{formatTime(sunTimes.sunset)}</span>
            </button>
          </div>

          {activeTooltip === 'rain' && (
            <p className="rounded-lg bg-black/25 px-3 py-2 text-xs text-white">
              Nedbør siden midnatt og siste time. Måles i Kristins hage.
            </p>
          )}
        </div>

      <div className="w-[136px] rounded-xl bg-black/25 p-2.5 text-white shadow-lg shadow-black/10 backdrop-blur-sm md:hidden">
        <button
          type="button"
          onClick={() => handleTooltipClick('weather')}
          className="w-full rounded-md text-left touch-manipulation transition-colors active:bg-white/5"
          aria-label={`${data.description} ${data.temperature.toFixed(1)}°`}
        >
          <span className="flex items-center gap-1.5">
            {getWeatherIcon(data.symbolCode, true, true, "h-6 w-6")}
            <span className="text-[23px] font-light leading-none">{data.temperature.toFixed(1)}°</span>
          </span>
        </button>

        {showUv && (
          <div className="relative mt-1.5">
            <button
              type="button"
              onClick={() => handleTooltipClick('uv')}
              className="rounded px-0.5 text-[8px] font-semibold uppercase leading-none tracking-[0.03em] touch-manipulation transition-colors active:bg-white/5"
            >
              UV {displayUvIndex.toFixed(1)}
            </button>
            {activeTooltip === 'uv' && (
              <div className="absolute right-full top-1/2 z-50 mr-2 -translate-y-1/2 whitespace-nowrap rounded bg-black/90 px-2 py-1 text-[10px] text-white shadow-lg pointer-events-none before:absolute before:left-full before:top-1/2 before:-translate-y-1/2 before:border-4 before:border-transparent before:border-l-black/90">
                UV akkurat nå
              </div>
            )}
          </div>
        )}

        {showRain && (
          <div className="relative mt-2.5">
            <button
              type="button"
              onClick={() => handleTooltipClick('rain')}
              className="grid w-full grid-cols-2 gap-1 rounded text-left touch-manipulation transition-colors active:bg-white/5"
            >
              {rainToday !== null && rainToday !== undefined && (
                <span className="min-w-0">
                  <span className="block text-[7px] font-medium uppercase leading-none tracking-[0.03em] text-white/85">I dag</span>
                  <span className="mt-1 block whitespace-nowrap text-[10px] font-semibold leading-none">{rainToday.toFixed(1)} mm</span>
                </span>
              )}
              {rainHour !== null && rainHour !== undefined && (
                <span className="min-w-0">
                  <span className="block text-[7px] font-medium uppercase leading-none tracking-[0.03em] text-white/85">Siste time</span>
                  <span className="mt-1 block whitespace-nowrap text-[10px] font-semibold leading-none">{rainHour.toFixed(1)} mm/t</span>
                </span>
              )}
            </button>
            {activeTooltip === 'rain' && (
              <div className="absolute right-full top-1/2 z-50 mr-2 -translate-y-1/2 whitespace-nowrap rounded bg-black/90 px-2 py-1 text-[10px] text-white shadow-lg pointer-events-none before:absolute before:left-full before:top-1/2 before:-translate-y-1/2 before:border-4 before:border-transparent before:border-l-black/90">
                Nedbør siden midnatt og siste time. Måles i Kristins hage.
              </div>
            )}
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-1 text-white/90">
          <button
            type="button"
            onClick={() => handleTooltipClick('sunrise')}
            className="flex min-w-0 items-center gap-1 rounded text-[10px] touch-manipulation transition-colors active:bg-white/5"
            aria-label={`Soloppgang ${formatTime(sunTimes.sunrise)}`}
          >
            <SunriseIcon className="h-3 w-3 shrink-0" />
            <span className="font-semibold leading-none">{formatTime(sunTimes.sunrise)}</span>
          </button>
          <button
            type="button"
            onClick={() => handleTooltipClick('sunset')}
            className="flex min-w-0 items-center gap-1 rounded text-[10px] touch-manipulation transition-colors active:bg-white/5"
            aria-label={`Solnedgang ${formatTime(sunTimes.sunset)}`}
          >
            <SunsetIcon className="h-3 w-3 shrink-0" />
            <span className="font-semibold leading-none">{formatTime(sunTimes.sunset)}</span>
          </button>
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
