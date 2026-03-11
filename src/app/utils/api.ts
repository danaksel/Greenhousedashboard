export interface HistoryData {
  temperature: Array<{ time: string; value: number | null; timestamp: string | null; bucketStart: string | null }>;
  humidity: Array<{ time: string; value: number | null; timestamp: string | null; bucketStart: string | null }>;
}

export interface WeatherData {
  temperature: number;
  symbolCode: string;
  description: string;
}

export async function fetchLatestGreenhouseData(): Promise<LatestData> {
  const res = await fetch("https://drivhus.dan-aksel.workers.dev/api/latest", {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    },
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  const json = await res.json();
  const data = json.data || {};

  return {
    temperature: data.temperature,
    humidity: data.humidity,
    updatedAt: data.updatedAt,
    temperatureUpdatedAt: data.temperatureUpdatedAt,
    humidityUpdatedAt: data.humidityUpdatedAt
  };
}

export async function fetchGreenhouseHistory(): Promise<HistoryData> {
  const res = await fetch("https://drivhus.dan-aksel.workers.dev/api/history", {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    },
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  const json = await res.json();
  const data = json.data || {};

  return {
    temperature: data.temperature || [],
    humidity: data.humidity || []
  };
}

// Map Yr symbol codes to Norwegian descriptions
const weatherDescriptions: Record<string, string> = {
  clearsky_day: "Sol",
  clearsky_night: "Klar himmel",
  fair_day: "Lettskyet",
  fair_night: "Lettskyet",
  partlycloudy_day: "Delvis skyet",
  partlycloudy_night: "Delvis skyet",
  cloudy: "Overskyet",
  lightrainshowers_day: "Lette regnbyger",
  lightrainshowers_night: "Lette regnbyger",
  rainshowers_day: "Regnbyger",
  rainshowers_night: "Regnbyger",
  heavyrainshowers_day: "Kraftige regnbyger",
  heavyrainshowers_night: "Kraftige regnbyger",
  lightrain: "Lett regn",
  rain: "Regn",
  heavyrain: "Kraftig regn",
  lightsleet: "Sludd",
  sleet: "Sludd",
  heavysleet: "Kraftig sludd",
  lightsnow: "Lett snø",
  snow: "Snø",
  heavysnow: "Kraftig snø",
  fog: "Tåke",
  thunderstorm: "Tordenvær",
};

export async function fetchWeatherData(): Promise<WeatherData> {
  // Coordinates for Høybråtan, Nesodden
  const lat = 59.87;
  const lon = 10.67;
  
  const res = await fetch(
    `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`,
    {
      method: "GET",
      headers: {
        "User-Agent": "KristinsDrivhus/1.0 (github.com/yourusername/drivhus)"
      },
      cache: "no-store"
    }
  );

  if (!res.ok) {
    throw new Error(`Weather API error: ${res.status}`);
  }

  const json = await res.json();
  const current = json.properties?.timeseries?.[0];
  
  if (!current) {
    throw new Error("No weather data available");
  }

  const symbolCode = current.data?.next_1_hours?.summary?.symbol_code || 
                     current.data?.next_6_hours?.summary?.symbol_code || 
                     "cloudy";
  const temperature = current.data?.instant?.details?.air_temperature || 0;

  // Get base symbol without polarity variants (_polarlight, _polartwilight)
  const baseSymbol = symbolCode.split("_polarlight")[0].split("_polartwilight")[0];
  const description = weatherDescriptions[baseSymbol] || weatherDescriptions[symbolCode] || "Ukjent";

  return {
    temperature,
    symbolCode: baseSymbol,
    description
  };
}