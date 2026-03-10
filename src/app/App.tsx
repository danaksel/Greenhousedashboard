import { MetricCard } from "./components/metric-card";
import { TrendChart } from "./components/trend-chart";
import { Droplets, Thermometer, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { fetchLatestGreenhouseData, fetchGreenhouseHistory } from "./utils/api";

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

      // Transform temperature history data
      const tempHistory = history.temperature || [];
      const tempTimes = tempHistory.map(item => item.time);
      const tempRawValues = tempHistory.map(item => item.value);
      const tempFilledValues = fillForward(tempRawValues);
      
      const tempData = tempTimes.map((time, index) => ({
        time: time,
        value: tempFilledValues[index],
        id: `temp-${time}-${index}`
      }))
      .filter(item => {
        // Only show every third hour (00:00, 03:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00)
        const hour = parseInt(item.time.split(':')[0]);
        return hour % 3 === 0 && item.value !== null;
      }) as Array<{ time: string; value: number; id: string }>;
      
      // Transform humidity history data
      const humHistory = history.humidity || [];
      const humTimes = humHistory.map(item => item.time);
      const humRawValues = humHistory.map(item => item.value);
      const humFilledValues = fillForward(humRawValues);
      
      const humData = humTimes.map((time, index) => ({
        time: time,
        value: humFilledValues[index],
        id: `hum-${time}-${index}`
      }))
      .filter(item => {
        // Only show every third hour (00:00, 03:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00)
        const hour = parseInt(item.time.split(':')[0]);
        return hour % 3 === 0 && item.value !== null;
      }) as Array<{ time: string; value: number; id: string }>;

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
    if (temp < 18 || temp > 28) return "warning";
    return "normal";
  };

  const getHumidityStatus = (humidity: number) => {
    if (humidity < 50 || humidity > 80) return "warning";
    return "normal";
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-teal-50 p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl mb-2 text-emerald-900">Greenhouse Monitor</h1>
          <p className="text-sm text-emerald-700">
            Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : "N/A"}
          </p>
          {refreshing && <RefreshCw className="w-4 h-4 inline-block animate-spin ml-2" />}
        </div>

        {/* Metric Cards */}
        <div className="space-y-4 mb-6">
          <MetricCard
            icon={<Thermometer className="w-8 h-8" />}
            label="Temperature"
            value={temperature}
            unit="°C"
            status={temperature !== null ? getTemperatureStatus(temperature) : "normal"}
            iconColor="text-orange-500"
          />
          <MetricCard
            icon={<Droplets className="w-8 h-8" />}
            label="Humidity"
            value={humidity}
            unit="%"
            status={humidity !== null ? getHumidityStatus(humidity) : "normal"}
            iconColor="text-blue-500"
          />
        </div>

        {/* Trend Charts */}
        <div className="space-y-4">
          <TrendChart
            title="Temperature (24h)"
            data={temperatureData}
            color="#f97316"
            unit="°C"
          />
          <TrendChart
            title="Humidity (24h)"
            data={humidityData}
            color="#3b82f6"
            unit="%"
          />
        </div>
      </div>
    </div>
  );
}