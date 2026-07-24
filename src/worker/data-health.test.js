import test from "node:test";
import assert from "node:assert/strict";
import { buildDataHealth } from "./data-health.js";

const checkedAt = "2026-07-24T12:00:00.000Z";

test("data remains fresh until it is one hour old", () => {
  const health = buildDataHealth(
    {
      temperatureUpdatedAt: "2026-07-24T11:00:01.000Z",
      humidityUpdatedAt: "2026-07-24T11:00:01.000Z",
    },
    checkedAt,
  );

  assert.equal(health.status, "ok");
  assert.deepEqual(health.affectedSensors, []);
});

test("one stale sensor produces a warning", () => {
  const health = buildDataHealth(
    {
      temperatureUpdatedAt: "2026-07-24T11:00:00.000Z",
      humidityUpdatedAt: "2026-07-24T11:30:00.000Z",
    },
    checkedAt,
  );

  assert.equal(health.status, "warning");
  assert.deepEqual(health.affectedSensors, ["temperature"]);
  assert.equal(health.sensors.temperature.ageMinutes, 60);
});

test("two stale sensors produce a critical alert", () => {
  const health = buildDataHealth(
    {
      temperatureUpdatedAt: "2026-07-24T10:45:00.000Z",
      humidityUpdatedAt: "2026-07-24T10:30:00.000Z",
    },
    checkedAt,
  );

  assert.equal(health.status, "critical");
  assert.deepEqual(health.affectedSensors, ["temperature", "humidity"]);
  assert.equal(health.alertStartedAt, "2026-07-24T11:30:00.000Z");
});

test("missing sensor timestamps are treated as unavailable", () => {
  const health = buildDataHealth({}, checkedAt);

  assert.equal(health.status, "critical");
  assert.equal(health.sensors.temperature.status, "missing");
  assert.equal(health.sensors.humidity.status, "missing");
});
