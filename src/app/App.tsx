import { useState, useEffect } from "react";
import { MetricCard } from "./components/metric-card";
import { TrendChart } from "./components/trend-chart";
import { Thermometer, Droplets, RefreshCw } from "lucide-react";
import { fetchLatestGreenhouseData, fetchGreenhouseHistory } from "./utils/api";
import { ImageWithFallback } from "./components/figma/ImageWithFallback";
import { GreenhouseIcon } from "./components/greenhouse-icon";

export default function App() {
  const [temperature, setTemperature] = useState<number | null>(null);
  const [humidity, setHumidity] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [temperatureData, setTemperatureData] = useState<Array<{ time: string; value: number; id: string }>>([]);
  const [humidityData, setHumidityData] = useState<Array<{ time: string; value: number; id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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

      // Fetch historical data
      const history = await fetchGreenhouseHistory();
      
      // Get current hour as the endpoint
      const now = new Date();
      const currentHour = now.getHours();
      
      // Generate list of hours to display (every 3rd hour going back 24 hours)
      const hoursToShow: number[] = [];
      for (let i = 0; i < 8; i++) { // 8 points * 3 hours = 24 hours
        const hour = (currentHour - (i * 3) + 24) % 24;
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
            id: `${prefix}-${item!.time.replace(/:/g, '')}-${item!.originalIndex}-${finalIndex}`
          })));
        
        return result;
      };

      // Transform temperature and humidity history data
      const tempData = processHistoryData(history.temperature || [], 'temp');
      const humData = processHistoryData(history.humidity || [], 'hum');

      setTemperatureData(tempData);
      setHumidityData(humData);
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

    // Set theme-color meta tag for mobile browser address bar
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.setAttribute('content', '#5d7342');

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
    document.title = 'Drivhuset';

    return () => clearInterval(interval);
  }, []);

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

  return (
    <div className="min-h-screen bg-[#5d7342]">
      <div className="max-w-md mx-auto">
        {/* Hero Image */}
        <div className="relative w-full h-80 overflow-hidden mb-6">
          <ImageWithFallback
            src="/drivhus.png" 
            alt="Drivhus" 
            className="w-full h-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="flex items-center gap-3 mb-2">
              <GreenhouseIcon className="w-10 h-10 text-white drop-shadow-lg" />
              <h1 className="text-4xl text-white font-bold drop-shadow-lg">Drivhuset</h1>
            </div>
            <p className="text-sm text-white/90 drop-shadow">
              Sist oppdatert: {lastUpdated ? lastUpdated.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }) : "N/A"}
              {refreshing && <RefreshCw className="w-4 h-4 inline-block animate-spin ml-2" />}
            </p>
          </div>
        </div>

        <div className="px-4 pb-6">
          {/* Metric Cards */}
          <div className="space-y-4 mb-6">
            <MetricCard
              icon={<Thermometer className="w-8 h-8" />}
              label="Temperatur"
              value={temperature}
              unit="°C"
              status={temperature !== null ? getTemperatureStatus(temperature) : "normal"}
              iconColor="text-[#d28c31]"
              warningMessage={getTemperatureWarningMessage(temperature)}
            />
            <MetricCard
              icon={<Droplets className="w-8 h-8" />}
              label="Luftfuktighet"
              value={humidity}
              unit="%"
              status={humidity !== null ? getHumidityStatus(humidity) : "normal"}
              iconColor="text-[#5d7342]"
              warningMessage={getHumidityWarningMessage(humidity)}
            />
          </div>

          {/* Trend Charts */}
          <div className="space-y-4">
            <TrendChart
              title="Temperatur (24t)"
              data={temperatureData}
              color="#d28c31"
              unit="°C"
            />
            <TrendChart
              title="Luftfuktighet (24t)"
              data={humidityData}
              color="#5d7342"
              unit="%"
            />
          </div>
        </div>
      </div>
    </div>
  );
}