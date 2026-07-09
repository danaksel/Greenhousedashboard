import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { Drawer as VaulDrawer } from "vaul";
import SunCalc from "suncalc";
import { AdminPage } from "./AdminPage";
import { ChartSkeleton } from "./components/chart-skeleton";
import {
  defaultSiteConfig,
  fetchLatestGreenhouseData,
  fetchGreenhouseHistory,
  fetchGreenhouseStats24h,
  fetchSiteConfig,
  fetchStoredPlantAnalysis,
  fetchWeatherData,
  resolveGreenhouseAssetUrl,
  type HeaderImageSlot,
  type PlantAnalysisResponse,
  type PlantLibraryEntry,
  type PlantSeasonEntry,
  type SiteConfig,
  type WeatherData,
} from "./utils/api";
import { ImageWithFallback } from "./components/figma/ImageWithFallback";
import { GreenhouseIcon } from "./components/greenhouse-icon";
import { WeatherWidgetSkeleton } from "./components/weather-widget-skeleton";
import { thresholds } from "../config/thresholds";
import { ClimateMetric } from "./components/climate-metric";
import { ClimateMetricsSkeleton } from "./components/climate-metrics-skeleton";
import { DeviceStatusRow } from "./components/device-status-row";
import { AlertTriangleIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, MoonIcon, RefreshCwIcon, SunIcon, WifiOffIcon, XIcon } from "./components/icons";
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

const chartLineColors = {
  temperature: "#d28c31",
  humidityDark: "#8fbc5f",
  humidityLight: "#5d7342",
};

const greenhouseLatitude = 59.8667;
const greenhouseLongitude = 10.7167;

function isRainWeatherSymbol(symbolCode: string | null | undefined) {
  const symbol = String(symbolCode || "").toLowerCase();
  if (!symbol) return false;
  if (symbol.includes("snow") || symbol.includes("sleet")) return false;
  return symbol.includes("rain") || symbol.includes("thunder");
}

function isNightNow(now = new Date()) {
  const sunTimes = SunCalc.getTimes(now, greenhouseLatitude, greenhouseLongitude);
  return now < sunTimes.sunrise || now >= sunTimes.sunset;
}

function getHeaderImageSlot(temperature: number | null, symbolCode: string | null | undefined, now = new Date()): HeaderImageSlot {
  const isCold = temperature !== null && temperature < thresholds.temperature.min;
  if (isNightNow(now)) return isCold ? "coldNight" : "night";
  if (isCold) return "cold";
  if (isRainWeatherSymbol(symbolCode)) return "rain";
  if (temperature === null) return "normal";
  if (temperature < 23) return "normal";
  if (temperature <= 28) return "warm";
  return "hot";
}

function getStoredDarkThemeColor() {
  if (typeof window === "undefined") return "#2d3a21";
  const raw = localStorage.getItem("greenhouseLastDarkThemeColor") || "";
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : "#2d3a21";
}

type ChartPoint = { time: string; value: number; min?: number; max?: number; range?: [number, number]; id: string };
type HistoryPoint = { time: string; value: number | null; min?: number | null; max?: number | null; timestamp: string | null; bucketStart: string | null };
type MetricMinMax = { min: number | undefined; max: number | undefined };
type MetricStats = { min: number | null; max: number | null };
type ChartRange = "12h" | "24h";
type TemperatureAlert = {
  tone: "hot" | "cold";
  color: string;
  label: string;
  reading: string;
  comparisonLabel: string;
  thresholdLabel: string;
  action: string;
  threshold: number;
};

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
  theme,
  loading,
  onClick,
}: {
  temperatureData: ChartPoint[];
  humidityData: ChartPoint[];
  darkMode: boolean;
  theme: SiteConfig["headerImages"][HeaderImageSlot]["displayTheme"];
  loading: boolean;
  onClick: () => void;
}) {
  const width = 96;
  const height = 22;
  const tempPath = buildPreviewPath(temperatureData, width, height, 3);
  const humidityPath = buildPreviewPath(humidityData, width, height, 3);
  const modeTheme = darkMode ? theme.dark : theme.light;

  return (
    <button
      type="button"
      className="group grid h-12 w-full grid-cols-2 gap-2 rounded-xl border p-1.5 text-left shadow-sm transition-all"
      style={{ backgroundColor: modeTheme.graphPanelBg, borderColor: modeTheme.graphPanelBorder }}
      onClick={onClick}
      aria-label="Åpne grafer"
    >
      <div className="flex min-w-0 items-center gap-2 rounded-lg border px-2" style={{ borderColor: modeTheme.graphPanelBorder, color: modeTheme.mutedColor }}>
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.04em]">Temp</span>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className={`h-6 min-w-0 flex-1 ${loading ? "animate-pulse" : ""}`}
          aria-hidden="true"
        >
          <path
            d={tempPath || "M 3 15 C 20 8, 35 7, 51 11 S 78 16, 93 8"}
            fill="none"
            stroke={chartLineColors.temperature}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.75"
          />
        </svg>
      </div>
      <div className="flex min-w-0 items-center gap-2 rounded-lg border px-2" style={{ borderColor: modeTheme.graphPanelBorder, color: modeTheme.mutedColor }}>
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.04em]">Fukt</span>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className={`h-6 min-w-0 flex-1 ${loading ? "animate-pulse" : ""}`}
          aria-hidden="true"
        >
          <path
            d={humidityPath || "M 3 9 C 18 13, 34 16, 50 12 S 76 6, 93 11"}
            fill="none"
            stroke={darkMode ? chartLineColors.humidityDark : chartLineColors.humidityLight}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={darkMode ? 0.68 : 0.62}
          />
        </svg>
      </div>
    </button>
  );
}

function OpenAiIcon({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="OpenAI" className={className} style={style} fill="currentColor">
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  );
}

export default function App() {
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) {
    return <AdminPage />;
  }

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
  const [weatherReady, setWeatherReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [plantAnalysis, setPlantAnalysis] = useState<PlantAnalysisResponse | null>(null);
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(defaultSiteConfig);
  const [siteConfigReady, setSiteConfigReady] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    if (saved !== null) return saved === "true";
    // Auto dark mode between 20:00 and 06:00
    const hour = new Date().getHours();
    return hour >= 20 || hour < 6;
  });
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [chartRange, setChartRange] = useState<ChartRange>("12h");
  const [plantAnalysisExpanded, setPlantAnalysisExpanded] = useState(true);
  const [chartsExpanded, setChartsExpanded] = useState(false);
  const [chartCarouselApi, setChartCarouselApi] = useState<CarouselApi>();
  const [activeChartSlide, setActiveChartSlide] = useState(0);
  const [selectedPlantIndex, setSelectedPlantIndex] = useState<number | null>(null);
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);
  const plantSectionRef = useRef<HTMLElement | null>(null);
  const plantScrollerRef = useRef<HTMLDivElement | null>(null);
  const plantButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const plantDragRef = useRef({ pointerId: -1, startX: 0, scrollLeft: 0, moved: false });
  const suppressPlantClickRef = useRef(false);
  const [plantCardAnchor, setPlantCardAnchor] = useState({ left: 0, width: 720, arrowLeft: 48 });

  const loadData = async (isRefresh = false, options: { includeHistory?: boolean; includeWeather?: boolean } = {}) => {
    const includeHistory = options.includeHistory ?? true;
    const includeWeather = options.includeWeather ?? true;

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
        if (includeHistory) setHistoryLoading(true);
        if (includeWeather) setWeatherLoading(true);
      }
      setError(null);

      const weatherPromise = includeWeather ? (async () => {
        try {
          setWeatherLoading(true);
          const weather = await fetchWeatherData();
          console.log('Weather data fetched:', weather);
          setWeatherData(weather);
        } catch (weatherErr) {
          console.error('Failed to fetch weather data:', weatherErr);
          // Don't set error state for weather failures - just skip showing weather
        } finally {
          setWeatherReady(true);
          setWeatherLoading(false);
        }
      })() : Promise.resolve();

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

      const statsToMinMax = (stats?: MetricStats): MetricMinMax | null => {
        if (!stats || typeof stats.min !== "number" || typeof stats.max !== "number") {
          return null;
        }

        return {
          min: stats.min,
          max: stats.max,
        };
      };

      const statsPromise = includeHistory ? (async () => {
        try {
          const stats24h = await fetchGreenhouseStats24h();
          const temperatureStats = statsToMinMax(stats24h?.temperature);
          const humidityStats = statsToMinMax(stats24h?.humidity);

          if (temperatureStats) setTemperatureMinMax(temperatureStats);
          if (humidityStats) setHumidityMinMax(humidityStats);

          return stats24h;
        } catch (statsErr) {
          console.error('Failed to fetch 24h stats:', statsErr);
          return null;
        }
      })() : Promise.resolve(null);

      const historyPromise = includeHistory ? (async () => {
        try {
          setHistoryLoading(true);
          const history = await fetchGreenhouseHistory();

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

          // Transform temperature and humidity history data
          const tempData12h = processHistoryData(history.temperature || [], 'temp12', hoursToShow12);
          const humData12h = processHistoryData(history.humidity || [], 'hum12', hoursToShow12);
          const tempData24h = processHistoryData(history.temperature || [], 'temp24', hoursToShow24);
          const humData24h = processHistoryData(history.humidity || [], 'hum24', hoursToShow24);

          setTemperatureData12h(tempData12h);
          setHumidityData12h(humData12h);
          setTemperatureData24h(tempData24h);
          setHumidityData24h(humData24h);

          void statsPromise.then((stats24h) => {
            if (!statsToMinMax(stats24h?.temperature)) {
              setTemperatureMinMax(getMinMaxForLast24Hours(history.temperature || [], latest.temperature));
            }
            if (!statsToMinMax(stats24h?.humidity)) {
              setHumidityMinMax(getMinMaxForLast24Hours(history.humidity || [], latest.humidity));
            }
          });
        } catch (historyErr) {
          console.error('Failed to fetch greenhouse history:', historyErr);
        } finally {
          setHistoryLoading(false);
        }
      })() : Promise.resolve();

      await Promise.allSettled([statsPromise, historyPromise, weatherPromise]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
      if (includeHistory) setHistoryLoading(false);
      if (includeWeather) setWeatherLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();

    // Auto-refresh live values/statuses every 5 minutes.
    const liveInterval = setInterval(() => {
      loadData(true, { includeHistory: false, includeWeather: false });
    }, 300000);

    // Graph history and weather are less volatile; refresh every 15 minutes.
    const historyInterval = setInterval(() => {
      loadData(true, { includeHistory: true, includeWeather: true });
    }, 900000);

    // Online/offline listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set apple-mobile-web-app-capable for iOS
    let appleCapable = document.querySelector('meta[name="apple-mobile-web-app-capable"]');
    if (!appleCapable) {
      appleCapable = document.createElement('meta');
      appleCapable.setAttribute('name', 'apple-mobile-web-app-capable');
      appleCapable.setAttribute('content', 'yes');
      document.head.appendChild(appleCapable);
    }

    return () => {
      clearInterval(liveInterval);
      clearInterval(historyInterval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const updateViewport = () => setIsDesktopViewport(mediaQuery.matches);

    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);
    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

  useEffect(() => {
    const loadPlantAnalysis = () => {
      fetchStoredPlantAnalysis()
        .then(setPlantAnalysis)
        .catch((err) => console.error("Failed to fetch plant analysis:", err));
    };

    loadPlantAnalysis();
    const interval = setInterval(loadPlantAnalysis, 900000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Set theme-color meta tag for mobile browser address bar
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(metaThemeColor);
    }
    const activeHeaderSlot =
      siteConfigReady && temperature !== null && weatherReady && weatherData?.symbolCode
        ? getHeaderImageSlot(temperature, weatherData?.symbolCode)
        : null;
    const activeHeaderConfig = activeHeaderSlot
      ? siteConfig.headerImages[activeHeaderSlot] ?? defaultSiteConfig.headerImages[activeHeaderSlot]
      : null;
    const browserBackgroundColor = darkMode ? activeHeaderConfig?.darkModeColor ?? getStoredDarkThemeColor() : '#e8ede3';
    if (darkMode && activeHeaderConfig?.darkModeColor) {
      localStorage.setItem("greenhouseLastDarkThemeColor", activeHeaderConfig.darkModeColor);
    }
    metaThemeColor.setAttribute('content', browserBackgroundColor);
    document.documentElement.style.backgroundColor = browserBackgroundColor;
    document.body.style.backgroundColor = browserBackgroundColor;

    // Set apple-mobile-web-app-status-bar-style
    let appleStatusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (!appleStatusBar) {
      appleStatusBar = document.createElement('meta');
      appleStatusBar.setAttribute('name', 'apple-mobile-web-app-status-bar-style');
      document.head.appendChild(appleStatusBar);
    }
    appleStatusBar.setAttribute('content', darkMode ? 'black-translucent' : 'default');
  }, [darkMode, lastUpdated, siteConfig, siteConfigReady, temperature, weatherData?.symbolCode, weatherReady]);

  useEffect(() => {
    if (!siteConfigReady) return;

    const setHeadLink = (selector: string, attributes: Record<string, string>) => {
      let link = document.querySelector(selector) as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        document.head.appendChild(link);
      }

      for (const [name, value] of Object.entries(attributes)) {
        link.setAttribute(name, value);
      }
    };

    const favicon = siteConfig.branding.favicon;
    const svgIcon = resolveGreenhouseAssetUrl(favicon.svg || defaultSiteConfig.branding.favicon.svg);
    const png32Icon = favicon.png32 ? resolveGreenhouseAssetUrl(favicon.png32) : "";
    const appleIcon = resolveGreenhouseAssetUrl(favicon.appleTouchIcon || defaultSiteConfig.branding.favicon.appleTouchIcon);

    setHeadLink('link[rel="icon"][type="image/svg+xml"]', {
      rel: "icon",
      type: "image/svg+xml",
      href: svgIcon,
    });

    if (png32Icon) {
      setHeadLink('link[rel="icon"][sizes="32x32"]', {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: png32Icon,
      });
    }

    setHeadLink('link[rel="apple-touch-icon"]', {
      rel: "apple-touch-icon",
      sizes: "180x180",
      href: appleIcon,
    });

    setHeadLink('link[rel="manifest"]', {
      rel: "manifest",
      href: resolveGreenhouseAssetUrl("/manifest.webmanifest"),
    });
  }, [siteConfig.branding.favicon, siteConfigReady]);

  useEffect(() => {
    if (!siteConfigReady) return;

    const setMeta = (selector: string, attributes: Record<string, string>) => {
      let meta = document.querySelector(selector) as HTMLMetaElement | null;
      if (!meta) {
        meta = document.createElement("meta");
        document.head.appendChild(meta);
      }

      for (const [name, value] of Object.entries(attributes)) {
        meta.setAttribute(name, value);
      }
    };

    document.title = siteConfig.branding.title;
    setMeta('meta[name="description"]', {
      name: "description",
      content: siteConfig.branding.description,
    });
    setMeta('meta[name="apple-mobile-web-app-title"]', {
      name: "apple-mobile-web-app-title",
      content: siteConfig.branding.shortName || siteConfig.branding.siteName,
    });
    setMeta('meta[property="og:title"]', {
      property: "og:title",
      content: siteConfig.branding.title,
    });
    setMeta('meta[property="og:description"]', {
      property: "og:description",
      content: siteConfig.branding.description,
    });
  }, [siteConfig.branding.description, siteConfig.branding.shortName, siteConfig.branding.siteName, siteConfig.branding.title, siteConfigReady]);

  useEffect(() => {
    let cancelled = false;

    fetchSiteConfig()
      .then((config) => {
        if (!cancelled) {
          setSiteConfig(config);
          setSiteConfigReady(true);
        }
      })
      .catch((configErr) => {
        console.error("Failed to fetch site config:", configErr);
        if (!cancelled) setSiteConfigReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

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

  const safeWindowCount = Math.min(Math.max(windowCount ?? 0, 0), 3);
  const heroStateReady = siteConfigReady && temperature !== null && weatherReady && Boolean(weatherData?.symbolCode);
  const heroImageSlot = heroStateReady ? getHeaderImageSlot(temperature, weatherData?.symbolCode) : null;
  const heroImageConfig = heroImageSlot
    ? siteConfig.headerImages[heroImageSlot] ?? defaultSiteConfig.headerImages[heroImageSlot]
    : null;
  const activeDisplayTheme = heroImageConfig?.displayTheme ?? defaultSiteConfig.headerImages.normal.displayTheme;
  const activeModeTheme = darkMode ? activeDisplayTheme.dark : activeDisplayTheme.light;
  const browserBackgroundColor = darkMode ? heroImageConfig?.darkModeColor ?? getStoredDarkThemeColor() : "#e8ede3";
  const headerTextClass = darkMode ? "text-[#e8ede3]" : "text-[#2d3a21]";
  const headerButtonClass = darkMode
    ? "bg-[#e8ede3]/12 hover:bg-[#e8ede3]/18"
    : "bg-[#2d3a21]/10 hover:bg-[#2d3a21]/15";
  const heroMobileImageSrc = heroImageConfig ? resolveGreenhouseAssetUrl(heroImageConfig.mobile) : "";
  const heroDesktopImageSrc = heroImageConfig ? resolveGreenhouseAssetUrl(heroImageConfig.desktop) : "";
  const heroMobileVideoSrc = heroImageConfig ? resolveGreenhouseAssetUrl(heroImageConfig.mobileVideo) : "";
  const customLogoSrc = siteConfigReady && siteConfig.branding.logo.url ? resolveGreenhouseAssetUrl(siteConfig.branding.logo.url) : "";
  const logoSize = siteConfig.branding.logo.size;

  useEffect(() => {
    const selector = 'link[rel="preload"][as="video"][data-hero-video="true"]';
    const existing = document.querySelector(selector) as HTMLLinkElement | null;

    if (!heroMobileVideoSrc) {
      existing?.remove();
      return;
    }

    const link = existing ?? document.createElement("link");
    link.setAttribute("rel", "preload");
    link.setAttribute("as", "video");
    link.setAttribute("type", "video/mp4");
    link.setAttribute("href", heroMobileVideoSrc);
    link.setAttribute("media", "(max-width: 767px)");
    link.setAttribute("data-hero-video", "true");

    if (!existing) {
      document.head.appendChild(link);
    }
  }, [heroMobileVideoSrc]);

  const temperatureAlert: TemperatureAlert | null =
    temperature === null
      ? null
      : temperature > thresholds.temperature.max
        ? {
            tone: "hot",
            color: activeModeTheme.hotTickerColor,
            label: "Høy temperatur",
            reading: `${temperature.toFixed(1)}°C`,
            comparisonLabel: "er over anbefalt maksimum på",
            thresholdLabel: `${thresholds.temperature.max}°C`,
            action: "Sjekk dør, vinduer og vifte",
            threshold: thresholds.temperature.max,
          }
        : temperature < thresholds.temperature.min
          ? {
              tone: "cold",
              color: activeModeTheme.coldTickerColor,
              label: "Lav temperatur",
              reading: `${temperature.toFixed(1)}°C`,
              comparisonLabel: "er under anbefalt minimum på",
              thresholdLabel: `${thresholds.temperature.min}°C`,
              action: "Sjekk dør, vinduer og varme",
              threshold: thresholds.temperature.min,
            }
          : null;
  const renderTemperatureAlertTicker = (textSizeClass = "text-xs md:text-sm") =>
    temperatureAlert ? (
      <div className={`greenhouse-alert-ticker-track flex w-max whitespace-nowrap font-semibold uppercase tracking-[0.08em] ${textSizeClass}`}>
        {[0, 1].map((group) => (
          <span key={group} className="flex items-center gap-6 pr-6">
            <AlertTriangleIcon className="h-4 w-4 shrink-0" />
            <span>{temperatureAlert.label.toUpperCase()}</span>
            <AlertTriangleIcon className="h-4 w-4 shrink-0" />
            <span>
              {temperatureAlert.reading} {temperatureAlert.comparisonLabel.toUpperCase()} {temperatureAlert.thresholdLabel}
            </span>
            <AlertTriangleIcon className="h-4 w-4 shrink-0" />
            <span>{temperatureAlert.action}</span>
          </span>
        ))}
      </div>
    ) : null;
  const statusItems = [
    {
      id: "door",
      iconSrc: darkMode
        ? door === "open" ? "/door-open-dark.svg" : "/door-closed-dark.svg"
        : door === "open" ? "/door-open-light.svg" : "/door-closed-light.svg",
      label: door === "open" ? "Dør åpen" : "Dør lukket",
      tooltip: `${door === "open" ? "Åpnet" : "Lukket"} ${formatStatusTimestamp(doorUpdatedAt) ?? ""}`.trim(),
    },
    {
      id: "fan",
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
      id: "window",
      iconSrc: darkMode
        ? safeWindowCount > 0 ? "/window-open-dark.svg" : "/window-closed-dark.svg"
        : safeWindowCount > 0 ? "/window-open-light.svg" : "/window-closed-light.svg",
      label: safeWindowCount > 0 ? `${safeWindowCount}/3 vindu åpne` : "Vinduer lukket",
      tooltip: `${safeWindowCount > 0 ? "Åpnet" : "Lukket"} ${formatStatusTimestamp(windowUpdatedAt) ?? ""}`.trim(),
    },
  ];
  const visibleStatusItems = siteConfigReady
    ? statusItems.filter((item) => siteConfig.visibleStatuses[item.id as keyof SiteConfig["visibleStatuses"]])
    : [];
  const hasVisibleStatuses = visibleStatusItems.length > 0;
  const selectedTemperatureData = chartRange === "12h" ? temperatureData12h : temperatureData24h;
  const selectedHumidityData = chartRange === "12h" ? humidityData12h : humidityData24h;
  const chartRangeLabel = chartRange === "12h" ? "siste 12 timer" : "siste 24 timer";
  const chartXAxisInterval = chartRange === "12h" ? 0 : 2;
  const analysisDate = plantAnalysis?.generatedAt ? new Date(plantAnalysis.generatedAt) : null;
  const analysisDateLabel =
    analysisDate && Number.isFinite(analysisDate.getTime())
      ? analysisDate.toLocaleDateString("nb-NO", { day: "numeric", month: "long" })
      : "";
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
  const activePlantAnalysisTheme = heroImageConfig?.plantAnalysisTheme ?? siteConfig.plantAnalysisTheme;
  const plantTheme = darkMode ? activePlantAnalysisTheme.dark : activePlantAnalysisTheme.light;
  const sectionHeaderTextStyle: CSSProperties = {
    color: plantTheme.titleColor,
    fontFamily: "Inter, sans-serif",
    fontWeight: 500,
  };
  const activeSeason = siteConfig.plantSeasons[String(siteConfig.activePlantSeasonYear)] ?? [];
  const libraryById = new Map(siteConfig.plantLibrary.map((plant) => [plant.id, plant]));
  const seasonById = new Map(activeSeason.map((entry) => [entry.id, entry]));
  const seasonByLibraryId = new Map(activeSeason.map((entry) => [entry.libraryId, entry]));
  const plantById = new Map(siteConfig.plants.map((plant) => [plant.id, plant]));
  const isPlantSeasonOver = (season: PlantSeasonEntry | undefined | null) => {
    if (!season?.harvestDate) return false;
    const date = new Date(`${season.harvestDate}T23:59:59`);
    return Number.isFinite(date.getTime()) && date <= new Date();
  };
  const plantSortIndex = new Map<string, number>();
  activeSeason.forEach((plant, index) => {
    plantSortIndex.set(plant.id, index);
    plantSortIndex.set(plant.libraryId, index);
  });
  const resolveSeasonEntryForItem = (item: PlantAnalysisResponse["items"][number]) =>
    seasonById.get(item.id) ||
    (item.libraryId ? seasonByLibraryId.get(item.libraryId) : undefined) ||
    seasonByLibraryId.get(item.id);
  const resolveLibraryEntryForItem = (item: PlantAnalysisResponse["items"][number]) => {
    const season = resolveSeasonEntryForItem(item);
    return season ? libraryById.get(season.libraryId) : (item.libraryId ? libraryById.get(item.libraryId) : libraryById.get(item.id));
  };
  const analysisBySeasonId = new Map((plantAnalysis?.items || []).map((item) => [item.id, item]));
  const analysisByLibraryId = new Map((plantAnalysis?.items || []).map((item) => [item.libraryId || item.id, item]));
  const sortedPlantAnalysisItems = activeSeason
    .filter((season) => season.active)
    .sort((a, b) => {
      const aOver = isPlantSeasonOver(a);
      const bOver = isPlantSeasonOver(b);
      if (aOver !== bOver) return aOver ? 1 : -1;
      return (plantSortIndex.get(a.id) ?? 9999) - (plantSortIndex.get(b.id) ?? 9999);
    })
    .map((season) => {
      const library = libraryById.get(season.libraryId);
      const analysis = analysisBySeasonId.get(season.id) || analysisByLibraryId.get(season.libraryId);
      if (analysis) return { ...analysis, seasonOver: isPlantSeasonOver(season) };
      return {
        id: season.id,
        libraryId: season.libraryId,
        name: library?.name || "Plante",
        plantType: library?.plantType || "",
        plantingPlace: season.plantingPlace,
        status: isPlantSeasonOver(season) ? "sesong over" : "følg med",
        summary: "",
        watch: "",
        detail: "",
        forecast: "",
        seasonOver: isPlantSeasonOver(season),
      };
    });
  const getPlantPillBg = (status: PlantAnalysisResponse["items"][number]["status"]) =>
    status === "sesong over"
      ? plantTheme.watchTextColor
      :
    status === "trives"
      ? plantTheme.thrivingPillBg
      : status === "følg med"
        ? plantTheme.watchPillBg
        : plantTheme.stressPillBg;
  const activePlantItem =
    selectedPlantIndex !== null && sortedPlantAnalysisItems[selectedPlantIndex]
      ? sortedPlantAnalysisItems[selectedPlantIndex]
      : null;
  const plantAnalysisSummary =
    plantAnalysis?.contextSummary ||
    "Analyse og tips oppdateres når ny planteanalyse er kjørt.";
  const activeSeasonEntry = activePlantItem ? resolveSeasonEntryForItem(activePlantItem) : null;
  const activeLibraryEntry = activePlantItem ? resolveLibraryEntryForItem(activePlantItem) : null;
  const plantTypeTagColor = (plantType: string | undefined) => {
    switch (plantType) {
      case "Urte":
        return "#668b39";
      case "Blomst":
        return "#cf6f9b";
      case "Frukt":
        return "#d28c31";
      default:
        return "#5190a1";
    }
  };
  const formatDate = (value: string) => {
    if (!value) return "";
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("nb-NO", { day: "numeric", month: "numeric", year: "numeric" });
  };
  const renderPlantFact = (label: string, lines: Array<string | undefined>) => {
    const values = lines.filter((line): line is string => Boolean(line && line.trim()));
    if (values.length === 0) return null;
    return (
      <div>
        <dt className="text-xs font-semibold" style={{ color: plantTheme.titleColor }}>{label}</dt>
        {values.map((value) => (
          <dd key={value} className="mt-1 text-xs leading-snug" style={{ color: plantTheme.ingressColor }}>{value}</dd>
        ))}
      </div>
    );
  };
  const renderPlantImage = (item: PlantAnalysisResponse["items"][number], sizeClass: string, labelClass = "text-[11px]") => {
    const season = resolveSeasonEntryForItem(item);
    const library = resolveLibraryEntryForItem(item);
    const plant = plantById.get(item.id);
    const image = library?.image || plant?.image ? resolveGreenhouseAssetUrl(library?.image || plant?.image || "") : "";

    return image ? (
      <img src={image} alt={item.name} className={`${sizeClass} object-cover`} />
    ) : (
      <span className={`grid ${sizeClass} place-items-center px-2 text-center ${labelClass}`} style={{ color: plantTheme.ingressColor }}>
        Mangler bilde
      </span>
    );
  };
  const renderPlantBottomSheet = (
    item: PlantAnalysisResponse["items"][number],
    library: PlantLibraryEntry | null | undefined,
    season: PlantSeasonEntry | null | undefined
  ) => {
    const plantName = library?.name || item.name;
    const plantType = library?.plantType || item.plantType || "";
    const image = library?.image ? resolveGreenhouseAssetUrl(library.image) : "";
    const seasonOver = isPlantSeasonOver(season);
    const factRows = [
      renderPlantFact("Planten er sådd", season?.acquisition === "seed" ? [formatDate(season.seedDate), season.seedLocation] : []),
      renderPlantFact("Anskaffelse", season?.acquisition === "plant" ? ["Anskaffet som plante", season.purchaseSource] : [season?.purchaseSource]),
      renderPlantFact("Plassert i drivhuset", [formatDate(season?.greenhouseDate || "")]),
      renderPlantFact("Utplanting / høsting", [formatDate(season?.harvestDate || "")]),
      renderPlantFact("Plantested", [season?.plantingPlace]),
    ].filter(Boolean);

    const panelContent = (mobileDrawer: boolean, showTitle = true) => (
      <>
        {!mobileDrawer && (
          <button
            type="button"
            onClick={() => setSelectedPlantIndex(null)}
            className="absolute right-4 top-4 hidden size-9 place-items-center rounded-full border md:grid"
            style={{ borderColor: plantTheme.cardBorder, color: plantTheme.titleColor }}
            aria-label="Lukk plantekort"
          >
            <XIcon className="size-4" />
          </button>
        )}
        {showTitle && <h3 className="pr-10 text-2xl font-medium leading-tight" style={{ color: plantTheme.titleColor }}>{plantName}</h3>}
        {mobileDrawer ? (
          <div className={showTitle ? "mt-4 grid grid-cols-[minmax(0,1fr)_128px] items-start gap-4" : "grid grid-cols-[minmax(0,1fr)_128px] items-start gap-4"}>
            <div className="min-w-0">
              {plantType && (
                <span className="inline-flex rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.04em]" style={{ borderColor: plantTypeTagColor(plantType), color: plantTypeTagColor(plantType) }}>
                  {plantType}
                </span>
              )}
              {library?.description && (
                <p className="mt-3 text-sm italic leading-snug text-black" style={{ color: plantTheme.titleColor }}>
                  {library.description}
                </p>
              )}
            </div>
            <div className="aspect-square overflow-hidden rounded-full">
              {image ? (
                <img src={image} alt={plantName} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center bg-black/5 px-2 text-center text-xs">Mangler bilde</div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className={showTitle ? "mt-4 overflow-hidden rounded-none" : "overflow-hidden rounded-none"}>
              {image ? (
                <img src={image} alt={plantName} className="h-44 w-full object-cover" />
              ) : (
                <div className="grid h-44 w-full place-items-center bg-black/5 text-sm">Mangler bilde</div>
              )}
            </div>
            {plantType && (
              <span className="mt-4 inline-flex self-start rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.04em]" style={{ borderColor: plantTypeTagColor(plantType), color: plantTypeTagColor(plantType) }}>
                {plantType}
              </span>
            )}
            {library?.description && (
              <p className="mt-3 text-sm italic leading-snug text-black md:text-sm" style={{ color: plantTheme.titleColor }}>
                {library.description}
              </p>
            )}
          </>
        )}
        {seasonOver ? (
          <section className="mt-5 rounded-lg border p-4" style={{ borderColor: plantTheme.cardBorder }}>
            <span className="inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.04em]" style={{ backgroundColor: plantTheme.watchTextColor, color: plantTheme.cardBg }}>
              Sesong over
            </span>
            <p className="mt-3 text-sm leading-snug" style={{ color: plantTheme.titleColor }}>
              Denne planten er markert som ferdig for sesongen og tas ikke med i ny AI-analyse.
            </p>
          </section>
        ) : (
          <section className="mt-5 rounded-lg border p-4" style={{ borderColor: plantTheme.cardBorder }}>
            <div className="mb-3 flex items-center gap-2">
              <OpenAiIcon className="size-5" style={{ color: plantTheme.watchTextColor }} />
              <span className="rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.04em]" style={{ backgroundColor: getPlantPillBg(item.status), color: plantTheme.pillTextColor }}>
                {item.status === "trives" ? "Planten trives" : item.status}
              </span>
            </div>
            <p className="text-sm leading-snug" style={{ color: plantTheme.titleColor }}>{item.summary}</p>
            <p className="mt-2 text-sm leading-snug" style={{ color: plantTheme.watchTextColor }}>{[item.watch, item.detail].filter(Boolean).join(" ")}</p>
            {item.forecast && <p className="mt-4 text-sm font-semibold" style={{ color: plantTheme.titleColor }}>{item.forecast}</p>}
          </section>
        )}
        {factRows.length > 0 && (
          <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-5">
            {factRows}
          </dl>
        )}
      </>
    );

    if (!isDesktopViewport) {
      return (
        <VaulDrawer.Root
          open={selectedPlantIndex !== null}
          onOpenChange={(open) => {
            if (!open) setSelectedPlantIndex(null);
          }}
          direction="bottom"
          dismissible
          fixed
          modal
        >
          <VaulDrawer.Portal>
            <VaulDrawer.Overlay className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px]" />
            <VaulDrawer.Content
              className="fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto rounded-t-[28px] p-6 pb-[calc(72px+env(safe-area-inset-bottom))] pt-3 shadow-2xl outline-none"
              style={{ backgroundColor: plantTheme.cardBg, color: plantTheme.ingressColor }}
            >
              <VaulDrawer.Title className="sr-only">{plantName}</VaulDrawer.Title>
              <VaulDrawer.Description className="sr-only">
                Analyse, plantetype og sesongdata for {plantName}.
              </VaulDrawer.Description>
              <VaulDrawer.Handle className="mx-auto mb-5 block h-1.5 w-12 rounded-full bg-black/20" />
              {panelContent(true)}
            </VaulDrawer.Content>
          </VaulDrawer.Portal>
        </VaulDrawer.Root>
      );
    }

    return (
      <>
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px]"
          onClick={() => setSelectedPlantIndex(null)}
          aria-label="Lukk plantekort"
        />
        <div
          className="fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto rounded-t-[28px] p-6 pb-[calc(39px+env(safe-area-inset-bottom))] pt-3 shadow-2xl md:bottom-auto md:left-1/2 md:top-1/2 md:w-[min(720px,calc(100vw-4rem))] md:max-w-2xl md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:p-8"
          style={{ backgroundColor: plantTheme.cardBg, color: plantTheme.ingressColor }}
        >
          {panelContent(false)}
        </div>
      </>
    );
  };
  const updatePlantCardAnchor = (index: number) => {
    const section = plantSectionRef.current;
    const scroller = plantScrollerRef.current;
    const button = plantButtonRefs.current[index];
    if (!section || !scroller || !button) return;

    const sectionRect = section.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const cardWidth = Math.min(560, section.clientWidth);
    const center = buttonRect.left - sectionRect.left + buttonRect.width / 2;
    const maxLeft = Math.max(0, section.clientWidth - cardWidth);
    const left = Math.min(Math.max(center - cardWidth / 2, 0), maxLeft);
    const arrowLeft = Math.min(Math.max(center - left, 28), cardWidth - 28);
    setPlantCardAnchor({ left, width: cardWidth, arrowLeft });
  };
  const handlePlantScrollerPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const scroller = plantScrollerRef.current;
    if (!scroller) return;

    plantDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollLeft: scroller.scrollLeft,
      moved: false,
    };
  };
  const handlePlantScrollerPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const scroller = plantScrollerRef.current;
    const drag = plantDragRef.current;
    if (!scroller || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    if (Math.abs(deltaX) > 3) {
      drag.moved = true;
      scroller.scrollLeft = drag.scrollLeft - deltaX;
      event.preventDefault();
    }
  };
  const finishPlantScrollerDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = plantDragRef.current;
    if (drag.pointerId !== event.pointerId) return;

    if (drag.moved) {
      suppressPlantClickRef.current = true;
      window.setTimeout(() => {
        suppressPlantClickRef.current = false;
      }, 120);
    }

    plantDragRef.current = { pointerId: -1, startX: 0, scrollLeft: 0, moved: false };
  };

  return (
    <div className="min-h-screen transition-colors duration-300" style={{ backgroundColor: browserBackgroundColor }}>
      <div className="relative mx-auto max-w-md md:max-w-7xl md:px-8 xl:px-10">
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
        <div className="sticky top-0 z-30 px-4 py-4 md:px-8 md:py-5">
          <div className="flex items-center justify-between gap-5">
            <div className="flex items-center gap-3">
              {siteConfigReady && (
                <>
                  {customLogoSrc ? (
                    <span
                      className="block shrink-0"
                      style={{
                        width: logoSize,
                        height: logoSize,
                        backgroundColor: activeModeTheme.logoColor,
                        WebkitMask: `url("${customLogoSrc}") center / contain no-repeat`,
                        mask: `url("${customLogoSrc}") center / contain no-repeat`,
                      }}
                      aria-hidden="true"
                    />
                  ) : (
                    <GreenhouseIcon
                      className="shrink-0"
                      style={{ width: logoSize, height: logoSize, color: activeModeTheme.logoColor }}
                    />
                  )}
                  {siteConfig.branding.logoText.visible && (
                    <h1
                      className="text-xl"
                      style={{ fontFamily: `'${siteConfig.branding.logoText.font}', serif`, fontWeight: 400, color: activeModeTheme.logoColor }}
                    >
                      {siteConfig.branding.logoText.text}
                    </h1>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Refresh Button */}
              <button
                onClick={() => loadData(true)}
                disabled={refreshing}
                className={`rounded-full p-2 transition-colors disabled:opacity-50 md:hidden ${headerButtonClass}`}
                aria-label="Oppdater data"
              >
                <RefreshCwIcon className={`h-5 w-5 ${headerTextClass} ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              
              {/* Dark Mode Slider */}
              <button
                onClick={toggleDarkMode}
                className={`relative h-8 w-16 rounded-full p-1 transition-colors ${headerButtonClass}`}
                aria-label="Bytt modus"
              >
                <div className="flex items-center justify-between px-1 h-full">
                  <SunIcon className={`h-4 w-4 ${headerTextClass}`} />
                  <MoonIcon className={`h-4 w-4 ${headerTextClass}`} />
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
          className={`overflow-hidden bg-red-500 px-4 text-sm text-white transition-all duration-300 md:mx-8 md:rounded-b-xl md:px-6 ${
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

        <main className="md:px-8 md:py-8">
          <div className="md:space-y-8">
            {siteConfigReady && siteConfig.showHeroImage && (
              <section>
                {/* Hero Image */}
                <div className={`relative h-[200px] w-full overflow-hidden md:mb-0 md:aspect-[3/1] md:h-auto md:rounded-2xl ${temperatureAlert ? "mb-0" : "mb-6"}`}>
                  {heroImageConfig ? (
                    <>
                      {heroMobileVideoSrc ? (
                        <video
                          key={heroMobileVideoSrc}
                          className="h-full w-full object-cover object-center md:hidden"
                          autoPlay
                          muted
                          loop
                          playsInline
                          preload="auto"
                          poster={heroMobileImageSrc}
                          src={heroMobileVideoSrc}
                          aria-label="Drivhus"
                        />
                      ) : null}
                      <picture className={heroMobileVideoSrc ? "hidden h-full w-full md:block" : "block h-full w-full"}>
                        <source media="(min-width: 768px)" srcSet={heroDesktopImageSrc} />
                        <ImageWithFallback
                          src={heroMobileImageSrc}
                          alt="Drivhus"
                          className="h-full w-full object-cover object-center"
                        />
                      </picture>
                    </>
                  ) : null}
                  {temperatureAlert && (
                    <div
                      className="pointer-events-none absolute inset-0 opacity-45"
                      style={{
                        background: `linear-gradient(135deg, ${temperatureAlert.color}44 0%, transparent 42%, ${temperatureAlert.color}26 100%)`,
                      }}
                    />
                  )}
                  {temperatureAlert && (
                    <div
                      className="greenhouse-alert-ticker pointer-events-none absolute inset-x-0 bottom-0 z-20 hidden overflow-hidden py-2 text-white md:block"
                      style={{ "--alert-color": temperatureAlert.color } as React.CSSProperties}
                    >
                      {renderTemperatureAlertTicker()}
                    </div>
                  )}
                  
                  {/* Weather Widget Overlay */}
                  {weatherLoading ? (
                    <div className="absolute bottom-4 right-4 top-4">
                      <WeatherWidgetSkeleton />
                    </div>
                  ) : weatherData ? (
                    <div className="absolute bottom-4 right-4 top-4 md:bottom-5 md:left-auto md:right-5 md:top-5">
                      <Suspense fallback={<WeatherWidgetSkeleton />}>
                        <WeatherWidget data={weatherData} compact rainToday={rainToday} />
                      </Suspense>
                    </div>
                  ) : null}
                </div>
                {temperatureAlert && (
                  <div
                    className="greenhouse-alert-ticker overflow-hidden py-2 text-white md:hidden"
                    style={{ "--alert-color": temperatureAlert.color } as React.CSSProperties}
                  >
                    {renderTemperatureAlertTicker("text-xs")}
                  </div>
                )}
              </section>
            )}

            <section
              className={`px-4 pb-6 md:grid md:gap-8 md:px-0 md:pb-0 md:pt-0 ${
                siteConfigReady && !siteConfig.showHeroImage ? "pt-5" : ""
              } ${
                siteConfigReady && siteConfig.showHeroImage && temperatureAlert ? "pt-[10px] md:pt-0" : ""
              } ${hasVisibleStatuses ? "md:grid-cols-2" : "md:grid-cols-1"}`}
            >
              {/* Climate Metrics */}
              <div
                className={`mb-7 pt-1 md:mb-0 md:flex md:items-center md:rounded-2xl md:border md:p-6 md:shadow-lg md:shadow-black/5 md:backdrop-blur-sm ${
                  darkMode ? "md:border-white/10 md:bg-white/[0.045]" : "md:border-white/25 md:bg-white/25"
                }`}
              >
                {loading ? (
                  <ClimateMetricsSkeleton darkMode={darkMode} theme={activeDisplayTheme} />
                ) : (
                  <div
                    key={`climate-${temperature}-${humidity}`}
                    className="grid w-full grid-cols-2 gap-3 opacity-100 transition-opacity duration-300 sm:gap-4 xl:gap-6"
                  >
                    <ClimateMetric
                      label="Temperatur"
                      value={temperature}
                      unit="°C"
                      warningMessage={getTemperatureWarningMessage(temperature)}
                      min={temperatureMinMax.min}
                      max={temperatureMinMax.max}
                      darkMode={darkMode}
                      theme={activeDisplayTheme}
                    />
                    <ClimateMetric
                      label="Luftfuktighet"
                      value={humidity}
                      unit="%"
                      warningMessage={getHumidityWarningMessage(humidity)}
                      min={humidityMinMax.min}
                      max={humidityMinMax.max}
                      darkMode={darkMode}
                      theme={activeDisplayTheme}
                    />
                  </div>
                )}
              </div>

              {!loading && hasVisibleStatuses && (
                <div
                  className={`md:relative md:flex md:flex-col md:justify-center md:rounded-2xl md:border md:p-6 md:shadow-lg md:shadow-black/5 md:backdrop-blur-sm ${
                    darkMode ? "md:border-white/10 md:bg-white/[0.045]" : "md:border-white/25 md:bg-white/25"
                  }`}
                >
                  <DeviceStatusRow items={visibleStatusItems} darkMode={darkMode} theme={activeDisplayTheme} desktopCardLayout />
                </div>
              )}
            </section>

            {siteConfig.visibleStatuses.plantAnalysis && sortedPlantAnalysisItems.length > 0 && (
              <section ref={plantSectionRef} className="space-y-4 px-4 pb-6 md:space-y-5 md:px-0 md:pb-0">
                <div className="flex items-center gap-2 px-1">
                  <button
                    type="button"
                    className={`grid min-h-9 min-w-9 place-items-center rounded-full transition-colors ${
                      darkMode ? "text-white/45 hover:text-white/70" : "text-stone-500 hover:text-stone-700"
                    }`}
                    onClick={() => setPlantAnalysisExpanded((expanded) => !expanded)}
                    aria-expanded={plantAnalysisExpanded}
                    aria-controls="plant-analysis-panel"
                    aria-label={plantAnalysisExpanded ? "Lukk analyse og tips" : "Åpne analyse og tips"}
                  >
                    <ChevronDownIcon className={`size-4 transition-transform duration-300 ${plantAnalysisExpanded ? "rotate-0" : "-rotate-90"}`} />
                  </button>
                  <OpenAiIcon className="size-5 shrink-0" style={{ color: activeModeTheme.symbolColor }} />
                  <h2 className="flex items-baseline gap-2 text-lg leading-none md:text-xl" style={sectionHeaderTextStyle}>
                    <span>Analyse og tips</span>
                    {analysisDateLabel && <span style={{ fontWeight: 300 }}>{analysisDateLabel}</span>}
                  </h2>
                </div>
                <div
                  id="plant-analysis-panel"
                  className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ${
                    plantAnalysisExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="min-h-0 space-y-4 overflow-hidden md:space-y-5">
                    <div className="px-1 text-sm font-medium leading-snug md:max-w-4xl md:text-base" style={{ color: plantTheme.ingressColor }}>
                      <p>{plantAnalysisSummary}</p>
                    </div>
                    <div
                      ref={plantScrollerRef}
                      className="greenhouse-no-scrollbar greenhouse-horizontal-fade greenhouse-viewport-scroller -mb-4 cursor-grab overflow-x-auto px-4 pb-6 pt-3 active:cursor-grabbing md:-mx-8 md:mb-0 md:px-8 md:pb-3 md:pt-3 xl:-mx-10 xl:px-10"
                      onPointerDown={handlePlantScrollerPointerDown}
                      onPointerMove={handlePlantScrollerPointerMove}
                      onPointerUp={finishPlantScrollerDrag}
                      onPointerCancel={finishPlantScrollerDrag}
                      onScroll={() => {
                        if (selectedPlantIndex !== null) updatePlantCardAnchor(selectedPlantIndex);
                      }}
                    >
                      <div className="flex w-max gap-3 pr-4 md:gap-2">
                        {sortedPlantAnalysisItems.map((item, index) => {
                          const isActive = selectedPlantIndex === index;
                          const ringColor = getPlantPillBg(item.status);
                          const libraryPlant = resolveLibraryEntryForItem(item);
                          const displayName = libraryPlant?.name || item.name;
                          const season = resolveSeasonEntryForItem(item);
                          const seasonOver = isPlantSeasonOver(season);

                          return (
                            <button
                              ref={(node) => {
                                plantButtonRefs.current[index] = node;
                              }}
                              key={item.id}
                              type="button"
                              onClick={(event) => {
                                if (suppressPlantClickRef.current) {
                                  event.preventDefault();
                                  return;
                                }
                                setSelectedPlantIndex((current) => {
                                  if (current === index) return null;
                                  window.requestAnimationFrame(() => updatePlantCardAnchor(index));
                                  return index;
                                });
                              }}
                              className={`group flex w-[96px] shrink-0 flex-col items-center justify-start gap-2 text-center md:w-[118px] ${seasonOver ? "opacity-70" : ""}`}
                              aria-label={`Vis analyse for ${displayName}`}
                              aria-current={isActive ? "true" : undefined}
                            >
                              <span
                                className={`grid size-[92px] place-items-center rounded-full border-[3px] p-1 transition-all md:size-[106px] ${
                                  isActive ? "scale-105" : "scale-100"
                                }`}
                                style={{
                                  borderColor: ringColor,
                                  backgroundColor: isActive ? "rgba(255,255,255,0.9)" : seasonOver ? "rgba(255,255,255,0.22)" : "transparent",
                                  boxShadow: isActive ? `0 0 0 5px rgba(255,255,255,0.62), 0 10px 28px ${ringColor}55` : "none",
                                }}
                              >
                                <span className="grid size-full overflow-hidden rounded-full bg-black/5">
                                  {renderPlantImage(item, "h-full w-full", "text-[10px]")}
                                </span>
                              </span>
                              <span className="line-clamp-2 min-h-8 text-[10px] font-semibold leading-tight md:text-[11px]" style={{ color: plantTheme.titleColor }}>
                                {displayName}
                              </span>
                              {seasonOver && (
                                <span className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.04em]" style={{ backgroundColor: plantTheme.watchTextColor, color: plantTheme.cardBg }}>
                                  Sesong over
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {activePlantItem && (
                      renderPlantBottomSheet(activePlantItem, activeLibraryEntry, activeSeasonEntry)
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* Trend Charts */}
            {!loading && siteConfig.visibleStatuses.charts && (
              <section className="space-y-3 px-4 pb-6 md:space-y-4 md:px-0 md:pb-0">
              <div className="flex items-center justify-between gap-3 px-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={`grid min-h-9 min-w-9 place-items-center rounded-full transition-colors ${
                      darkMode ? "text-white/45 hover:text-white/70" : "text-stone-500 hover:text-stone-700"
                    }`}
                    onClick={() => setChartsExpanded((expanded) => !expanded)}
                    aria-expanded={chartsExpanded}
                    aria-controls="chart-panel"
                    aria-label={chartsExpanded ? "Lukk grafer" : "Åpne grafer"}
                  >
                    <ChevronDownIcon className={`size-4 transition-transform duration-300 ${chartsExpanded ? "rotate-0" : "-rotate-90"}`} />
                  </button>
                  <h2
                    className="text-lg leading-none md:text-xl"
                    style={sectionHeaderTextStyle}
                  >
                    Grafer
                  </h2>
                </div>
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
                <div className="md:hidden">
                  <CollapsedChartPreview
                    temperatureData={selectedTemperatureData}
                    humidityData={selectedHumidityData}
                    darkMode={darkMode}
                    theme={activeDisplayTheme}
                    loading={historyLoading}
                    onClick={() => setChartsExpanded(true)}
                  />
                </div>
              )}

              <div
                id="chart-panel"
                className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ${
                  chartsExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="min-h-0 overflow-hidden">
                  {historyLoading ? (
                    <ChartSkeleton darkMode={darkMode} theme={activeDisplayTheme} />
                  ) : (
                    <Suspense fallback={<ChartSkeleton darkMode={darkMode} theme={activeDisplayTheme} />}>
                      <div className="space-y-3">
                        <Carousel
                          setApi={setChartCarouselApi}
                          opts={{ align: "start", containScroll: "trimSnaps" }}
                          className="w-full"
                          aria-label="Grafer for temperatur og luftfuktighet"
                        >
                          <CarouselContent className="ml-0 pb-5 pt-1 md:grid md:grid-cols-2 md:gap-4 md:pb-0">
                            <CarouselItem className="px-3 md:min-w-0 md:px-0">
                              <TrendChart
                                title={`Temperatur ${chartRangeLabel}`}
                                data={selectedTemperatureData}
                                color={chartLineColors.temperature}
                                unit="°C"
                                darkMode={darkMode}
                                theme={activeDisplayTheme}
                                xAxisInterval={chartXAxisInterval}
                                thresholdLine={
                                  temperatureAlert
                                    ? {
                                        value: temperatureAlert.threshold,
                                        label: temperatureAlert.tone === "hot" ? "For varmt" : "For kaldt",
                                        color: temperatureAlert.color,
                                      }
                                    : undefined
                                }
                              />
                            </CarouselItem>
                            <CarouselItem className="px-3 md:min-w-0 md:px-0">
                              <TrendChart
                                title={`Luftfuktighet ${chartRangeLabel}`}
                                data={selectedHumidityData}
                                color={darkMode ? chartLineColors.humidityDark : chartLineColors.humidityLight}
                                unit="%"
                                darkMode={darkMode}
                                theme={activeDisplayTheme}
                                xAxisInterval={chartXAxisInterval}
                              />
                            </CarouselItem>
                          </CarouselContent>
                        </Carousel>
                        <div className="flex items-center justify-center gap-3 md:hidden">
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
              </section>
            )}

            {/* Footer with Last Updated */}
            {lastUpdated && (
              <div className="mt-4 px-4 pb-6 md:mt-0 md:px-0 md:pb-0">
                <p className="text-center text-xs md:text-right" style={{ color: darkMode ? activeDisplayTheme.dark.mutedColor : activeDisplayTheme.light.mutedColor }}>
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
        </main>
      </div>
    </div>
  );
}
