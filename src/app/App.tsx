import { useState, useEffect } from "react";
import { MetricCard } from "./components/metric-card";
import { MetricCardSkeleton } from "./components/metric-card-skeleton";
import { ChartSkeleton } from "./components/chart-skeleton";
import { TrendChart } from "./components/trend-chart";
import { Thermometer, Droplets, RefreshCw, Moon, Sun, WifiOff } from "lucide-react";
import { fetchLatestGreenhouseData, fetchGreenhouseHistory, fetchWeatherData, type WeatherData } from "./utils/api";
import { ImageWithFallback } from "./components/figma/ImageWithFallback";
import { GreenhouseIcon } from "./components/greenhouse-icon";
import { WeatherWidget } from "./components/weather-widget";
import PullToRefresh from "react-pull-to-refresh";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [temperature, setTemperature] = useState<number | null>(null);
  const [humidity, setHumidity] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [temperatureUpdatedAt, setTemperatureUpdatedAt] = useState<Date | null>(null);
  const [humidityUpdatedAt, setHumidityUpdatedAt] = useState<Date | null>(null);
  const [temperatureData, setTemperatureData] = useState<Array<{ time: string; value: number; id: string }>>([]);
  const [humidityData, setHumidityData] = useState<Array<{ time: string; value: number; id: string }>>([]);
  const [loading, setLoading] = useState(true);
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

  const loadData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Fetch latest data
      const latest = await fetchLatestGreenhouseData();
      setTemperature(latest.temperature);
      setHumidity(latest.humidity);
      setLastUpdated(new Date(latest.updatedAt));
      setTemperatureUpdatedAt(new Date(latest.temperatureUpdatedAt));
      setHumidityUpdatedAt(new Date(latest.humidityUpdatedAt));

      // Fetch historical data
      const history = await fetchGreenhouseHistory();
      
      // Get current hour as the endpoint
      const now = new Date();
      const currentHour = now.getHours();
      
      // Generate list of hours to display (every 2nd hour going back 12 hours)
      const hoursToShow: number[] = [];
      for (let i = 0; i < 7; i++) { // 7 points * 2 hours = 12 hours span
        const hour = (currentHour - (i * 2) + 24) % 24;
        hoursToShow.unshift(hour); // Add to beginning so oldest is first
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
      const processHistoryData = (historyItems: Array<{ time: string; value: number | null }>, prefix: string) => {
        const times = historyItems.map(item => item.time);
        const rawValues = historyItems.map(item => item.value);
        const filledValues = fillForward(rawValues);
        
        // Create a map to store the last occurrence of each hour
        const hourMap = new Map<number, { time: string; value: number | null; originalIndex: number }>();
        
        times.forEach((time, index) => {
          const hour = parseInt(time.split(':')[0]);
          // Always update with the latest occurrence of this hour
          hourMap.set(hour, {
            time: time,
            value: filledValues[index],
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
                originalIndex: item.originalIndex
              };
            }
            return null;
          })
          .filter(item => item !== null)
          .map((item, finalIndex) => (({
            time: item!.time,
            value: item!.value as number,
            id: `${prefix}-${finalIndex}-${item!.hour}`
          })));
        
        return result;
      };

      // Transform temperature and humidity history data
      const tempData = processHistoryData(history.temperature || [], 'temp');
      const humData = processHistoryData(history.humidity || [], 'hum');

      setTemperatureData(tempData);
      setHumidityData(humData);

      // Fetch weather data
      try {
        const weather = await fetchWeatherData();
        console.log('Weather data fetched:', weather);
        setWeatherData(weather);
      } catch (weatherErr) {
        console.error('Failed to fetch weather data:', weatherErr);
        // Don't set error state for weather failures - just skip showing weather
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();

    // Auto-refresh every 15 minutes
    const interval = setInterval(() => {
      loadData(true);
    }, 900000);

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

    // Set page title
    document.title = 'Kristins drivhus';

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [darkMode]);

  // Toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode(prev => {
      const newValue = !prev;
      localStorage.setItem("darkMode", String(newValue));
      return newValue;
    });
  };

  // Manual refresh handler
  const handleRefresh = async () => {
    await loadData(true);
  };

  const getTemperatureStatus = (temp: number) => {
    if (temp < 12 || temp > 28) return "warning";
    return "normal";
  };

  const getHumidityStatus = (humidity: number) => {
    if (humidity < 50 || humidity > 80) return "warning";
    return "normal";
  };

  const getTemperatureWarningMessage = (temp: number | null) => {
    if (temp === null) return undefined;
    if (temp < 12) {
      return `Temperaturen er ${temp.toFixed(1)}°C, som er under det anbefalte minimumet på 12°C. Dette kan skade plantene.`;
    }
    if (temp > 28) {
      return `Temperaturen er ${temp.toFixed(1)}°C, som er over det anbefalte maksimum på 28°C. Dette kan stresse plantene.`;
    }
    return undefined;
  };

  const getHumidityWarningMessage = (humidity: number | null) => {
    if (humidity === null) return undefined;
    if (humidity < 50) {
      return `Luftfuktigheten er ${humidity.toFixed(1)}%, som er under det anbefalte minimumet på 50%. Plantene kan tørke ut.`;
    }
    if (humidity > 80) {
      return `Luftfuktigheten er ${humidity.toFixed(1)}%, som er over det anbefalte maksimum på 80%. Dette kan føre til mugg og sykdom.`;
    }
    return undefined;
  };

  // Calculate min/max from historical data
  const getMinMax = (data: Array<{ time: string; value: number; id: string }>) => {
    if (data.length === 0) return { min: undefined, max: undefined };
    const values = data.map(d => d.value);
    return {
      min: Math.min(...values),
      max: Math.max(...values)
    };
  };

  // Calculate trend by comparing current value with recent history
  const getTrend = (currentValue: number | null, historicalData: Array<{ time: string; value: number; id: string }>): "up" | "down" | "stable" | undefined => {
    if (currentValue === null || historicalData.length < 3) return undefined;
    
    // Get last 3 data points
    const recentData = historicalData.slice(-3).map(d => d.value);
    const average = recentData.reduce((sum, val) => sum + val, 0) / recentData.length;
    
    // If current value differs by more than 0.5 from average, show trend
    const diff = currentValue - average;
    if (Math.abs(diff) < 0.5) return "stable";
    return diff > 0 ? "up" : "down";
  };

  const temperatureMinMax = getMinMax(temperatureData);
  const humidityMinMax = getMinMax(humidityData);
  const temperatureTrend = getTrend(temperature, temperatureData);
  const humidityTrend = getTrend(humidity, humidityData);

  const bgColor = darkMode ? 'bg-[#2d3a21]' : 'bg-[#f5f5f0]';
  const textColor = darkMode ? 'text-white/80' : 'text-gray-800';
  
  // Icon colors with better contrast in dark mode
  const humidityIconColor = darkMode ? 'text-[#8fbc5f]' : 'text-[#5d7342]';

  const content = (
    <div className={`min-h-screen transition-colors duration-300 ${bgColor}`}>
      <div className="max-w-md mx-auto relative">
        {/* Offline Indicator */}
        <AnimatePresence>
          {!isOnline && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white text-center py-2 px-4 text-sm flex items-center justify-center gap-2"
            >
              <WifiOff className="w-4 h-4" />
              <span>Ingen internettforbindelse</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading Progress Bar */}
        <AnimatePresence>
          {refreshing && (
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              exit={{ scaleX: 0 }}
              transition={{ duration: 0.5 }}
              className="fixed top-0 left-0 right-0 h-1 bg-[#d28c31] origin-left z-40"
              style={{ transformOrigin: "left" }}
            />
          )}
        </AnimatePresence>

        {/* Header with Logo, Title, and Controls */}
        <div className="bg-[#5d7342] px-6 py-4 sticky top-0 z-30">
          <div className="flex items-end justify-between">
            <div className="flex items-end gap-3">
              <GreenhouseIcon className="w-10 h-10 text-white" />
              <h1 className="text-2xl text-white pb-0.5" style={{ fontFamily: "'Cinzel Decorative', serif", fontWeight: 400 }}>Kristins drivhus</h1>
            </div>
            <div className="flex items-center gap-2 pb-1">
              {/* Refresh Button */}
              <button
                onClick={handleRefresh}
                disabled={refreshing || loading}
                className="p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-50"
                aria-label="Oppdater data"
              >
                <motion.div
                  animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
                  transition={refreshing ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}
                >
                  <RefreshCw className="w-5 h-5 text-white" />
                </motion.div>
              </button>
              {/* Dark Mode Toggle */}
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
                aria-label="Bytt modus"
              >
                {darkMode ? (
                  <Sun className="w-5 h-5 text-white" />
                ) : (
                  <Moon className="w-5 h-5 text-white" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-red-500 text-white px-6 py-3 text-sm"
            >
              <p className="font-semibold">Feil ved lasting av data</p>
              <p className="text-xs mt-1">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hero Image */}
        <div className="relative w-full h-32 overflow-hidden mb-6">
          <ImageWithFallback
            src="/drivhus.png" 
            alt="Drivhus" 
            className="w-full h-full object-cover object-center"
          />
          
          {/* Weather Widget Overlay */}
          {weatherData && (
            <div className="absolute top-2 right-2">
              <WeatherWidget data={weatherData} compact />
            </div>
          )}
        </div>

        <div className="px-4 pb-6">
          {/* Metric Cards with Animation */}
          <div className="space-y-4 mb-6">
            {loading ? (
              <MetricCardSkeleton />
            ) : (
              <motion.div
                key={`temp-${temperature}`}
                initial={{ opacity: 0.5 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <MetricCard
                  icon={<Thermometer className="w-8 h-8" />}
                  label="Temperatur"
                  value={temperature}
                  unit="°C"
                  status={temperature !== null ? getTemperatureStatus(temperature) : "normal"}
                  iconColor="text-[#d28c31]"
                  warningMessage={getTemperatureWarningMessage(temperature)}
                  min={temperatureMinMax.min}
                  max={temperatureMinMax.max}
                  trend={temperatureTrend}
                  updatedAt={temperatureUpdatedAt}
                  darkMode={darkMode}
                />
              </motion.div>
            )}
            {loading ? (
              <MetricCardSkeleton />
            ) : (
              <motion.div
                key={`hum-${humidity}`}
                initial={{ opacity: 0.5 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <MetricCard
                  icon={<Droplets className="w-8 h-8" />}
                  label="Luftfuktighet"
                  value={humidity}
                  unit="%"
                  status={humidity !== null ? getHumidityStatus(humidity) : "normal"}
                  iconColor={humidityIconColor}
                  warningMessage={getHumidityWarningMessage(humidity)}
                  min={humidityMinMax.min}
                  max={humidityMinMax.max}
                  trend={humidityTrend}
                  updatedAt={humidityUpdatedAt}
                  darkMode={darkMode}
                />
              </motion.div>
            )}
          </div>

          {/* Trend Charts */}
          <div className="space-y-4">
            {loading ? (
              <ChartSkeleton />
            ) : (
              <TrendChart
                title="Temperatur (12t)"
                data={temperatureData}
                color="#d28c31"
                unit="°C"
                darkMode={darkMode}
              />
            )}
            {loading ? (
              <ChartSkeleton />
            ) : (
              <TrendChart
                title="Luftfuktighet (12t)"
                data={humidityData}
                color="#5d7342"
                unit="%"
                darkMode={darkMode}
              />
            )}
          </div>

          {/* Footer with Last Updated */}
          {lastUpdated && (
            <div className="mt-6 text-center">
              <p className={`text-xs ${darkMode ? 'text-white/60' : 'text-gray-500'}`}>
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

  return (
    <PullToRefresh
      onRefresh={handleRefresh}
      resistance={3}
      refreshingContent={<div className="text-center py-4"><RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#5d7342]" /></div>}
      pullingContent={<div className="text-center py-2 text-sm text-gray-500">Dra ned for å oppdatere...</div>}
    >
      {content}
    </PullToRefresh>
  );
}