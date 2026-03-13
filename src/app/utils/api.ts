export interface HistoryData {
  temperature: Array<{ time: string; value: number | null; timestamp: string | null; bucketStart: string | null }>;
  humidity: Array<{ time: string; value: number | null; timestamp: string | null; bucketStart: string | null }>;
}

export interface WeatherData {
  temperature: number;
  symbolCode: string;
  description: string;
  updatedAt?: Date;
  uvIndex?: number;
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
  fog: "Tåke",
  
  // Rain showers
  lightrainshowers_day: "Lette regnbyger",
  lightrainshowers_night: "Lette regnbyger",
  rainshowers_day: "Regnbyger",
  rainshowers_night: "Regnbyger",
  heavyrainshowers_day: "Kraftige regnbyger",
  heavyrainshowers_night: "Kraftige regnbyger",
  
  // Rain
  lightrain: "Lett regn",
  rain: "Regn",
  heavyrain: "Kraftig regn",
  
  // Sleet showers
  lightsleetshowers_day: "Lette sluddbyger",
  lightsleetshowers_night: "Lette sluddbyger",
  sleetshowers_day: "Sluddbyger",
  sleetshowers_night: "Sluddbyger",
  heavysleetshowers_day: "Kraftige sluddbyger",
  heavysleetshowers_night: "Kraftige sluddbyger",
  
  // Sleet
  lightsleet: "Lett sludd",
  sleet: "Sludd",
  heavysleet: "Kraftig sludd",
  
  // Snow showers
  lightsnowshowers_day: "Lette snøbyger",
  lightsnowshowers_night: "Lette snøbyger",
  snowshowers_day: "Snøbyger",
  snowshowers_night: "Snøbyger",
  heavysnowshowers_day: "Kraftige snøbyger",
  heavysnowshowers_night: "Kraftige snøbyger",
  
  // Snow
  lightsnow: "Lett snø",
  snow: "Snø",
  heavysnow: "Kraftig snø",
  
  // Thunder
  thunderstorm: "Tordenvær",
  
  // Rain and thunder
  lightrainshowersandthunder_day: "Lette regnbyger og torden",
  lightrainshowersandthunder_night: "Lette regnbyger og torden",
  rainshowersandthunder_day: "Regnbyger og torden",
  rainshowersandthunder_night: "Regnbyger og torden",
  heavyrainshowersandthunder_day: "Kraftige regnbyger og torden",
  heavyrainshowersandthunder_night: "Kraftige regnbyger og torden",
  lightrainandthunder: "Lett regn og torden",
  rainandthunder: "Regn og torden",
  heavyrainandthunder: "Kraftig regn og torden",
  
  // Sleet and thunder
  lightsleetshowersandthunder_day: "Lette sluddbyger og torden",
  lightsleetshowersandthunder_night: "Lette sluddbyger og torden",
  sleetshowersandthunder_day: "Sluddbyger og torden",
  sleetshowersandthunder_night: "Sluddbyger og torden",
  heavysleetshowersandthunder_day: "Kraftige sluddbyger og torden",
  heavysleetshowersandthunder_night: "Kraftige sluddbyger og torden",
  lightsleetandthunder: "Lett sludd og torden",
  sleetandthunder: "Sludd og torden",
  heavysleetandthunder: "Kraftig sludd og torden",
  
  // Snow and thunder
  lightsnowshowersandthunder_day: "Lette snøbyger og torden",
  lightsnowshowersandthunder_night: "Lette snøbyger og torden",
  snowshowersandthunder_day: "Snøbyger og torden",
  snowshowersandthunder_night: "Snøbyger og torden",
  heavysnowshowersandthunder_day: "Kraftige snøbyger og torden",
  heavysnowshowersandthunder_night: "Kraftige snøbyger og torden",
  lightsnowandthunder: "Lett snø og torden",
  snowandthunder: "Snø og torden",
  heavysnowandthunder: "Kraftig snø og torden",
};

export async function fetchWeatherData(): Promise<WeatherData> {
  // Coordinates for Høybråten, Nesodden
  const lat = 59.87;
  const lon = 10.67;
  
  // Fetch weather data from Yr (temperature + symbol)
  const res = await fetch(
    `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`
  );

  if (!res.ok) {
    throw new Error(`Weather API error: ${res.status}`);
  }

  const json = await res.json();
  const current = json.properties?.timeseries?.[0];
  
  if (!current) {
    throw new Error("No weather data available");
  }

  // Get the actual update timestamp from Yr's metadata
  const updatedAtString = json.properties?.meta?.updated_at;
  let updatedAt: Date;
  
  if (updatedAtString) {
    // Safari is strict about date formats, so ensure it's valid
    try {
      updatedAt = new Date(updatedAtString);
      // Check if date is valid
      if (isNaN(updatedAt.getTime())) {
        updatedAt = new Date();
      }
    } catch {
      updatedAt = new Date();
    }
  } else {
    updatedAt = new Date();
  }

  const symbolCode = current.data?.next_1_hours?.summary?.symbol_code || 
                     current.data?.next_6_hours?.summary?.symbol_code || 
                     "cloudy";
  const temperature = current.data?.instant?.details?.air_temperature || 0;
  
  // Fetch UV index from Open-Meteo (Yr doesn't provide UV data)
  let uvIndex: number | undefined;
  try {
    const uvRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=uv_index`
    );
    
    if (uvRes.ok) {
      const uvJson = await uvRes.json();
      uvIndex = uvJson.current?.uv_index;
    }
  } catch (error) {
    console.warn('Failed to fetch UV data from Open-Meteo:', error);
    // Continue without UV data
  }
  
  // Get base symbol without polarity variants (_polarlight, _polartwilight)
  const baseSymbol = symbolCode.split("_polarlight")[0].split("_polartwilight")[0];
  
  // Check for fog conditions - Yr combines fog with other weather symbols
  const details = current.data?.instant?.details;
  const fogCondition = details?.fog_area_fraction;
  const visibility = details?.visibility;
  
  // Fog detection: Only trust Yr's actual fog data or symbol code
  // fog_area_fraction and visibility are often undefined in the API response
  const hasFog = (fogCondition !== undefined && fogCondition > 0.5) || 
                 (visibility !== undefined && visibility < 1000) ||
                 baseSymbol.includes('fog'); // Trust Yr's symbol code if it explicitly says fog
  
  // Debug: Log the symbol code and fog conditions
  console.log('Yr symbol code:', symbolCode, '-> base:', baseSymbol);
  console.log('Fog conditions - fog_area_fraction:', fogCondition, 'visibility:', visibility, 'hasFog:', hasFog);
  
  // Adjust description based on fog conditions
  let description = weatherDescriptions[baseSymbol] || weatherDescriptions[symbolCode] || `Ukjent (${baseSymbol})`;
  
  // If we detect fog conditions, modify the description
  if (hasFog) {
    if (baseSymbol === 'cloudy') {
      description = 'Overskyet med tåke';
    } else if (baseSymbol.includes('partlycloudy')) {
      description = 'Delvis skyet med tåke';
    } else if (!baseSymbol.includes('fog')) {
      // Add fog to other conditions if not already mentioned
      description = `${description} og tåke`;
    }
  }

  return {
    temperature,
    symbolCode: hasFog ? 'fog' : baseSymbol,
    description,
    updatedAt,
    uvIndex
  };
}