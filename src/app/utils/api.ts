export interface LatestData {
  temperature: number;
  humidity: number;
  updatedAt: string;
  temperatureUpdatedAt: string;
  humidityUpdatedAt: string;
}

export interface HistoryData {
  temperature: Array<{ time: string; value: number | null; timestamp: string | null; bucketStart: string | null }>;
  humidity: Array<{ time: string; value: number | null; timestamp: string | null; bucketStart: string | null }>;
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