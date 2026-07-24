export const DATA_STALE_AFTER_MINUTES = 60;
export const DATA_STALE_AFTER_MS = DATA_STALE_AFTER_MINUTES * 60 * 1000;

const SENSOR_LABELS = {
  temperature: "Temperatur",
  humidity: "Luftfuktighet",
};

function parseTimestamp(value) {
  if (!value) return null;
  const timestamp = new Date(value);
  return Number.isFinite(timestamp.getTime()) ? timestamp : null;
}

function buildSensorHealth(sensor, updatedAt, checkedAt) {
  const timestamp = parseTimestamp(updatedAt);

  if (!timestamp) {
    return {
      sensor,
      label: SENSOR_LABELS[sensor],
      status: "missing",
      updatedAt: null,
      ageMinutes: null,
      staleForMinutes: null,
    };
  }

  const ageMs = Math.max(0, checkedAt.getTime() - timestamp.getTime());
  const ageMinutes = Math.floor(ageMs / (60 * 1000));
  const isStale = ageMs >= DATA_STALE_AFTER_MS;

  return {
    sensor,
    label: SENSOR_LABELS[sensor],
    status: isStale ? "stale" : "fresh",
    updatedAt: timestamp.toISOString(),
    ageMinutes,
    staleForMinutes: isStale ? Math.floor((ageMs - DATA_STALE_AFTER_MS) / (60 * 1000)) : 0,
  };
}

export function buildDataHealth(latest, checkedAtValue = new Date()) {
  const checkedAt = parseTimestamp(checkedAtValue) || new Date();
  const sensors = {
    temperature: buildSensorHealth("temperature", latest?.temperatureUpdatedAt, checkedAt),
    humidity: buildSensorHealth("humidity", latest?.humidityUpdatedAt, checkedAt),
  };
  const affectedSensors = Object.values(sensors)
    .filter((sensor) => sensor.status !== "fresh")
    .map((sensor) => sensor.sensor);
  const validUpdates = Object.values(sensors)
    .map((sensor) => parseTimestamp(sensor.updatedAt))
    .filter(Boolean);
  const lastClimateUpdateAt = validUpdates.length
    ? new Date(Math.max(...validUpdates.map((date) => date.getTime()))).toISOString()
    : null;
  const staleStartedAtValues = Object.values(sensors)
    .filter((sensor) => sensor.status === "stale")
    .map((sensor) => parseTimestamp(sensor.updatedAt).getTime() + DATA_STALE_AFTER_MS);

  return {
    status:
      affectedSensors.length === 0
        ? "ok"
        : affectedSensors.length === Object.keys(sensors).length
          ? "critical"
          : "warning",
    checkedAt: checkedAt.toISOString(),
    staleAfterMinutes: DATA_STALE_AFTER_MINUTES,
    affectedSensors,
    lastClimateUpdateAt,
    alertStartedAt: affectedSensors.length
      ? new Date(staleStartedAtValues.length ? Math.min(...staleStartedAtValues) : checkedAt.getTime()).toISOString()
      : null,
    sensors,
  };
}
