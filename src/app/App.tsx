import { useState, useEffect } from "react";
import { MetricCard } from "./components/metric-card";
import { TrendChart } from "./components/trend-chart";
import { Thermometer, Droplets, RefreshCw } from "lucide-react";
import { fetchLatestGreenhouseData, fetchGreenhouseHistory } from "./utils/api";
import heroImage from "figma:asset/7cc91f1e99a12ef00b582d893b4030c395b28918.png";

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
          .map((item, finalIndex) => ({
            time: item!.time,
            value: item!.value as number,
            id: `${prefix}-${item!.hour}-${finalIndex}`
          }));
        
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

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadData(true);
    }, 30000);

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-100 to-amber-50">
      <div className="max-w-md mx-auto">
        {/* Hero Image */}
        <div className="relative w-full h-80 overflow-hidden mb-6">
          <img 
            src={heroImage} 
            alt="Drivhus" 
            className="w-full h-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <h1 className="text-4xl mb-2 text-white font-bold drop-shadow-lg">Drivhuset</h1>
            <p className="text-sm text-white/90 drop-shadow">
              Sist oppdatert: {lastUpdated ? lastUpdated.toLocaleTimeString('nb-NO') : "N/A"}
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
              iconColor="text-amber-600"
            />
            <MetricCard
              icon={<Droplets className="w-8 h-8" />}
              label="Luftfuktighet"
              value={humidity}
              unit="%"
              status={humidity !== null ? getHumidityStatus(humidity) : "normal"}
              iconColor="text-teal-600"
            />
          </div>

          {/* Trend Charts */}
          <div className="space-y-4">
            <TrendChart
              title="Temperatur (24t)"
              data={temperatureData}
              color="#d97706"
              unit="°C"
            />
            <TrendChart
              title="Luftfuktighet (24t)"
              data={humidityData}
              color="#0d9488"
              unit="%"
            />
          </div>
        </div>
      </div>
    </div>
  );
}