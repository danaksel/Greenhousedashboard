import { useState, useEffect } from "react";
import { ChartSkeleton } from "./components/chart-skeleton";
import { TrendChart } from "./components/trend-chart";
import { RefreshCw, Moon, Sun, WifiOff, Info, ChevronDown } from "lucide-react";
import { fetchLatestGreenhouseData, fetchGreenhouseHistory, fetchWeatherData, type WeatherData } from "./utils/api";
import { ImageWithFallback } from "./components/figma/ImageWithFallback";
import { GreenhouseIcon } from "./components/greenhouse-icon";
import { WeatherWidget } from "./components/weather-widget";
import { WeatherWidgetSkeleton } from "./components/weather-widget-skeleton";
import { motion, AnimatePresence } from "motion/react";
import { thresholds } from "../config/thresholds";
import { ClimateMetric } from "./components/climate-metric";
import { ClimateMetricsSkeleton } from "./components/climate-metrics-skeleton";
import { DeviceStatusRow } from "./components/device-status-row";

export default function App() {
  const [temperature, setTemperature] = useState<number | null>(null);
  const [humidity, setHumidity] = useState<number | null>(null);
  const [rainToday, setRainToday] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [door, setDoor] = useState<"open" | "closed" | null>(null);
  const [fan, setFan] = useState<"on" | "off" | null>(null);
  const [heating, setHeating] = useState<"on" | "off" | null>(null);
  const [temperatureData, setTemperatureData] = useState<Array<{ time: string; value: number; id: string }>>([]);
  const [humidityData, setHumidityData] = useState<Array<{ time: string; value: number; id: string }>>([]);
  const [temperatureData24h, setTemperatureData24h] = useState<Array<{ time: string; value: number; id: string }>>([]);
  const [humidityData24h, setHumidityData24h] = useState<Array<{ time: string; value: number; id: string }>>([]);
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
  const [aboutExpanded, setAboutExpanded] = useState(false);

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
      setRainToday(latest.rainToday ?? null);
      setLastUpdated(new Date(latest.updatedAt));
      setDoor(latest.door ?? null);
      setFan(latest.fan ?? null);
      setHeating(latest.heating ?? null);
      // Fetch historical data
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
      
      // Generate list of hours for min/max calculation (every hour going back 24 hours)
      const hoursToShow24: number[] = [];
      for (let i = 0; i < 24; i++) { // 24 hours
        const hour = (currentHour - i + 24) % 24;
        hoursToShow24.unshift(hour); // Add to beginning so oldest is first
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
      const processHistoryData = (historyItems: Array<{ time: string; value: number | null }>, prefix: string, hoursToShow: number[]) => {
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

      // Transform temperature and humidity history data (for graphs - 12 hours)
      const tempData = processHistoryData(history.temperature || [], 'temp', hoursToShow12);
      const humData = processHistoryData(history.humidity || [], 'hum', hoursToShow12);

      setTemperatureData(tempData);
      setHumidityData(humData);

      // Transform temperature and humidity history data (for min/max - 24 hours)
      const tempData24h = processHistoryData(history.temperature || [], 'temp24', hoursToShow24);
      const humData24h = processHistoryData(history.humidity || [], 'hum24', hoursToShow24);

      setTemperatureData24h(tempData24h);
      setHumidityData24h(humData24h);

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

  // Calculate min/max from historical data
  const getMinMax = (data: Array<{ time: string; value: number; id: string }>) => {
    if (data.length === 0) return { min: undefined, max: undefined };
    const values = data.map(d => d.value);
    return {
      min: Math.min(...values),
      max: Math.max(...values)
    };
  };

  const temperatureMinMax = getMinMax(temperatureData24h);
  const humidityMinMax = getMinMax(humidityData24h);
  const bgColor = darkMode ? 'bg-[#2d3a21]' : 'bg-[#e8ede3]';
  const statusItems = [
    {
      iconSrc: darkMode
        ? door === "open" ? "/door-open.svg" : "/door-closed.svg"
        : door === "open" ? "/door-open-light.svg" : "/door-closed-light.svg",
      label: door === "open" ? "Dør åpen" : "Dør lukket",
    },
    {
      iconSrc: darkMode
        ? heating === "on" ? "/fan-heating.svg" : fan === "on" ? "/fan-cooling.svg" : "/fan-off.svg"
        : heating === "on" ? "/fan-heating-light.svg" : fan === "on" ? "/fan-cooling-light.svg" : "/fan-off-light.svg",
      label:
        fan === "on"
          ? heating === "on"
            ? "Varmevifte"
            : "Ventilasjon"
          : "Vifte av",
      spinning: fan === "on",
    },
  ];

  return (
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
                <RefreshCw className={`w-5 h-5 text-white ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              
              {/* Dark Mode Slider */}
              <button
                onClick={toggleDarkMode}
                className="relative w-16 h-8 rounded-full bg-white/20 hover:bg-white/30 transition-colors p-1"
                aria-label="Bytt modus"
              >
                <div className="flex items-center justify-between px-1 h-full">
                  <Sun className="w-4 h-4 text-white" />
                  <Moon className="w-4 h-4 text-white" />
                </div>
                <motion.div
                  className="absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md"
                  animate={{ x: darkMode ? 32 : 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
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
              className="bg-red-500 text-white px-4 py-3 text-sm"
            >
              <p className="font-semibold">Feil ved lasting av data</p>
              <p className="text-xs mt-1">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hero Image */}
        <div className="relative w-full h-[200px] overflow-hidden mb-6">
          <ImageWithFallback
            src="/drivhus.png" 
            alt="Drivhus" 
            className="w-full h-full object-cover object-center"
          />
          
          {/* Weather Widget Overlay */}
          {loading ? (
            <div className="absolute top-4 right-4 bottom-4">
              <WeatherWidgetSkeleton />
            </div>
          ) : weatherData ? (
            <div className="absolute top-4 right-4 bottom-4">
              <WeatherWidget data={weatherData} compact rainToday={rainToday} />
            </div>
          ) : null}
        </div>

        <div className="px-4 pb-6">
          {/* Climate Metrics */}
          <div className="mb-7 pt-1">
            {loading ? (
              <ClimateMetricsSkeleton darkMode={darkMode} />
            ) : (
              <motion.div
                key={`climate-${temperature}-${humidity}`}
                initial={{ opacity: 0.5 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-2 gap-3 sm:gap-4"
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
              </motion.div>
            )}
          </div>

          {!loading && <DeviceStatusRow items={statusItems} darkMode={darkMode} />}

          {/* Trend Charts */}
          <div className="space-y-4">
            {loading ? (
              <ChartSkeleton darkMode={darkMode} />
            ) : (
              <TrendChart
                title="Temperatur siste 12 timer"
                data={temperatureData}
                color="#d28c31"
                unit="°C"
                darkMode={darkMode}
              />
            )}
            {loading ? (
              <ChartSkeleton darkMode={darkMode} />
            ) : (
              <TrendChart
                title="Luftfuktighet siste 12 timer"
                data={humidityData}
                color={darkMode ? "#8fbc5f" : "#5d7342"}
                unit="%"
                darkMode={darkMode}
              />
            )}
          </div>

          {/* Footer with Last Updated and About Section */}
          {lastUpdated && (
            <div className="mt-6">
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

              {/* Collapsible About Section */}
              <div className={`mt-4 rounded-lg overflow-hidden transition-colors ${darkMode ? 'bg-white/5' : 'bg-white/50'}`}>
                <button
                  onClick={() => setAboutExpanded(!aboutExpanded)}
                  className={`w-full px-4 py-3 flex items-center justify-between ${darkMode ? 'hover:bg-white/10' : 'hover:bg-white/70'} transition-colors`}
                >
                  <div className="flex items-center gap-2">
                    <Info className={`w-4 h-4 ${darkMode ? 'text-white/70' : 'text-gray-600'}`} />
                    <span className={`text-sm font-medium ${darkMode ? 'text-white/80' : 'text-gray-700'}`}>
                      Om prosjektet
                    </span>
                  </div>
                  <motion.div
                    animate={{ rotate: aboutExpanded ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ChevronDown className={`w-5 h-5 ${darkMode ? 'text-white/70' : 'text-gray-600'}`} />
                  </motion.div>
                </button>

                <AnimatePresence>
                  {aboutExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className={`px-4 pb-4 text-sm ${darkMode ? 'text-white/70' : 'text-gray-700'} space-y-4`}>
                        <p>
                          Dette prosjektet er en liten edge-drevet <strong>IoT-løsning</strong> for å overvåke klimaet i et drivhus i sanntid. Systemet samler inn temperatur- og luftfuktighetsdata, styrer oppvarming ved behov, og publiserer dataene til en nettside via en lett skyarkitektur.
                        </p>
                        
                        <p>
                          Stacken består av <strong>Homey</strong>, <strong>Cloudflare Workers</strong>, <strong>Cloudflare KV</strong>, <strong>GitHub</strong> og <strong>Figma Make</strong>, kombinert med en enkel IoT-sensor i drivhuset.
                        </p>
                        
                        <div>
                          <p className={`font-semibold mb-2 ${darkMode ? 'text-[#8fbc5f]' : 'text-[#5d7342]'}`}>Arkitektur</p>
                          <div className={`p-3 rounded-lg font-mono text-xs ${darkMode ? 'bg-black/20' : 'bg-white/50'} overflow-x-auto`}>
                            <pre className={darkMode ? 'text-white/80' : 'text-gray-700'}>
{`Mill Smartplug (drivhus)
        │
        │
        ▼
      Internet
        │
        ▼
     Mill Cloud
        │
        ▼
       Homey
        │
        │  (Homey Flow)
        ▼
   Cloudflare KV
        │
        ▼
 Cloudflare Worker API
        │
        ▼
   Website (Figma Make)`}
                            </pre>
                          </div>
                        </div>
                        
                        <div>
                          <p className={`font-semibold mb-2 ${darkMode ? 'text-[#8fbc5f]' : 'text-[#5d7342]'}`}>Hardware og nettverk</p>
                          <p className="mb-2">
                            I drivhuset står en <strong>Mill Smartplugg</strong> koblet til internett via en <strong>UniFi Mobile Router Ultra</strong>.
                          </p>
                          <p className="mb-2">Smartpluggen:</p>
                          <ul className="list-disc list-inside ml-2 mb-2 space-y-1">
                            <li>måler temperatur</li>
                            <li>måler luftfuktighet</li>
                            <li>kan styre en tilkoblet vifteovn</li>
                            <li>rapporterer energiforbruket til ovnen</li>
                          </ul>
                          <p className="mb-2">
                            En <strong>Homey</strong> smarthub fungerer som IoT-hub og mottar alle målinger.
                          </p>
                          <p>
                            Smartpluggen og Homey befinner seg på ulike geografiske lokasjoner og separate nettverk, og kommuniserer via internett. Det er ikke nødvendig med VPN mellom nettverkene. Smartpluggen kommuniserer direkte med Mill sine skytjenester, og Homeys Mill-integrasjon kobler seg til samme tjeneste for å hente data.
                          </p>
                        </div>

                        <div>
                          <p className={`font-semibold mb-2 ${darkMode ? 'text-[#8fbc5f]' : 'text-[#5d7342]'}`}>Datainnsamling</p>
                          <p className="mb-2">
                            Når målinger i smartpluggen endrer seg, trigges en Homey Flow.
                          </p>
                          <p className="mb-2">Denne:</p>
                          <ol className="list-decimal list-inside ml-2 mb-2 space-y-1">
                            <li>leser de oppdaterte verdiene</li>
                            <li>sender data til Cloudflare KV</li>
                          </ol>
                          <p>
                            Cloudflare KV fungerer som enkel nøkkel-verdi database for siste målinger.
                          </p>
                        </div>

                        <div>
                          <p className={`font-semibold mb-2 ${darkMode ? 'text-[#8fbc5f]' : 'text-[#5d7342]'}`}>Backend</p>
                          <p className="mb-2">
                            En <strong>Cloudflare Worker</strong> fungerer som backend og eksponerer dataene via et enkelt API.
                          </p>
                          <p className="mb-2">API-et leverer blant annet:</p>
                          <ul className="list-disc list-inside ml-2 mb-2 space-y-1">
                            <li>temperatur</li>
                            <li>luftfuktighet</li>
                            <li>energiforbruk</li>
                            <li>tidspunkt for siste oppdatering</li>
                          </ul>
                          <p>
                            Siden API-et kjører på Cloudflare Edge, kan dataene hentes raskt fra hvor som helst.
                          </p>
                        </div>

                        <div>
                          <p className={`font-semibold mb-2 ${darkMode ? 'text-[#8fbc5f]' : 'text-[#5d7342]'}`}>Frontend</p>
                          <p className="mb-2">
                            Nettsiden er laget med <strong>Figma Make</strong>.
                          </p>
                          <p className="mb-2">Den:</p>
                          <ul className="list-disc list-inside ml-2 mb-2 space-y-1">
                            <li>henter data fra Worker-API-et</li>
                            <li>viser målingene i sanntid</li>
                            <li>oppdaterer visningen fortløpende</li>
                          </ul>
                          <p className="mb-2">Koden:</p>
                          <ul className="list-disc list-inside ml-2 mb-2 space-y-1">
                            <li>versjoneres i GitHub</li>
                            <li>publiseres globalt via Cloudflare Workers</li>
                          </ul>
                          <p>
                            Dette gir en svært lett og rask edge-basert hostingmodell.
                          </p>
                        </div>

                        <div>
                          <p className={`font-semibold mb-2 ${darkMode ? 'text-[#8fbc5f]' : 'text-[#5d7342]'}`}>Værintegrasjon</p>
                          <p className="mb-2">
                            For å gi kontekst til drivhusdataene hentes også værdata fra <strong>Yr.no</strong> sitt API.
                          </p>
                          <p className="mb-2">Dette gjør det mulig å sammenligne:</p>
                          <ul className="list-disc list-inside ml-2 space-y-1">
                            <li>temperatur i drivhuset</li>
                            <li>temperatur utendørs</li>
                            <li>luftfuktighet</li>
                            <li>lokale værforhold</li>
                          </ul>
                        </div>

                        <div>
                          <p className={`font-semibold mb-2 ${darkMode ? 'text-[#8fbc5f]' : 'text-[#5d7342]'}`}>Varmestyring</p>
                          <p className="mb-2">
                            Tidlig i sesongen kan nettene være kalde i Norge.
                          </p>
                          <p className="mb-2">
                            I denne perioden er en vifteovn koblet til smartpluggen.
                          </p>
                          <p className="mb-2">Homey kan automatisk:</p>
                          <ul className="list-disc list-inside ml-2 space-y-1">
                            <li>slå ovnen på når temperaturen blir for lav</li>
                            <li>slå den av når ønsket temperatur er nådd</li>
                          </ul>
                        </div>

                        <div>
                          <p className={`font-semibold mb-2 ${darkMode ? 'text-[#8fbc5f]' : 'text-[#5d7342]'}`}>Varsling</p>
                          <p className="mb-2">
                            Systemet fungerer også som enkel IoT-monitor.
                          </p>
                          <p className="mb-2">Dersom temperatur eller luftfuktighet passerer definerte grenser:</p>
                          <ul className="list-disc list-inside ml-2 mb-2 space-y-1">
                            <li>trigges en Homey Flow</li>
                            <li>brukeren får pushvarsel på telefon</li>
                          </ul>
                          <p>
                            Dette gjør det mulig å reagere raskt dersom forholdene i drivhuset endrer seg.
                          </p>
                        </div>

                        <p className={`pt-2 border-t text-sm ${darkMode ? 'border-white/10' : 'border-gray-200'}`}>
                          Prosjektet er en liten, men effektiv IoT-stack bygget med edge-infrastruktur, sky-API-er, automatisering via Homey og en god dose vibe-coding. Resultatet er en løsning som gjør det mulig å følge klimaet i drivhuset i sanntid – fra hvor som helst.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
