#include "lcd_bsp.h"
#include "FT3168.h"
#include "qmi8658c.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ctype.h>
#include <math.h>
#include <time.h>

static const char *WIFI_SSID = "jacobsen-iot";
static const char *WIFI_SECONDARY_SSID = "drivhus";
static const char *WIFI_TERTIARY_SSID = "Bretsens";
static const char *WIFI_PRIMARY_PASSWORD = "Digibeta84";
static const char *WIFI_TERTIARY_PASSWORD = "Ks54R3pC41q";
static const char *WIFI_SSIDS[] = {WIFI_SSID, WIFI_SECONDARY_SSID, WIFI_TERTIARY_SSID};
static const char *WIFI_PASSWORDS[] = {WIFI_PRIMARY_PASSWORD, WIFI_PRIMARY_PASSWORD, WIFI_TERTIARY_PASSWORD};
static const size_t WIFI_SSID_COUNT = sizeof(WIFI_SSIDS) / sizeof(WIFI_SSIDS[0]);
static const char *TEMPERATURE_API_URL = "https://drivhus.dan-aksel.workers.dev/api/latest";

static volatile float greenhouse_temperature_c = NAN;
static volatile float greenhouse_humidity_percent = NAN;
static volatile int greenhouse_door_closed = -1;
static volatile int greenhouse_fan_on = -1;
static volatile int greenhouse_heating_on = -1;
static volatile int greenhouse_windows_open = -1;
static char greenhouse_updated_at[32] = "";
static volatile bool greenhouse_refresh_requested = false;
static bool greenhouse_booting = true;
static volatile unsigned long greenhouse_last_success_ms = 0;
static unsigned long last_api_fetch_ms = 0;
static const unsigned long API_FETCH_INTERVAL_MS = 120000;
static uint8_t wifi_best_bssid[6] = {0};
static int32_t wifi_best_channel = 0;
static bool wifi_has_best_ap = false;
static const char *wifi_current_ssid = WIFI_SSID;
static bool greenhouse_imu_ready = false;
static bool greenhouse_rotation_locked = false;
static uint8_t greenhouse_current_rotation = 0;
static uint8_t greenhouse_candidate_rotation = 0;
static uint8_t greenhouse_candidate_count = 0;
static unsigned long greenhouse_last_rotation_check_ms = 0;
static bool greenhouse_time_configured = false;

static void configure_time_if_needed(void)
{
  if (greenhouse_time_configured)
  {
    return;
  }

  configTzTime("CET-1CEST,M3.5.0/2,M10.5.0/3", "pool.ntp.org", "time.nist.gov");
  greenhouse_time_configured = true;
  Serial.println("NTP time configured for Europe/Oslo");
}

static void print_heap(const char *label)
{
  Serial.printf("%s heap=%u psram=%u\n", label, ESP.getFreeHeap(), ESP.getFreePsram());
}

static void set_boot_status_if_needed(const char *status)
{
  if (greenhouse_booting)
  {
    greenhouse_set_boot_status(status);
  }
}

extern "C" int greenhouse_read_rotation_locked(void)
{
  return greenhouse_rotation_locked ? 1 : 0;
}

extern "C" void greenhouse_set_rotation_locked(int locked)
{
  greenhouse_rotation_locked = locked != 0;
  if (greenhouse_rotation_locked)
  {
    greenhouse_current_rotation = 255;
    greenhouse_candidate_rotation = 0;
    greenhouse_candidate_count = 0;
  }
}

static void print_wifi_status(void)
{
  wl_status_t status = WiFi.status();
  Serial.printf("WiFi status: %d", status);
  if (status == WL_NO_SSID_AVAIL)
  {
    Serial.print(" (SSID not found)");
  }
  else if (status == WL_CONNECT_FAILED)
  {
    Serial.print(" (connect failed)");
  }
  else if (status == WL_CONNECTION_LOST)
  {
    Serial.print(" (connection lost)");
  }
  else if (status == WL_DISCONNECTED)
  {
    Serial.print(" (disconnected)");
  }
  Serial.println();
}

static bool scan_for_wifi(const char *ssid)
{
  Serial.println("Scanning WiFi...");
  int network_count = WiFi.scanNetworks(false, true);
  bool found = false;
  int best_rssi = -1000;
  wifi_has_best_ap = false;

  if (network_count <= 0)
  {
    Serial.printf("No WiFi networks found: %d\n", network_count);
    return false;
  }

  for (int i = 0; i < network_count; i++)
  {
    if (WiFi.SSID(i) == ssid)
    {
      Serial.printf("Found %s RSSI=%d channel=%d encryption=%d\n",
                    WiFi.SSID(i).c_str(),
                    WiFi.RSSI(i),
                    WiFi.channel(i),
                    WiFi.encryptionType(i));
      found = true;
      if (WiFi.RSSI(i) > best_rssi)
      {
        best_rssi = WiFi.RSSI(i);
        wifi_best_channel = WiFi.channel(i);
        const uint8_t *bssid = WiFi.BSSID(i);
        memcpy(wifi_best_bssid, bssid, sizeof(wifi_best_bssid));
        wifi_has_best_ap = true;
      }
    }
  }

  if (!found)
  {
    Serial.printf("SSID not seen: %s\n", ssid);
  }
  else if (wifi_has_best_ap)
  {
    Serial.printf("Using strongest AP: RSSI=%d channel=%d BSSID=%02X:%02X:%02X:%02X:%02X:%02X\n",
                  best_rssi,
                  wifi_best_channel,
                  wifi_best_bssid[0],
                  wifi_best_bssid[1],
                  wifi_best_bssid[2],
                  wifi_best_bssid[3],
                  wifi_best_bssid[4],
                  wifi_best_bssid[5]);
  }

  WiFi.scanDelete();
  return found;
}

extern "C" float greenhouse_read_temperature_c(void)
{
  return greenhouse_temperature_c;
}

extern "C" float greenhouse_read_humidity_percent(void)
{
  return greenhouse_humidity_percent;
}

extern "C" int greenhouse_read_door_closed(void)
{
  return greenhouse_door_closed;
}

extern "C" int greenhouse_read_fan_on(void)
{
  return greenhouse_fan_on;
}

extern "C" int greenhouse_read_heating_on(void)
{
  return greenhouse_heating_on;
}

extern "C" int greenhouse_read_windows_open(void)
{
  return greenhouse_windows_open;
}

extern "C" const char *greenhouse_read_updated_at(void)
{
  return greenhouse_updated_at;
}

extern "C" int greenhouse_read_wifi_connected(void)
{
  return WiFi.status() == WL_CONNECTED ? 1 : 0;
}

extern "C" int greenhouse_read_wifi_rssi(void)
{
  if (WiFi.status() != WL_CONNECTED)
  {
    return 0;
  }

  return WiFi.RSSI();
}

extern "C" const char *greenhouse_read_wifi_ssid(void)
{
  static char current_ssid[40] = "";
  if (WiFi.status() == WL_CONNECTED)
  {
    WiFi.SSID().toCharArray(current_ssid, sizeof(current_ssid));
  }
  else
  {
    snprintf(current_ssid, sizeof(current_ssid), "%s", wifi_current_ssid);
  }

  return current_ssid;
}

extern "C" int greenhouse_read_current_oslo_hour(void)
{
  if (!greenhouse_time_configured)
  {
    return -1;
  }

  struct tm timeinfo;
  if (!getLocalTime(&timeinfo, 10))
  {
    return -1;
  }

  return timeinfo.tm_hour;
}

extern "C" const char *greenhouse_read_current_oslo_time_text(void)
{
  static char current_time[16] = "--:--:--";
  if (!greenhouse_time_configured)
  {
    snprintf(current_time, sizeof(current_time), "--:--:--");
    return current_time;
  }

  struct tm timeinfo;
  if (!getLocalTime(&timeinfo, 10))
  {
    snprintf(current_time, sizeof(current_time), "--:--:--");
    return current_time;
  }

  snprintf(current_time, sizeof(current_time), "%02d:%02d:%02d", timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec);
  return current_time;
}

extern "C" int greenhouse_read_data_age_seconds(void)
{
  unsigned long last_success_ms = greenhouse_last_success_ms;
  if (last_success_ms == 0)
  {
    return -1;
  }

  return (int)((millis() - last_success_ms) / 1000);
}

extern "C" void greenhouse_request_refresh(void)
{
  greenhouse_refresh_requested = true;
}

static bool parse_float_field(const String &payload, const char *field_name, float *value)
{
  String key = String("\"") + field_name + "\"";
  int key_pos = payload.indexOf(key);
  if (key_pos < 0)
  {
    return false;
  }

  int colon_pos = payload.indexOf(':', key_pos);
  if (colon_pos < 0)
  {
    return false;
  }

  int value_start = colon_pos + 1;
  while (value_start < payload.length() && isspace((unsigned char)payload[value_start]))
  {
    value_start++;
  }

  int value_end = value_start;
  while (value_end < payload.length())
  {
    char c = payload[value_end];
    if ((c < '0' || c > '9') && c != '-' && c != '+' && c != '.')
    {
      break;
    }
    value_end++;
  }

  if (value_end == value_start)
  {
    return false;
  }

  *value = payload.substring(value_start, value_end).toFloat();
  return true;
}

static bool parse_string_field(const String &payload, const char *field_name, String *value)
{
  String key = String("\"") + field_name + "\"";
  int key_pos = payload.indexOf(key);
  if (key_pos < 0)
  {
    return false;
  }

  int colon_pos = payload.indexOf(':', key_pos);
  if (colon_pos < 0)
  {
    return false;
  }

  int quote_start = payload.indexOf('"', colon_pos + 1);
  if (quote_start < 0)
  {
    return false;
  }

  int quote_end = payload.indexOf('"', quote_start + 1);
  if (quote_end < 0)
  {
    return false;
  }

  *value = payload.substring(quote_start + 1, quote_end);
  return true;
}

static bool connect_wifi(void)
{
  if (WiFi.status() == WL_CONNECTED)
  {
    return true;
  }

  WiFi.persistent(false);
  WiFi.disconnect(true);
  delay(500);
  WiFi.mode(WIFI_OFF);
  delay(500);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);

  for (size_t i = 0; i < WIFI_SSID_COUNT; i++)
  {
    wifi_current_ssid = WIFI_SSIDS[i];
    set_boot_status_if_needed("Kobler til WiFi");
    Serial.printf("Connecting to WiFi: %s\n", wifi_current_ssid);
    bool ssid_seen = scan_for_wifi(wifi_current_ssid);
    if (!ssid_seen)
    {
      Serial.printf("Skipping %s because it was not seen in scan\n", wifi_current_ssid);
      continue;
    }

    if (wifi_has_best_ap)
    {
      WiFi.begin(wifi_current_ssid, WIFI_PASSWORDS[i], wifi_best_channel, wifi_best_bssid);
    }
    else
    {
      WiFi.begin(wifi_current_ssid, WIFI_PASSWORDS[i]);
    }

    unsigned long start_ms = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start_ms < 30000)
    {
      delay(250);
      Serial.print(".");
    }
    Serial.println();

    if (WiFi.status() == WL_CONNECTED)
    {
      Serial.print("WiFi connected. SSID: ");
      Serial.print(WiFi.SSID());
      Serial.print(" IP: ");
      Serial.println(WiFi.localIP());
      configure_time_if_needed();
      return true;
    }

    Serial.printf("WiFi connection failed for %s\n", wifi_current_ssid);
    print_wifi_status();
    WiFi.disconnect(false);
  }

  Serial.println("WiFi connection failed for all configured networks");
  return false;
}

static void init_orientation_sensor(void)
{
  set_boot_status_if_needed("Starter sensor");
  greenhouse_imu_ready = qmi8658_init() == 1;
  if (greenhouse_imu_ready)
  {
    Serial.println("QMI8658 ready for autorotation");
  }
  else
  {
    Serial.println("QMI8658 init failed; autorotation disabled");
    set_boot_status_if_needed("Sensor feilet");
  }
}

static void update_orientation_from_imu(void)
{
  if (!greenhouse_imu_ready)
  {
    return;
  }

  if (greenhouse_rotation_locked)
  {
    if (greenhouse_current_rotation != 0)
    {
      greenhouse_current_rotation = 0;
      greenhouse_set_display_rotation(0);
    }
    return;
  }

  unsigned long now = millis();
  if (now - greenhouse_last_rotation_check_ms < 250)
  {
    return;
  }
  greenhouse_last_rotation_check_ms = now;

  float acc[3] = {0.0f, 0.0f, 0.0f};
  float gyro[3] = {0.0f, 0.0f, 0.0f};
  qmi8658_read_xyz(acc, gyro);

  float abs_x = fabsf(acc[0]);
  float abs_y = fabsf(acc[1]);
  float abs_z = fabsf(acc[2]);
  if (abs_z > abs_x && abs_z > abs_y)
  {
    return;
  }

  uint8_t new_rotation = greenhouse_current_rotation;
  if (abs_x > abs_y && abs_x > 5.5f)
  {
    new_rotation = acc[0] > 0.0f ? 1 : 3;
  }
  else if (abs_y > 5.5f)
  {
    new_rotation = acc[1] > 0.0f ? 0 : 2;
  }
  else
  {
    return;
  }

  new_rotation = (new_rotation + 3) % 4;

  if (new_rotation != greenhouse_candidate_rotation)
  {
    greenhouse_candidate_rotation = new_rotation;
    greenhouse_candidate_count = 1;
    return;
  }

  if (greenhouse_candidate_count < 3)
  {
    greenhouse_candidate_count++;
    return;
  }

  if (new_rotation != greenhouse_current_rotation)
  {
    greenhouse_current_rotation = new_rotation;
    greenhouse_set_display_rotation(greenhouse_current_rotation);
    Serial.printf("Autorotation: %u acc=(%.2f, %.2f, %.2f)\n",
                  greenhouse_current_rotation,
                  acc[0],
                  acc[1],
                  acc[2]);
  }
}

static bool fetch_temperature_from_api(void)
{
  if (WiFi.status() != WL_CONNECTED)
  {
    set_boot_status_if_needed("Kobler til WiFi");
    if (!connect_wifi())
    {
      set_boot_status_if_needed("WiFi feilet");
      return false;
    }
  }

  set_boot_status_if_needed("Henter data");
  print_heap("Before API");
  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(10000);

  HTTPClient http;
  http.setTimeout(10000);
  Serial.println("API begin");
  if (!http.begin(client, TEMPERATURE_API_URL))
  {
    set_boot_status_if_needed("API feilet");
    Serial.println("API begin failed");
    return false;
  }
  Serial.println("API GET");
  int status_code = http.GET();
  Serial.printf("API status: %d\n", status_code);

  if (status_code == HTTP_CODE_OK)
  {
    Serial.println("API read payload");
    String payload = http.getString();
    Serial.printf("API payload length: %d\n", payload.length());
    float parsed_temp = NAN;
    float parsed_humidity = NAN;
    float parsed_window = NAN;
    String parsed_door;
    String parsed_fan;
    String parsed_heating;
    String parsed_updated_at;

    bool got_temp = parse_float_field(payload, "temperature", &parsed_temp);
    bool got_humidity = parse_float_field(payload, "humidity", &parsed_humidity);
    bool got_window = parse_float_field(payload, "window", &parsed_window);
    bool got_door = parse_string_field(payload, "door", &parsed_door);
    bool got_fan = parse_string_field(payload, "fan", &parsed_fan);
    bool got_heating = parse_string_field(payload, "heating", &parsed_heating);
    bool got_updated_at = parse_string_field(payload, "updatedAt", &parsed_updated_at);

    if (got_temp)
    {
      greenhouse_temperature_c = parsed_temp;
    }
    if (got_humidity)
    {
      greenhouse_humidity_percent = parsed_humidity;
    }
    if (got_window)
    {
      greenhouse_windows_open = (int)(parsed_window + 0.5f);
    }
    if (got_door)
    {
      greenhouse_door_closed = parsed_door == "closed" ? 1 : 0;
    }
    if (got_fan)
    {
      greenhouse_fan_on = parsed_fan == "on" ? 1 : 0;
    }
    if (got_heating)
    {
      greenhouse_heating_on = parsed_heating == "on" ? 1 : 0;
    }
    if (got_updated_at)
    {
      parsed_updated_at.toCharArray(greenhouse_updated_at, sizeof(greenhouse_updated_at));
    }

    if (got_temp || got_humidity)
    {
      greenhouse_last_success_ms = millis();
      set_boot_status_if_needed("Data hentet");
      float current_temp = greenhouse_temperature_c;
      float current_humidity = greenhouse_humidity_percent;
      Serial.printf("Greenhouse: %.1f C, %.1f%% humidity, door=%s, fan=%s, heating=%s, windows=%d, updated=%s\n",
                    current_temp,
                    current_humidity,
                    got_door ? parsed_door.c_str() : "?",
                    got_fan ? parsed_fan.c_str() : "?",
                    got_heating ? parsed_heating.c_str() : "?",
                    greenhouse_windows_open,
                    greenhouse_updated_at);
      http.end();
      print_heap("After API");
      return true;
    }
    else
    {
      set_boot_status_if_needed("Ingen data");
      Serial.println("Could not find greenhouse data in API response");
      Serial.println(payload);
    }
  }
  else
  {
    set_boot_status_if_needed("API feilet");
    Serial.printf("API request failed: HTTP %d\n", status_code);
  }

  http.end();
  print_heap("After API");
  return false;
}

void setup()
{
  Serial.begin(115200);
  Touch_Init();
  lcd_lvgl_Init();
  greenhouse_set_boot_status("Starter skjerm");
  init_orientation_sensor();
  greenhouse_start_dashboard_timer();
  greenhouse_booting = false;
  greenhouse_hide_boot_screen();
  fetch_temperature_from_api();
  last_api_fetch_ms = millis();
}
void loop()
{
  update_orientation_from_imu();

  if (greenhouse_refresh_requested || millis() - last_api_fetch_ms >= API_FETCH_INTERVAL_MS)
  {
    bool was_manual_refresh = greenhouse_refresh_requested;
    greenhouse_refresh_requested = false;
    last_api_fetch_ms = millis();
    bool fetch_ok = fetch_temperature_from_api();
    if (was_manual_refresh)
    {
      greenhouse_show_refresh_result(fetch_ok ? 1 : 0);
    }
  }

  delay(50);
}
