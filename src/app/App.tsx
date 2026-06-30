import { lazy, Suspense, useEffect, useState } from "react";
import { ChartSkeleton } from "./components/chart-skeleton";
import { fetchLatestGreenhouseData, fetchGreenhouseHistory, fetchGreenhouseStats24h, fetchWeatherData, type WeatherData } from "./utils/api";
import { ImageWithFallback } from "./components/figma/ImageWithFallback";
import { GreenhouseIcon } from "./components/greenhouse-icon";
import { WeatherWidgetSkeleton } from "./components/weather-widget-skeleton";
import { thresholds } from "../config/thresholds";
import { ClimateMetric } from "./components/climate-metric";
import { ClimateMetricsSkeleton } from "./components/climate-metrics-skeleton";
import { DeviceStatusRow } from "./components/device-status-row";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, MoonIcon, RefreshCwIcon, SunIcon, WifiOffIcon } from "./components/icons";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "./components/ui/carousel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";

const loadTrendChart = async () => {
  const module = await import("./components/trend-chart");
  return { default: module.TrendChart };
};

const TrendChart = lazy(loadTrendChart);

const WeatherWidget = lazy(async () => {
  const module = await import("./components/weather-widget");
  return { default: module.WeatherWidget };
});

type ChartPoint = { time: string; value: number; min?: number; max?: number; range?: [number, number]; id: string };
type HistoryPoint = { time: string; value: number | null; min?: number | null; max?: number | null; timestamp: string | null; bucketStart: string | null };
type MetricMinMax = { min: number | undefined; max: number | undefined };
type ChartRange = "12h" | "24h";

function buildPreviewPath(data: ChartPoint[], width: number, height: number, padding: number) {
  const points = data.filter((point) => Number.isFinite(point.value));
  if (points.length < 2) return "";

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  return points
    .map((point, index) => {
      const x = padding + (index / (points.length - 1)) * innerWidth;
      const y = padding + (1 - (point.value - min) / range) * innerHeight;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function CollapsedChartPreview({
  temperatureData,
  humidityData,
  darkMode,
  loading,
  onClick,
}: {
  temperatureData: ChartPoint[];
  humidityData: ChartPoint[];
  darkMode: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  const width = 320;
  const height = 58;
  const tempPath = buildPreviewPath(temperatureData, width, height, 8);
  const humidityPath = buildPreviewPath(humidityData, width, height, 8);
  const hasData = tempPath || humidityPath;

  return (
    <button
      type="button"
      className={`group relative h-[66px] w-full overflow-hidden rounded-xl border px-4 py-2 text-left transition-all ${
        darkMode
          ? "border-white/10 bg-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-white/8"
          : "border-[#d8ded1] bg-white/55 shadow-sm hover:bg-white/70"
      }`}
      onClick={onClick}
      aria-label="Åpne grafer"
    >
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-8 ${
          darkMode
            ? "bg-linear-to-t from-[#2d3a21]/70 to-transparent"
            : "bg-linear-to-t from-[#e8ede3]/80 to-transparent"
        }`}
      />
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className={`absolute inset-x-3 top-1 h-[58px] w-[calc(100%-1.5rem)] ${loading ? "animate-pulse" : ""}`}
        aria-hidden="true"
      >
        <path
          d="M 8 44 C 55 18, 88 24, 126 30 S 195 46, 238 28 S 292 20, 312 32"
          fill="none"
          stroke={darkMode ? "rgba(255,255,255,0.09)" : "rgba(93,115,66,0.13)"}
          strokeWidth="10"
          strokeLinecap="round"
        />
        {hasData ? (
          <>
            {humidityPath && (
              <path
                d={humidityPath}
                fill="none"
                stroke={darkMode ? "#8fbc5f" : "#5d7342"}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={darkMode ? 0.75 : 0.65}
              />
            )}
            {tempPath && (
              <path
                d={tempPath}
                fill="none"
                stroke="#d28c31"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.85}
              />
            )}
          </>
        ) : (
          <>
            <path
              d="M 8 38 C 58 22, 96 18, 142 28 S 224 42, 312 20"
              fill="none"
              stroke="#d28c31"
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.65"
            />
            <path
              d="M 8 24 C 64 36, 112 40, 156 30 S 232 16, 312 28"
              fill="none"
              stroke={darkMode ? "#8fbc5f" : "#5d7342"}
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.55"
            />
          </>
        )}
      </svg>
      <div className="relative z-10 flex h-full items-end">
        <div className={`flex items-center gap-3 text-[11px] font-medium ${darkMode ? "text-white/55" : "text-[#66735d]"}`}>
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-[#d28c31]" />
            Temp
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`size-1.5 rounded-full ${darkMode ? "bg-[#8fbc5f]" : "bg-[#5d7342]"}`} />
            Fukt
          </span>
        </div>
      </div>
    </button>
  );
}

export default function App() {
  const [temperature, setTemperature] = useState<number | null>(null);
  const [humidity, setHumidity] = useState<number | null>(null);
  const [rainToday, setRainToday] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [door, setDoor] = useState<"open" | "closed" | null>(null);
  const [doorUpdatedAt, setDoorUpdatedAt] = useState<string | null>(null);
  const [windowCount, setWindowCount] = useState<number | null>(null);
  const [windowUpdatedAt, setWindowUpdatedAt] = useState<string | null>(null);
  const [fan, setFan] = useState<"on" | "off" | null>(null);
  const [fanUpdatedAt, setFanUpdatedAt] = useState<string | null>(null);
  const [heating, setHeating] = useState<"on" | "off" | null>(null);
  const [temperatureData12h, setTemperatureData12h] = useState<ChartPoint[]>([]);
  const [humidityData12h, setHumidityData12h] = useState<ChartPoint[]>([]);
  const [temperatureData24h, setTemperatureData24h] = useState<ChartPoint[]>([]);
  const [humidityData24h, setHumidityData24h] = useState<ChartPoint[]>([]);
  const [temperatureMinMax, setTemperatureMinMax] = useState<MetricMinMax>({ min: undefined, max: undefined });
  const [humidityMinMax, setHumidityMinMax] = useState<MetricMinMax>({ min: undefined, max: undefined });
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    if (saved !== null) return saved === "true";
    // Auto dark mode between 20:00 and 06:00
    const hour = new Date().getHours();
    return hour >= 20 || hour < 6;
  });
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [chartRange, setChartRange] = useState<ChartRange>("12h");
  const [chartsExpanded, setChartsExpanded] = useState(false);
  const [chartCarouselApi, setChartCarouselApi] = useState<CarouselApi>();
  const [activeChartSlide, setActiveChartSlide] = useState(0);

  const loadData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
        setHistoryLoading(true);
        setWeatherLoading(true);
      }
      setError(null);

      // Fetch latest data
      const latest = await fetchLatestGreenhouseData();
      setTemperature(latest.temperature);
      setHumidity(latest.humidity);
      setRainToday(latest.rainToday ?? null);
      setLastUpdated(new Date(latest.updatedAt));
      setDoor(latest.door ?? null);
      setDoorUpdatedAt(latest.doorUpdatedAt ?? null);
      setWindowCount(latest.window ?? null);
      setWindowUpdatedAt(latest.windowUpdatedAt ?? null);
      setFan(latest.fan ?? null);
      setFanUpdatedAt(latest.fanUpdatedAt ?? null);
      setHeating(latest.heating ?? null);
      setLoading(false);

      const historyPromise = (async () => {
        try {
          setHistoryLoading(true);
          const [history, stats24h] = await Promise.all([
            fetchGreenhouseHistory(),
            fetchGreenhouseStats24h().catch((statsErr) => {
              console.error('Failed to fetch 24h stats:', statsErr);
              return null;
            }),
          ]);

          // Get current hour as the endpoint
          const now = new Date();
          const currentHour = now.getHours();
          
          // Generate list of hours to display for graph (every 2nd hour going back 12 hours)
          const hoursToShow12: number[] = [];
          for (let i = 0; i < 7; i++) { // 7 points * 2 hours = 12 hours span
            const hour = (currentHour - (i * 2) + 24) % 24;
            hoursToShow12.unshift(hour); // Add to beginning so oldest is first
          }

          const hoursToShow24: number[] = [];
          for (let i = 0; i < 24; i++) {
            const hour = (currentHour - i + 24) % 24;
            hoursToShow24.unshift(hour);
          }
          
          // Fill forward function: carry last known value forward, but keep leading nulls
          const fillForward = (values: Array<number | null>): Array<number | null> => {
            let lastKnown: number | null = null;
            let seenFirstValue = false;

            return values.map((value) => {
              if (typeof value === "number" && !Number.isNaN(value)) {
                lastKnown = value;
                seenFirstValue = true;
                return value;
              }

              if (seenFirstValue && lastKnown !== null) {
                return lastKnown;
              }

              return null;
            });
          };

          // Process data for a given metric
          const processHistoryData = (historyItems: HistoryPoint[], prefix: string, hoursToShow: number[]) => {
            const times = historyItems.map(item => item.time);
            const rawValues = historyItems.map(item => item.value);
            const filledValues = fillForward(rawValues);
            
            // Create a map to store the last occurrence of each hour
            const hourMap = new Map<number, { time: string; value: number | null; min: number | null; max: number | null; originalIndex: number }>();
            
            times.forEach((time, index) => {
              const hour = parseInt(time.split(':')[0]);
              const value = filledValues[index];
              const min = historyItems[index].min;
              const max = historyItems[index].max;
              // Always update with the latest occurrence of this hour
              hourMap.set(hour, {
                time: time,
                value,
                min: typeof min === "number" && !Number.isNaN(min) ? min : value,
                max: typeof max === "number" && !Number.isNaN(max) ? max : value,
                originalIndex: index
              });
            });
            
            // Build final data array using only the hours we want to show
            const result = hoursToShow
              .map(hour => {
                const item = hourMap.get(hour);
                if (item && item.value !== null) {
              return {
                hour,
                time: item.time,
                value: item.value,
                min: item.min,
                max: item.max,
                originalIndex: item.originalIndex
              };
            }
                return null;
              })
              .filter(item => item !== null)
          .map((item, finalIndex) => (({
            time: item!.time,
            value: item!.value as number,
            min: item!.min ?? item!.value as number,
            max: item!.max ?? item!.value as number,
            range: [
              item!.min ?? item!.value as number,
              item!.max ?? item!.value as number,
            ] as [number, number],
            id: `${prefix}-${finalIndex}-${item!.hour}`
          })));
            
            return result;
          };

          const getMinMaxForLast24Hours = (historyItems: HistoryPoint[], latestValue: number | null): MetricMinMax => {
            const cutoff = now.getTime() - 24 * 60 * 60 * 1000;
            const values = historyItems
              .filter((item) => {
                const timestamp = item.timestamp ?? item.bucketStart;
                if (!timestamp) return true;

                const time = new Date(timestamp).getTime();
                return !Number.isNaN(time) && time >= cutoff;
              })
              .map((item) => item.value)
              .filter((value): value is number => typeof value === "number" && !Number.isNaN(value));

            if (typeof latestValue === "number" && !Number.isNaN(latestValue)) {
              values.push(latestValue);
            }

            if (values.length === 0) return { min: undefined, max: undefined };

            return {
              min: Math.min(...values),
              max: Math.max(...values),
            };
          };

          const statsToMinMax = (stats?: { min: number | null; max: number | null }): MetricMinMax | null => {
            if (!stats || typeof stats.min !== "number" || typeof stats.max !== "number") {
              return null;
            }

            return {
              min: stats.min,
              max: stats.max,
            };
          };

          // Transform temperature and humidity history data
          const tempData12h = processHistoryData(history.temperature || [], 'temp12', hoursToShow12);
          const humData12h = processHistoryData(history.humidity || [], 'hum12', hoursToShow12);
          const tempData24h = processHistoryData(history.temperature || [], 'temp24', hoursToShow24);
          const humData24h = processHistoryData(history.humidity || [], 'hum24', hoursToShow24);

          setTemperatureData12h(tempData12h);
          setHumidityData12h(humData12h);
          setTemperatureData24h(tempData24h);
          setHumidityData24h(humData24h);

          setTemperatureMinMax(
            statsToMinMax(stats24h?.temperature) ?? getMinMaxForLast24Hours(history.temperature || [], latest.temperature)
          );
          setHumidityMinMax(
            statsToMinMax(stats24h?.humidity) ?? getMinMaxForLast24Hours(history.humidity || [], latest.humidity)
          );
        } catch (historyErr) {
          console.error('Failed to fetch greenhouse history:', historyErr);
        } finally {
          setHistoryLoading(false);
        }
      })();

      const weatherPromise = (async () => {
        try {
          setWeatherLoading(true);
          const weather = await fetchWeatherData();
          console.log('Weather data fetched:', weather);
          setWeatherData(weather);
        } catch (weatherErr) {
          console.error('Failed to fetch weather data:', weatherErr);
          // Don't set error state for weather failures - just skip showing weather
        } finally {
          setWeatherLoading(false);
        }
      })();

      await Promise.allSettled([historyPromise, weatherPromise]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
      setHistoryLoading(false);
      setWeatherLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();

    // Auto-refresh every 5 minutes
    const interval = setInterval(() => {
      loadData(true);
    }, 300000);

    // Online/offline listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set theme-color meta tag for mobile browser address bar
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.setAttribute('content', darkMode ? '#2d3a21' : '#5d7342');

    // Set favicon
    let faviconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    if (!faviconLink) {
      faviconLink = document.createElement('link');
      faviconLink.setAttribute('rel', 'icon');
      document.head.appendChild(faviconLink);
    }
    faviconLink.setAttribute('type', 'image/svg+xml');
    faviconLink.setAttribute('href', '/favicon.svg');

    // Set apple-touch-icon for iOS home screen
    let appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement;
    if (!appleTouchIcon) {
      appleTouchIcon = document.createElement('link');
      appleTouchIcon.setAttribute('rel', 'apple-touch-icon');
      document.head.appendChild(appleTouchIcon);
    }
    appleTouchIcon.setAttribute('href', '/apple-touch-icon.svg');

    // Set apple-mobile-web-app-capable for iOS
    let appleCapable = document.querySelector('meta[name="apple-mobile-web-app-capable"]');
    if (!appleCapable) {
      appleCapable = document.createElement('meta');
      appleCapable.setAttribute('name', 'apple-mobile-web-app-capable');
      appleCapable.setAttribute('content', 'yes');
      document.head.appendChild(appleCapable);
    }

    // Set apple-mobile-web-app-status-bar-style
    let appleStatusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (!appleStatusBar) {
      appleStatusBar = document.createElement('meta');
      appleStatusBar.setAttribute('name', 'apple-mobile-web-app-status-bar-style');
      document.head.appendChild(appleStatusBar);
    }
    appleStatusBar.setAttribute('content', darkMode ? 'black-translucent' : 'default');

    // Set apple-mobile-web-app-title
    let appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (!appleTitle) {
      appleTitle = document.createElement('meta');
      appleTitle.setAttribute('name', 'apple-mobile-web-app-title');
      appleTitle.setAttribute('content', 'Kristins drivhus');
      document.head.appendChild(appleTitle);
    }

    // Set page title
    document.title = 'Kristins drivhus';

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [darkMode]);

  useEffect(() => {
    if (!chartCarouselApi) return;

    const updateActiveSlide = () => {
      setActiveChartSlide(chartCarouselApi.selectedScrollSnap());
    };

    updateActiveSlide();
    chartCarouselApi.on("select", updateActiveSlide);
    chartCarouselApi.on("reInit", updateActiveSlide);

    return () => {
      chartCarouselApi.off("select", updateActiveSlide);
      chartCarouselApi.off("reInit", updateActiveSlide);
    };
  }, [chartCarouselApi]);

  useEffect(() => {
    if (!historyLoading) {
      void loadTrendChart();
    }
  }, [historyLoading]);

  // Toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode(prev => {
      const newValue = !prev;
      localStorage.setItem("darkMode", String(newValue));
      return newValue;
    });
  };

  const getTemperatureWarningMessage = (temp: number | null) => {
    if (temp === null) return undefined;
    if (temp < thresholds.temperature.min) {
      return `Temperaturen er ${temp.toFixed(1)}°C, som er under det anbefalte minimumet på ${thresholds.temperature.min}°C. Dette kan skade plantene.`;
    }
    if (temp > thresholds.temperature.max) {
      return `Temperaturen er ${temp.toFixed(1)}°C, som er over det anbefalte maksimum på ${thresholds.temperature.max}°C. Dette kan stresse plantene.`;
    }
    return undefined;
  };

  const getHumidityWarningMessage = (humidity: number | null) => {
    if (humidity === null) return undefined;
    if (humidity < thresholds.humidity.min) {
      return `Luftfuktigheten er ${humidity.toFixed(1)}%, som er under det anbefalte minimumet på ${thresholds.humidity.min}%. Plantene kan tørke ut.`;
    }
    if (humidity > thresholds.humidity.max) {
      return `Luftfuktigheten er ${humidity.toFixed(1)}%, som er over det anbefalte maksimum på ${thresholds.humidity.max}%. Dette kan føre til mugg og sykdom.`;
    }
    return undefined;
  };

  const formatStatusTimestamp = (timestamp: string | null) => {
    if (!timestamp) return undefined;

    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return undefined;

    const now = new Date();
    const time = date.toLocaleTimeString("nb-NO", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round((todayOnly.getTime() - dateOnly.getTime()) / 86400000);

    if (diffDays === 0) return time;
    if (diffDays === 1) return `i går ${time}`;

    return date.toLocaleDateString("nb-NO", {
      day: "numeric",
      month: "long",
    });
  };

  const bgColor = darkMode ? 'bg-[#2d3a21]' : 'bg-[#e8ede3]';
  const safeWindowCount = Math.min(Math.max(windowCount ?? 0, 0), 3);
  const heroImageSrc =
    temperature === null
      ? "/drivhus.png"
      : temperature < 12
        ? "/cold.jpg"
        : temperature < 23
          ? "/drivhus.png"
          : temperature <= 28
            ? "/warm.jpg"
            : "/hot.jpg";
  const statusItems = [
    {
      iconSrc: darkMode
        ? door === "open" ? "/door-open-dark.svg" : "/door-closed-dark.svg"
        : door === "open" ? "/door-open-light.svg" : "/door-closed-light.svg",
      label: door === "open" ? "Dør åpen" : "Dør lukket",
      tooltip: `${door === "open" ? "Åpnet" : "Lukket"} ${formatStatusTimestamp(doorUpdatedAt) ?? ""}`.trim(),
    },
    {
      iconSrc: darkMode
        ? heating === "on" ? "/fan-heating-dark.svg" : fan === "on" ? "/fan-cooling-dark.svg" : "/fan-off-dark.svg"
        : heating === "on" ? "/fan-heating-light.svg" : fan === "on" ? "/fan-cooling-light.svg" : "/fan-off-light.svg",
      label:
        fan === "on"
          ? heating === "on"
            ? "Varmevifte"
            : "Ventilasjon"
          : "Vifte av",
      spinning: fan === "on",
      tooltip: `${fan === "on" ? "Slått på" : "Avslått"} ${formatStatusTimestamp(fanUpdatedAt) ?? ""}`.trim(),
    },
    {
      iconSrc: darkMode
        ? safeWindowCount > 0 ? "/window-open-dark.svg" : "/window-closed-dark.svg"
        : safeWindowCount > 0 ? "/window-open-light.svg" : "/window-closed-light.svg",
      label: safeWindowCount > 0 ? `${safeWindowCount}/3 vindu åpne` : "Vinduer lukket",
      tooltip: `${safeWindowCount > 0 ? "Åpnet" : "Lukket"} ${formatStatusTimestamp(windowUpdatedAt) ?? ""}`.trim(),
    },
  ];
  const selectedTemperatureData = chartRange === "12h" ? temperatureData12h : temperatureData24h;
  const selectedHumidityData = chartRange === "12h" ? humidityData12h : humidityData24h;
  const chartRangeLabel = chartRange === "12h" ? "siste 12 timer" : "siste 24 timer";
  const chartXAxisInterval = chartRange === "12h" ? 0 : 2;
  const chartSelectTriggerClass = darkMode
    ? "h-9 w-[132px] rounded-full border-white/10 bg-white/10 px-3 text-xs text-white shadow-none hover:bg-white/15 focus-visible:ring-white/20"
    : "h-9 w-[132px] rounded-full border-[#cbd3c2] bg-white/75 px-3 text-xs text-[#4d5d3e] shadow-sm hover:bg-white focus-visible:ring-[#8d9d7e]/30";
  const chartSelectContentClass = darkMode
    ? "rounded-xl border-white/10 bg-[#2d3a21] text-white shadow-xl"
    : "rounded-xl border-[#d8ded1] bg-[#f7f8f5] text-[#3f4d32] shadow-xl";
  const chartSelectItemClass = darkMode
    ? "rounded-lg text-xs focus:bg-white/10 focus:text-white data-[state=checked]:text-[#d28c31]"
    : "rounded-lg text-xs focus:bg-[#e7ece0] focus:text-[#2d3a21] data-[state=checked]:text-[#5d7342]";
  const chartNavButtonClass = darkMode
    ? "grid size-8 place-items-center rounded-full border border-white/10 bg-white/8 text-white/70 transition hover:bg-white/14 hover:text-white disabled:opacity-30"
    : "grid size-8 place-items-center rounded-full border border-[#cbd3c2] bg-white/70 text-[#4d5d3e] shadow-sm transition hover:bg-white disabled:opacity-35";
  const chartDotClass = (active: boolean) =>
    active
      ? darkMode
        ? "h-1.5 w-5 rounded-full bg-[#d28c31] transition-all"
        : "h-1.5 w-5 rounded-full bg-[#5d7342] transition-all"
      : darkMode
        ? "h-1.5 w-1.5 rounded-full bg-white/25 transition-all"
        : "h-1.5 w-1.5 rounded-full bg-[#9daa8f]/55 transition-all";

  return (
    <div className={`min-h-screen transition-colors duration-300 ${bgColor}`}>
      <div className="max-w-md mx-auto relative">
        {/* Offline Indicator */}
        <div
          className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-red-600 px-4 py-2 text-center text-sm text-white transition-all duration-300 ${
            isOnline ? "pointer-events-none -translate-y-full opacity-0" : "translate-y-0 opacity-100"
          }`}
        >
          <WifiOffIcon className="w-4 h-4" />
          <span>Ingen internettforbindelse</span>
        </div>

        {/* Loading Progress Bar */}
        <div
          className={`fixed top-0 left-0 right-0 z-40 h-1 origin-left bg-[#d28c31] transition-transform duration-500 ${
            refreshing ? "scale-x-100" : "scale-x-0"
          }`}
          style={{ transformOrigin: "left" }}
        />

        {/* Header with Logo, Title, and Controls */}
        <div className="bg-[#5d7342] px-4 py-4 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GreenhouseIcon className="w-9 h-9 text-white" />
              <h1 className="text-xl text-white" style={{ fontFamily: "'Cinzel Decorative', serif", fontWeight: 400 }}>Kristins drivhus</h1>
            </div>
            <div className="flex items-center gap-2">
              {/* Refresh Button */}
              <button
                onClick={() => loadData(true)}
                disabled={refreshing}
                className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-50"
                aria-label="Oppdater data"
              >
                <RefreshCwIcon className={`w-5 h-5 text-white ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              
              {/* Dark Mode Slider */}
              <button
                onClick={toggleDarkMode}
                className="relative w-16 h-8 rounded-full bg-white/20 hover:bg-white/30 transition-colors p-1"
                aria-label="Bytt modus"
              >
                <div className="flex items-center justify-between px-1 h-full">
                  <SunIcon className="w-4 h-4 text-white" />
                  <MoonIcon className="w-4 h-4 text-white" />
                </div>
                <div
                  className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-300 ${
                    darkMode ? "translate-x-8" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        <div
          className={`overflow-hidden bg-red-500 px-4 text-sm text-white transition-all duration-300 ${
            error ? "max-h-24 py-3 opacity-100" : "max-h-0 py-0 opacity-0"
          }`}
        >
          {error && (
            <>
              <p className="font-semibold">Feil ved lasting av data</p>
              <p className="mt-1 text-xs">{error}</p>
            </>
          )}
        </div>

        {/* Hero Image */}
        <div className="relative w-full h-[200px] overflow-hidden mb-6">
          <ImageWithFallback
            src={heroImageSrc}
            alt="Drivhus" 
            className="w-full h-full object-cover object-center"
          />
          
          {/* Weather Widget Overlay */}
          {weatherLoading ? (
            <div className="absolute top-4 right-4 bottom-4">
              <WeatherWidgetSkeleton />
            </div>
          ) : weatherData ? (
            <div className="absolute top-4 right-4 bottom-4">
              <Suspense fallback={<WeatherWidgetSkeleton />}>
                <WeatherWidget data={weatherData} compact rainToday={rainToday} />
              </Suspense>
            </div>
          ) : null}
        </div>

        <div className="px-4 pb-6">
          {/* Climate Metrics */}
          <div className="mb-7 pt-1">
            {loading ? (
              <ClimateMetricsSkeleton darkMode={darkMode} />
            ) : (
              <div
                key={`climate-${temperature}-${humidity}`}
                className="grid grid-cols-2 gap-3 opacity-100 transition-opacity duration-300 sm:gap-4"
              >
                <ClimateMetric
                  label="Temperatur"
                  value={temperature}
                  unit="°C"
                  warningMessage={getTemperatureWarningMessage(temperature)}
                  min={temperatureMinMax.min}
                  max={temperatureMinMax.max}
                  darkMode={darkMode}
                />
                <ClimateMetric
                  label="Luftfuktighet"
                  value={humidity}
                  unit="%"
                  warningMessage={getHumidityWarningMessage(humidity)}
                  min={humidityMinMax.min}
                  max={humidityMinMax.max}
                  darkMode={darkMode}
                />
              </div>
            )}
          </div>

          {!loading && <DeviceStatusRow items={statusItems} darkMode={darkMode} />}

          {/* Trend Charts */}
          {!loading && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 px-1">
                <button
                  type="button"
                  className={`flex min-h-9 items-center gap-2 text-xs uppercase leading-none tracking-[0.04em] transition-colors ${
                    darkMode ? "text-white/45 hover:text-white/70" : "text-stone-500 hover:text-stone-700"
                  }`}
                  onClick={() => setChartsExpanded((expanded) => !expanded)}
                  aria-expanded={chartsExpanded}
                  aria-controls="chart-panel"
                >
                  <span>Grafer</span>
                  <ChevronDownIcon
                    className={`size-4 transition-transform duration-300 ${chartsExpanded ? "rotate-180" : "rotate-0"}`}
                  />
                </button>
                <Select value={chartRange} onValueChange={(value) => setChartRange(value as ChartRange)}>
                  <SelectTrigger className={chartSelectTriggerClass} aria-label="Velg tidsrom for grafer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end" className={chartSelectContentClass}>
                    <SelectItem value="12h" className={chartSelectItemClass}>
                      12 timer
                    </SelectItem>
                    <SelectItem value="24h" className={chartSelectItemClass}>
                      24 timer
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {!chartsExpanded && (
                <CollapsedChartPreview
                  temperatureData={selectedTemperatureData}
                  humidityData={selectedHumidityData}
                  darkMode={darkMode}
                  loading={historyLoading}
                  onClick={() => setChartsExpanded(true)}
                />
              )}

              <div
                id="chart-panel"
                className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ${
                  chartsExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="min-h-0 overflow-hidden">
                  {historyLoading ? (
                    <ChartSkeleton darkMode={darkMode} />
                  ) : (
                    <Suspense fallback={<ChartSkeleton darkMode={darkMode} />}>
                      <div className="space-y-3">
                        <Carousel
                          setApi={setChartCarouselApi}
                          opts={{ align: "start", containScroll: "trimSnaps" }}
                          className="w-full"
                          aria-label="Grafer for temperatur og luftfuktighet"
                        >
                          <CarouselContent className="ml-0 pb-5 pt-1">
                            <CarouselItem className="px-3">
                              <TrendChart
                                title={`Temperatur ${chartRangeLabel}`}
                                data={selectedTemperatureData}
                                color="#d28c31"
                                unit="°C"
                                darkMode={darkMode}
                                xAxisInterval={chartXAxisInterval}
                              />
                            </CarouselItem>
                            <CarouselItem className="px-3">
                              <TrendChart
                                title={`Luftfuktighet ${chartRangeLabel}`}
                                data={selectedHumidityData}
                                color={darkMode ? "#8fbc5f" : "#5d7342"}
                                unit="%"
                                darkMode={darkMode}
                                xAxisInterval={chartXAxisInterval}
                              />
                            </CarouselItem>
                          </CarouselContent>
                        </Carousel>
                        <div className="flex items-center justify-center gap-3">
                          <button
                            type="button"
                            className={chartNavButtonClass}
                            onClick={() => chartCarouselApi?.scrollPrev()}
                            disabled={!chartCarouselApi?.canScrollPrev()}
                            aria-label="Vis forrige graf"
                          >
                            <ChevronLeftIcon className="size-4" />
                          </button>
                          <div className="flex items-center gap-1.5" aria-label="Valgt graf">
                            {["Temperatur", "Luftfuktighet"].map((label, index) => (
                              <button
                                key={label}
                                type="button"
                                className={chartDotClass(activeChartSlide === index)}
                                onClick={() => chartCarouselApi?.scrollTo(index)}
                                aria-label={`Vis ${label.toLowerCase()}`}
                                aria-current={activeChartSlide === index ? "true" : undefined}
                              />
                            ))}
                          </div>
                          <button
                            type="button"
                            className={chartNavButtonClass}
                            onClick={() => chartCarouselApi?.scrollNext()}
                            disabled={!chartCarouselApi?.canScrollNext()}
                            aria-label="Vis neste graf"
                          >
                            <ChevronRightIcon className="size-4" />
                          </button>
                        </div>
                      </div>
                    </Suspense>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Footer with Last Updated */}
          {lastUpdated && (
            <div className="mt-4">
              <p className={`text-xs text-center ${darkMode ? 'text-white/60' : 'text-gray-500'}`}>
                Siste data fra drivhuset mottatt {lastUpdated.toLocaleDateString('nb-NO', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric'
                })} {lastUpdated.toLocaleTimeString('nb-NO', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
