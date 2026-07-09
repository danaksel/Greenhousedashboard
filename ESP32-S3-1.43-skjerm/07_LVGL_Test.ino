#include "lcd_bsp.h"
#include "FT3168.h"
#include "qmi8658c.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ctype.h>
#include <math.h>
#include <string.h>
#include <time.h>
#include "esp_heap_caps.h"
#include "esp_system.h"

static const uint16_t DISPLAY_IMAGE_WIDTH = 164;
static const uint16_t DISPLAY_IMAGE_HEIGHT = 466;
static const size_t DISPLAY_IMAGE_BYTES = DISPLAY_IMAGE_WIDTH * DISPLAY_IMAGE_HEIGHT * 2;
static const uint32_t GREENHOUSE_NO_COLOR_OVERRIDE = 0xFFFFFFFF;
static const char *WIFI_SSID = "jacobsen-iot";
static const char *WIFI_SECONDARY_SSID = "drivhus";
static const char *WIFI_TERTIARY_SSID = "Bretsens";
static const char *WIFI_PRIMARY_PASSWORD = "Digibeta84";
static const char *WIFI_TERTIARY_PASSWORD = "Ks54R3pC41q";
static const char *WIFI_SSIDS[] = {WIFI_SSID, WIFI_SECONDARY_SSID, WIFI_TERTIARY_SSID};
static const char *WIFI_PASSWORDS[] = {WIFI_PRIMARY_PASSWORD, WIFI_PRIMARY_PASSWORD, WIFI_TERTIARY_PASSWORD};
static const size_t WIFI_SSID_COUNT = sizeof(WIFI_SSIDS) / sizeof(WIFI_SSIDS[0]);
static const char *TEMPERATURE_API_URL = "https://drivhus.dan-aksel.workers.dev/api/latest";
static const char *WEATHER_API_URL = "https://drivhus.dan-aksel.workers.dev/api/weather";
static const char *DISPLAY_CONFIG_API_URL = "https://drivhus.dan-aksel.workers.dev/api/display-config";
static const char *DISPLAY_STATS_API_URL = "https://drivhus.dan-aksel.workers.dev/api/display-stats";
static const char *DISPLAY_LOG_API_URL = "https://drivhus.dan-aksel.workers.dev/api/display-log";
static const size_t GREENHOUSE_STATS_MAX_POINTS = 25;

typedef struct
{
  const char *key;
  uint32_t bg_color;
  uint32_t label_color;
  uint8_t label_opa;
  uint32_t temperature_value_color;
  uint32_t humidity_value_color;
  uint32_t unit_color;
  uint32_t aux_color;
  uint32_t graph_panel_bg;
  uint32_t graph_panel_border;
  uint32_t door_icon_color;
  uint32_t window_icon_color;
  uint32_t fan_icon_color;
  String binary_url;
  uint8_t *pixels;
  lv_img_dsc_t image;
  bool ready;
  int last_http_status;
  int last_content_length;
  size_t last_bytes_read;
  char last_error[24];
} greenhouse_remote_slot_t;

static greenhouse_remote_slot_t greenhouse_remote_slots[] = {
    {"coldNight", 0x2D3A21, 0xFFFFFF, 115, 0x5190A1, 0xD3DECA, 0xB3BEA3, 0x5190A1, 0x25341D, 0x4E6240, GREENHOUSE_NO_COLOR_OVERRIDE, GREENHOUSE_NO_COLOR_OVERRIDE, GREENHOUSE_NO_COLOR_OVERRIDE, "", NULL, {}, false, 0, 0, 0, ""},
    {"night", 0x2D3A21, 0xFFFFFF, 115, 0xD0DEC8, 0xD3DECA, 0xB3BEA3, 0x8D9D7E, 0x25341D, 0x4E6240, GREENHOUSE_NO_COLOR_OVERRIDE, GREENHOUSE_NO_COLOR_OVERRIDE, GREENHOUSE_NO_COLOR_OVERRIDE, "", NULL, {}, false, 0, 0, 0, ""},
    {"cold", 0x2D3A21, 0xFFFFFF, 115, 0x5190A1, 0xD3DECA, 0xB3BEA3, 0x5190A1, 0x25341D, 0x4E6240, GREENHOUSE_NO_COLOR_OVERRIDE, GREENHOUSE_NO_COLOR_OVERRIDE, GREENHOUSE_NO_COLOR_OVERRIDE, "", NULL, {}, false, 0, 0, 0, ""},
    {"rain", 0x2D3A21, 0xFFFFFF, 115, 0x5190A1, 0xD3DECA, 0xB3BEA3, 0x5190A1, 0x25341D, 0x4E6240, GREENHOUSE_NO_COLOR_OVERRIDE, GREENHOUSE_NO_COLOR_OVERRIDE, GREENHOUSE_NO_COLOR_OVERRIDE, "", NULL, {}, false, 0, 0, 0, ""},
    {"normal", 0x2D3A21, 0xFFFFFF, 115, 0xD0DEC8, 0xD3DECA, 0xB3BEA3, 0x8D9D7E, 0x25341D, 0x4E6240, GREENHOUSE_NO_COLOR_OVERRIDE, GREENHOUSE_NO_COLOR_OVERRIDE, GREENHOUSE_NO_COLOR_OVERRIDE, "", NULL, {}, false, 0, 0, 0, ""},
    {"warm", 0x2D3A21, 0xFFFFFF, 115, 0xD28C31, 0xD3DECA, 0xB3BEA3, 0xD28C31, 0x25341D, 0x4E6240, GREENHOUSE_NO_COLOR_OVERRIDE, GREENHOUSE_NO_COLOR_OVERRIDE, GREENHOUSE_NO_COLOR_OVERRIDE, "", NULL, {}, false, 0, 0, 0, ""},
    {"hot", 0x2D3A21, 0xFFFFFF, 115, 0xC44747, 0xD3DECA, 0xB3BEA3, 0xFF6363, 0x25341D, 0x4E6240, GREENHOUSE_NO_COLOR_OVERRIDE, GREENHOUSE_NO_COLOR_OVERRIDE, GREENHOUSE_NO_COLOR_OVERRIDE, "", NULL, {}, false, 0, 0, 0, ""},
};
static const size_t GREENHOUSE_REMOTE_SLOT_COUNT = sizeof(greenhouse_remote_slots) / sizeof(greenhouse_remote_slots[0]);
static greenhouse_remote_slot_t *greenhouse_find_remote_slot(const char *key);

static volatile float greenhouse_temperature_c = NAN;
static volatile float greenhouse_humidity_percent = NAN;
static volatile int greenhouse_door_closed = -1;
static volatile int greenhouse_fan_on = -1;
static volatile int greenhouse_heating_on = -1;
static volatile int greenhouse_windows_open = -1;
static volatile int greenhouse_weather_is_rain = 0;
static volatile int greenhouse_weather_is_night = 0;
static char greenhouse_updated_at[32] = "";
static char greenhouse_weather_symbol[48] = "";
static char greenhouse_last_active_slot[16] = "";
static int greenhouse_last_display_slots_found = 0;
static int greenhouse_last_display_binary_found = 0;
static int greenhouse_last_display_downloads = 0;
static int greenhouse_last_display_ready = 0;
static int greenhouse_last_display_http = 0;
static uint32_t greenhouse_last_free_heap = 0;
static uint32_t greenhouse_last_free_psram = 0;
static float greenhouse_stats_temperature[GREENHOUSE_STATS_MAX_POINTS] = {0};
static float greenhouse_stats_humidity[GREENHOUSE_STATS_MAX_POINTS] = {0};
static int greenhouse_stats_temperature_count = 0;
static int greenhouse_stats_humidity_count = 0;
static int greenhouse_last_display_stats_http = 0;
static volatile bool greenhouse_refresh_requested = false;
static bool greenhouse_booting = true;
static volatile unsigned long greenhouse_last_success_ms = 0;
static unsigned long last_api_fetch_ms = 0;
static const unsigned long API_FETCH_INTERVAL_MS = 120000;
static unsigned long last_display_config_fetch_ms = 0;
static const unsigned long DISPLAY_CONFIG_FETCH_INTERVAL_MS = 900000;
static unsigned long last_health_log_ms = 0;
static const unsigned long HEALTH_LOG_INTERVAL_MS = 300000;
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
static RTC_DATA_ATTR uint32_t greenhouse_rtc_boot_count = 0;
static RTC_DATA_ATTR char greenhouse_rtc_last_phase[32] = "unset";
static esp_reset_reason_t greenhouse_boot_reset_reason = ESP_RST_UNKNOWN;

static const char *reset_reason_text(esp_reset_reason_t reason)
{
  switch (reason)
  {
    case ESP_RST_POWERON: return "poweron";
    case ESP_RST_EXT: return "external";
    case ESP_RST_SW: return "software";
    case ESP_RST_PANIC: return "panic";
    case ESP_RST_INT_WDT: return "int_wdt";
    case ESP_RST_TASK_WDT: return "task_wdt";
    case ESP_RST_WDT: return "wdt";
    case ESP_RST_DEEPSLEEP: return "deepsleep";
    case ESP_RST_BROWNOUT: return "brownout";
    case ESP_RST_SDIO: return "sdio";
    default: return "unknown";
  }
}

static void set_diag_phase(const char *phase)
{
  if (phase == NULL || phase[0] == '\0')
  {
    return;
  }
  snprintf(greenhouse_rtc_last_phase, sizeof(greenhouse_rtc_last_phase), "%s", phase);
}

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

static void normalize_rgb565_for_lvgl(uint8_t *pixels, size_t byte_count)
{
#if LV_COLOR_DEPTH == 16 && LV_COLOR_16_SWAP != 0
  for (size_t i = 0; i + 1 < byte_count; i += 2)
  {
    uint8_t first = pixels[i];
    pixels[i] = pixels[i + 1];
    pixels[i + 1] = first;
  }
#else
  (void)pixels;
  (void)byte_count;
#endif
}

static void post_display_log(const char *message)
{
  if (message == NULL || message[0] == '\0')
  {
    return;
  }

  if (WiFi.status() != WL_CONNECTED)
  {
    return;
  }

  String escaped = message;
  escaped.replace("\\", "\\\\");
  escaped.replace("\"", "\\\"");
  escaped.replace("\n", " ");
  escaped.replace("\r", " ");

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(5000);

  HTTPClient http;
  http.setTimeout(5000);
  if (!http.begin(client, DISPLAY_LOG_API_URL))
  {
    return;
  }

  http.addHeader("Content-Type", "application/json");
  String payload = String("{\"device\":\"esp32-s3-round\",\"message\":\"") + escaped + "\"}";
  http.POST(payload);
  http.end();
}

static void post_health_log(const char *context)
{
  uint32_t now_ms = millis();
  uint32_t ui_last_ms = greenhouse_read_lvgl_last_ms();
  uint32_t ui_age_ms = ui_last_ms > 0 && now_ms >= ui_last_ms ? now_ms - ui_last_ms : 0;
  char msg[256];
  snprintf(msg, sizeof(msg),
           "health ctx=%s phase=%s reset=%s boot=%u uiHb=%u uiAge=%u page=%u touchActive=%d touchReads=%u touchPress=%u touchErr=%u touchLast=%d heap=%u psram=%u",
           context != NULL ? context : "periodic",
           greenhouse_rtc_last_phase,
           reset_reason_text(greenhouse_boot_reset_reason),
           (unsigned)greenhouse_rtc_boot_count,
           (unsigned)greenhouse_read_lvgl_heartbeat_count(),
           (unsigned)ui_age_ms,
           (unsigned)greenhouse_read_page_index(),
           greenhouse_read_touch_active(),
           (unsigned)touch_get_read_count(),
           (unsigned)touch_get_press_count(),
           (unsigned)touch_get_error_count(),
           (int)touch_get_last_error(),
           (unsigned)ESP.getFreeHeap(),
           (unsigned)ESP.getFreePsram());
  post_display_log(msg);
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

extern "C" int greenhouse_read_stats_temperature(float *out_values, int max_values)
{
  if (out_values == NULL || max_values <= 0)
  {
    return 0;
  }

  int count = greenhouse_stats_temperature_count;
  if (count > max_values)
  {
    count = max_values;
  }
  for (int i = 0; i < count; i++)
  {
    out_values[i] = greenhouse_stats_temperature[i];
  }

  return count;
}

extern "C" int greenhouse_read_stats_humidity(float *out_values, int max_values)
{
  if (out_values == NULL || max_values <= 0)
  {
    return 0;
  }

  int count = greenhouse_stats_humidity_count;
  if (count > max_values)
  {
    count = max_values;
  }
  for (int i = 0; i < count; i++)
  {
    out_values[i] = greenhouse_stats_humidity[i];
  }

  return count;
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

extern "C" uint32_t greenhouse_read_theme_bg_color(const char *slot, uint32_t fallback)
{
  if (slot == NULL)
  {
    return fallback;
  }

  for (size_t i = 0; i < GREENHOUSE_REMOTE_SLOT_COUNT; i++)
  {
    if (strcmp(slot, greenhouse_remote_slots[i].key) == 0)
    {
      return greenhouse_remote_slots[i].bg_color;
    }
  }

  return fallback;
}

extern "C" uint32_t greenhouse_read_theme_label_color(const char *slot, uint32_t fallback)
{
  greenhouse_remote_slot_t *remote_slot = greenhouse_find_remote_slot(slot);
  return remote_slot != NULL ? remote_slot->label_color : fallback;
}

extern "C" uint8_t greenhouse_read_theme_label_opa(const char *slot, uint8_t fallback)
{
  greenhouse_remote_slot_t *remote_slot = greenhouse_find_remote_slot(slot);
  return remote_slot != NULL ? remote_slot->label_opa : fallback;
}

extern "C" uint32_t greenhouse_read_theme_temperature_value_color(const char *slot, uint32_t fallback)
{
  greenhouse_remote_slot_t *remote_slot = greenhouse_find_remote_slot(slot);
  return remote_slot != NULL ? remote_slot->temperature_value_color : fallback;
}

extern "C" uint32_t greenhouse_read_theme_humidity_value_color(const char *slot, uint32_t fallback)
{
  greenhouse_remote_slot_t *remote_slot = greenhouse_find_remote_slot(slot);
  return remote_slot != NULL ? remote_slot->humidity_value_color : fallback;
}

extern "C" uint32_t greenhouse_read_theme_unit_color(const char *slot, uint32_t fallback)
{
  greenhouse_remote_slot_t *remote_slot = greenhouse_find_remote_slot(slot);
  return remote_slot != NULL ? remote_slot->unit_color : fallback;
}

extern "C" uint32_t greenhouse_read_theme_aux_color(const char *slot, uint32_t fallback)
{
  greenhouse_remote_slot_t *remote_slot = greenhouse_find_remote_slot(slot);
  return remote_slot != NULL ? remote_slot->aux_color : fallback;
}

extern "C" uint32_t greenhouse_read_theme_graph_panel_bg(const char *slot, uint32_t fallback)
{
  greenhouse_remote_slot_t *remote_slot = greenhouse_find_remote_slot(slot);
  return remote_slot != NULL ? remote_slot->graph_panel_bg : fallback;
}

extern "C" uint32_t greenhouse_read_theme_graph_panel_border(const char *slot, uint32_t fallback)
{
  greenhouse_remote_slot_t *remote_slot = greenhouse_find_remote_slot(slot);
  return remote_slot != NULL ? remote_slot->graph_panel_border : fallback;
}

extern "C" uint32_t greenhouse_read_theme_door_icon_color(const char *slot, uint32_t fallback)
{
  greenhouse_remote_slot_t *remote_slot = greenhouse_find_remote_slot(slot);
  return remote_slot != NULL ? remote_slot->door_icon_color : fallback;
}

extern "C" uint32_t greenhouse_read_theme_window_icon_color(const char *slot, uint32_t fallback)
{
  greenhouse_remote_slot_t *remote_slot = greenhouse_find_remote_slot(slot);
  return remote_slot != NULL ? remote_slot->window_icon_color : fallback;
}

extern "C" uint32_t greenhouse_read_theme_fan_icon_color(const char *slot, uint32_t fallback)
{
  greenhouse_remote_slot_t *remote_slot = greenhouse_find_remote_slot(slot);
  return remote_slot != NULL ? remote_slot->fan_icon_color : fallback;
}

extern "C" const void *greenhouse_read_theme_image_src(const char *slot)
{
  if (slot == NULL)
  {
    return NULL;
  }

  for (size_t i = 0; i < GREENHOUSE_REMOTE_SLOT_COUNT; i++)
  {
    if (strcmp(slot, greenhouse_remote_slots[i].key) == 0 && greenhouse_remote_slots[i].ready)
    {
      return &greenhouse_remote_slots[i].image;
    }
  }

  return NULL;
}

extern "C" int greenhouse_read_weather_is_rain(void)
{
  return greenhouse_weather_is_rain;
}

extern "C" int greenhouse_read_weather_is_night(void)
{
  return greenhouse_weather_is_night;
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

static int parse_float_array_field(const String &payload, const char *field_name, float *values, int max_values)
{
  if (values == NULL || max_values <= 0)
  {
    return 0;
  }

  String key = String("\"") + field_name + "\"";
  int key_pos = payload.indexOf(key);
  if (key_pos < 0)
  {
    return 0;
  }

  int array_start = payload.indexOf('[', key_pos);
  if (array_start < 0)
  {
    return 0;
  }

  int array_end = payload.indexOf(']', array_start);
  if (array_end < 0)
  {
    return 0;
  }

  int count = 0;
  int pos = array_start + 1;
  while (pos < array_end && count < max_values)
  {
    while (pos < array_end && (isspace((unsigned char)payload[pos]) || payload[pos] == ','))
    {
      pos++;
    }

    if (pos >= array_end)
    {
      break;
    }

    if (payload.startsWith("null", pos))
    {
      pos += 4;
      continue;
    }

    int value_end = pos;
    while (value_end < array_end)
    {
      char c = payload[value_end];
      if ((c < '0' || c > '9') && c != '-' && c != '+' && c != '.')
      {
        break;
      }
      value_end++;
    }

    if (value_end > pos)
    {
      values[count++] = payload.substring(pos, value_end).toFloat();
    }
    pos = value_end + 1;
  }

  return count;
}

static bool find_json_object_for_key(const String &payload, const char *key_name, int *object_start, int *object_end)
{
  String key = String("\"") + key_name + "\"";
  int key_pos = payload.indexOf(key);
  if (key_pos < 0)
  {
    return false;
  }

  int start = payload.indexOf('{', key_pos + key.length());
  if (start < 0)
  {
    return false;
  }

  int depth = 0;
  for (int i = start; i < payload.length(); i++)
  {
    char c = payload[i];
    if (c == '{')
    {
      depth++;
    }
    else if (c == '}')
    {
      depth--;
      if (depth == 0)
      {
        *object_start = start;
        *object_end = i + 1;
        return true;
      }
    }
  }

  return false;
}

static bool parse_uint_field_in_range(const String &payload, int start, int end, const char *field_name, uint32_t *value)
{
  String key = String("\"") + field_name + "\"";
  int key_pos = payload.indexOf(key, start);
  if (key_pos < 0 || key_pos >= end)
  {
    return false;
  }

  int colon_pos = payload.indexOf(':', key_pos);
  if (colon_pos < 0 || colon_pos >= end)
  {
    return false;
  }

  int value_start = colon_pos + 1;
  while (value_start < end && isspace((unsigned char)payload[value_start]))
  {
    value_start++;
  }

  int value_end = value_start;
  while (value_end < end && isdigit((unsigned char)payload[value_end]))
  {
    value_end++;
  }

  if (value_end == value_start)
  {
    return false;
  }

  *value = (uint32_t)payload.substring(value_start, value_end).toInt();
  return true;
}

static bool parse_string_field_in_range(const String &payload, int start, int end, const char *field_name, String *value)
{
  String key = String("\"") + field_name + "\"";
  int key_pos = payload.indexOf(key, start);
  if (key_pos < 0 || key_pos >= end)
  {
    return false;
  }

  int colon_pos = payload.indexOf(':', key_pos);
  if (colon_pos < 0 || colon_pos >= end)
  {
    return false;
  }

  int quote_start = payload.indexOf('"', colon_pos + 1);
  if (quote_start < 0 || quote_start >= end)
  {
    return false;
  }

  int quote_end = payload.indexOf('"', quote_start + 1);
  if (quote_end < 0 || quote_end > end)
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

static bool download_rgb565_image(const String &url, greenhouse_remote_slot_t *slot)
{
  if (url.length() == 0 || slot == NULL)
  {
    return false;
  }
  slot->last_http_status = 0;
  slot->last_content_length = 0;
  slot->last_bytes_read = 0;
  snprintf(slot->last_error, sizeof(slot->last_error), "%s", "");
  slot->ready = false;

  if (slot->pixels == NULL)
  {
    slot->pixels = (uint8_t *)heap_caps_malloc(DISPLAY_IMAGE_BYTES, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    if (slot->pixels == NULL)
    {
      slot->pixels = (uint8_t *)heap_caps_malloc(DISPLAY_IMAGE_BYTES, MALLOC_CAP_8BIT);
    }
  }

  if (slot->pixels == NULL)
  {
    Serial.printf("No memory for remote image %s (%u bytes)\n", slot->key, (unsigned)DISPLAY_IMAGE_BYTES);
    snprintf(slot->last_error, sizeof(slot->last_error), "%s", "memory");
    return false;
  }

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(15000);

  HTTPClient http;
  http.setTimeout(15000);
  Serial.printf("Image fetch for %s: %s\n", slot->key, url.c_str());
  if (!http.begin(client, url))
  {
    Serial.printf("Image begin failed for %s\n", slot->key);
    snprintf(slot->last_error, sizeof(slot->last_error), "%s", "begin");
    return false;
  }

  int status_code = http.GET();
  int content_length = http.getSize();
  slot->last_http_status = status_code;
  slot->last_content_length = content_length;
  Serial.printf("Image status for %s: HTTP %d, size=%d\n", slot->key, status_code, content_length);
  if (status_code != HTTP_CODE_OK)
  {
    Serial.printf("Image fetch failed for %s: HTTP %d\n", slot->key, status_code);
    snprintf(slot->last_error, sizeof(slot->last_error), "%s", "http");
    http.end();
    return false;
  }

  if (content_length > 0 && (size_t)content_length != DISPLAY_IMAGE_BYTES)
  {
    Serial.printf("Image size mismatch for %s: %d != %u\n", slot->key, content_length, (unsigned)DISPLAY_IMAGE_BYTES);
    snprintf(slot->last_error, sizeof(slot->last_error), "%s", "size");
    http.end();
    return false;
  }

  WiFiClient *stream = http.getStreamPtr();
  size_t offset = 0;
  unsigned long last_read_ms = millis();
  while (offset < DISPLAY_IMAGE_BYTES && millis() - last_read_ms < 15000)
  {
    size_t available = stream->available();
    if (available == 0)
    {
      delay(5);
      continue;
    }

    size_t chunk = min(available, DISPLAY_IMAGE_BYTES - offset);
    int read_count = stream->readBytes(slot->pixels + offset, chunk);
    if (read_count > 0)
    {
      offset += (size_t)read_count;
      last_read_ms = millis();
    }
  }

  http.end();
  slot->last_bytes_read = offset;

  if (offset != DISPLAY_IMAGE_BYTES)
  {
    Serial.printf("Image read incomplete for %s: %u/%u\n", slot->key, (unsigned)offset, (unsigned)DISPLAY_IMAGE_BYTES);
    snprintf(slot->last_error, sizeof(slot->last_error), "%s", "incomplete");
    return false;
  }

  normalize_rgb565_for_lvgl(slot->pixels, DISPLAY_IMAGE_BYTES);

  slot->image.header.cf = LV_IMG_CF_TRUE_COLOR;
  slot->image.header.always_zero = 0;
  slot->image.header.reserved = 0;
  slot->image.header.w = DISPLAY_IMAGE_WIDTH;
  slot->image.header.h = DISPLAY_IMAGE_HEIGHT;
  slot->image.data_size = DISPLAY_IMAGE_BYTES;
  slot->image.data = slot->pixels;
  slot->ready = true;
  snprintf(slot->last_error, sizeof(slot->last_error), "%s", "ok");

  Serial.printf("Remote image ready for %s\n", slot->key);
  return true;
}

static const char *greenhouse_get_active_slot_key(void)
{
  float temp_c = greenhouse_temperature_c;
  bool is_night = greenhouse_weather_is_night > 0;
  int current_hour = greenhouse_read_current_oslo_hour();
  if (!is_night && current_hour >= 0)
  {
    is_night = current_hour >= 22 || current_hour < 6;
  }

  if (!isnan(temp_c) && is_night && temp_c < 12.0f)
  {
    return "coldNight";
  }
  if (is_night)
  {
    return "night";
  }
  if (greenhouse_weather_is_rain > 0)
  {
    return "rain";
  }
  if (!isnan(temp_c) && temp_c > 28.0f)
  {
    return "hot";
  }
  if (!isnan(temp_c) && temp_c >= 23.0f)
  {
    return "warm";
  }
  if (!isnan(temp_c) && temp_c < 12.0f)
  {
    return "cold";
  }

  return "normal";
}

static greenhouse_remote_slot_t *greenhouse_find_remote_slot(const char *key)
{
  if (key == NULL)
  {
    return NULL;
  }

  for (size_t i = 0; i < GREENHOUSE_REMOTE_SLOT_COUNT; i++)
  {
    if (strcmp(greenhouse_remote_slots[i].key, key) == 0)
    {
      return &greenhouse_remote_slots[i];
    }
  }

  return NULL;
}

static bool fetch_display_config_from_api(bool active_slot_only)
{
  if (WiFi.status() != WL_CONNECTED && !connect_wifi())
  {
    return false;
  }

  set_boot_status_if_needed("Henter skjermbilder");
  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(10000);

  HTTPClient http;
  http.setTimeout(10000);
  if (!http.begin(client, DISPLAY_CONFIG_API_URL))
  {
    Serial.println("Display config begin failed");
    return false;
  }

  int status_code = http.GET();
  greenhouse_last_display_http = status_code;
  Serial.printf("Display config status: %d\n", status_code);
  if (status_code != HTTP_CODE_OK)
  {
    http.end();
    return false;
  }

  String payload = http.getString();
  http.end();
  Serial.printf("Display config payload length: %d\n", payload.length());

  const char *active_slot_key = greenhouse_get_active_slot_key();
  Serial.printf("Display active slot: %s\n", active_slot_key);
  snprintf(greenhouse_last_active_slot, sizeof(greenhouse_last_active_slot), "%s", active_slot_key);
  greenhouse_last_display_slots_found = 0;
  greenhouse_last_display_binary_found = 0;
  greenhouse_last_display_downloads = 0;

  for (size_t i = 0; i < GREENHOUSE_REMOTE_SLOT_COUNT; i++)
  {
    int start = 0;
    int end = 0;
    if (!find_json_object_for_key(payload, greenhouse_remote_slots[i].key, &start, &end))
    {
      continue;
    }
    greenhouse_last_display_slots_found++;

    uint32_t bg_color = greenhouse_remote_slots[i].bg_color;
    if (parse_uint_field_in_range(payload, start, end, "background", &bg_color))
    {
      greenhouse_remote_slots[i].bg_color = bg_color;
    }

    uint32_t label_color = greenhouse_remote_slots[i].label_color;
    if (parse_uint_field_in_range(payload, start, end, "labelColor", &label_color))
    {
      greenhouse_remote_slots[i].label_color = label_color;
    }

    uint32_t label_opa = greenhouse_remote_slots[i].label_opa;
    if (parse_uint_field_in_range(payload, start, end, "labelOpacity", &label_opa))
    {
      greenhouse_remote_slots[i].label_opa = (uint8_t)(label_opa > 255 ? 255 : label_opa);
    }

    uint32_t temperature_value_color = greenhouse_remote_slots[i].temperature_value_color;
    if (parse_uint_field_in_range(payload, start, end, "temperatureValueColor", &temperature_value_color))
    {
      greenhouse_remote_slots[i].temperature_value_color = temperature_value_color;
    }

    uint32_t humidity_value_color = greenhouse_remote_slots[i].humidity_value_color;
    if (parse_uint_field_in_range(payload, start, end, "humidityValueColor", &humidity_value_color))
    {
      greenhouse_remote_slots[i].humidity_value_color = humidity_value_color;
    }

    uint32_t unit_color = greenhouse_remote_slots[i].unit_color;
    if (parse_uint_field_in_range(payload, start, end, "unitColor", &unit_color))
    {
      greenhouse_remote_slots[i].unit_color = unit_color;
    }

    uint32_t aux_color = greenhouse_remote_slots[i].aux_color;
    if (parse_uint_field_in_range(payload, start, end, "auxColor", &aux_color))
    {
      greenhouse_remote_slots[i].aux_color = aux_color;
    }

    uint32_t graph_panel_bg = greenhouse_remote_slots[i].graph_panel_bg;
    if (parse_uint_field_in_range(payload, start, end, "graphPanelBg", &graph_panel_bg))
    {
      greenhouse_remote_slots[i].graph_panel_bg = graph_panel_bg;
    }

    uint32_t graph_panel_border = greenhouse_remote_slots[i].graph_panel_border;
    if (parse_uint_field_in_range(payload, start, end, "graphPanelBorder", &graph_panel_border))
    {
      greenhouse_remote_slots[i].graph_panel_border = graph_panel_border;
    }

    uint32_t door_icon_color = greenhouse_remote_slots[i].door_icon_color;
    if (parse_uint_field_in_range(payload, start, end, "doorIconColor", &door_icon_color))
    {
      greenhouse_remote_slots[i].door_icon_color = door_icon_color;
    }

    uint32_t window_icon_color = greenhouse_remote_slots[i].window_icon_color;
    if (parse_uint_field_in_range(payload, start, end, "windowIconColor", &window_icon_color))
    {
      greenhouse_remote_slots[i].window_icon_color = window_icon_color;
    }

    uint32_t fan_icon_color = greenhouse_remote_slots[i].fan_icon_color;
    if (parse_uint_field_in_range(payload, start, end, "fanIconColor", &fan_icon_color))
    {
      greenhouse_remote_slots[i].fan_icon_color = fan_icon_color;
    }

    String binary_url;
    if (parse_string_field_in_range(payload, start, end, "binary", &binary_url) && binary_url.length() > 0)
    {
      greenhouse_last_display_binary_found++;
      bool image_changed = greenhouse_remote_slots[i].binary_url != binary_url;
      greenhouse_remote_slots[i].binary_url = binary_url;
      if (!active_slot_only || strcmp(greenhouse_remote_slots[i].key, active_slot_key) == 0)
      {
        if (image_changed || !greenhouse_remote_slots[i].ready)
        {
          greenhouse_last_display_downloads++;
          download_rgb565_image(binary_url, &greenhouse_remote_slots[i]);
        }
      }
    }
  }

  greenhouse_last_display_ready = 0;
  greenhouse_last_free_heap = ESP.getFreeHeap();
  greenhouse_last_free_psram = ESP.getFreePsram();
  for (size_t i = 0; i < GREENHOUSE_REMOTE_SLOT_COUNT; i++)
  {
    if (greenhouse_remote_slots[i].ready)
    {
      greenhouse_last_display_ready++;
    }
  }

  print_heap("After display config");
  greenhouse_start_dashboard_timer();
  return true;
}

static bool fetch_weather_from_api(void)
{
  if (WiFi.status() != WL_CONNECTED && !connect_wifi())
  {
    return false;
  }

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(10000);

  HTTPClient http;
  http.setTimeout(10000);
  if (!http.begin(client, WEATHER_API_URL))
  {
    Serial.println("Weather begin failed");
    return false;
  }

  int status_code = http.GET();
  if (status_code != HTTP_CODE_OK)
  {
    Serial.printf("Weather request failed: HTTP %d\n", status_code);
    http.end();
    return false;
  }

  String payload = http.getString();
  http.end();

  String symbol_code;
  if (parse_string_field(payload, "symbolCode", &symbol_code))
  {
    symbol_code.toLowerCase();
    symbol_code.toCharArray(greenhouse_weather_symbol, sizeof(greenhouse_weather_symbol));
    greenhouse_weather_is_rain =
        symbol_code.indexOf("rain") >= 0 ||
        symbol_code.indexOf("sleet") >= 0 ||
        symbol_code.indexOf("snow") >= 0 ||
        symbol_code.indexOf("thunder") >= 0;
    greenhouse_weather_is_night =
        symbol_code.indexOf("_night") >= 0 ||
        symbol_code.lastIndexOf("night") == (int)(symbol_code.length() - 5);
    Serial.printf("Weather symbol: %s rain=%d night=%d\n", symbol_code.c_str(), greenhouse_weather_is_rain, greenhouse_weather_is_night);
    return true;
  }

  return false;
}

static bool fetch_display_stats_from_api(void)
{
  if (WiFi.status() != WL_CONNECTED && !connect_wifi())
  {
    return false;
  }

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(10000);

  HTTPClient http;
  http.setTimeout(10000);
  if (!http.begin(client, DISPLAY_STATS_API_URL))
  {
    Serial.println("Display stats begin failed");
    return false;
  }

  int status_code = http.GET();
  greenhouse_last_display_stats_http = status_code;
  Serial.printf("Display stats status: %d\n", status_code);
  if (status_code != HTTP_CODE_OK)
  {
    http.end();
    return false;
  }

  String payload = http.getString();
  http.end();

  greenhouse_stats_temperature_count = parse_float_array_field(payload, "temperature", greenhouse_stats_temperature, GREENHOUSE_STATS_MAX_POINTS);
  greenhouse_stats_humidity_count = parse_float_array_field(payload, "humidity", greenhouse_stats_humidity, GREENHOUSE_STATS_MAX_POINTS);
  Serial.printf("Display stats points: temp=%d humidity=%d\n", greenhouse_stats_temperature_count, greenhouse_stats_humidity_count);
  greenhouse_start_dashboard_timer();
  return greenhouse_stats_temperature_count > 0 || greenhouse_stats_humidity_count > 0;
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
  greenhouse_boot_reset_reason = esp_reset_reason();
  greenhouse_rtc_boot_count++;
  char previous_phase[32];
  snprintf(previous_phase, sizeof(previous_phase), "%s", greenhouse_rtc_last_phase);
  set_diag_phase("setup-start");
  Serial.begin(115200);
  delay(100);
  Serial.printf("Greenhouse display boot reset=%s boot=%u previousPhase=%s\n",
                reset_reason_text(greenhouse_boot_reset_reason),
                (unsigned)greenhouse_rtc_boot_count,
                previous_phase);
  Touch_Init();
  lcd_lvgl_Init();
  greenhouse_set_boot_status("Starter skjerm");
  init_orientation_sensor();
  greenhouse_start_dashboard_timer();
  set_diag_phase("boot-weather");
  fetch_weather_from_api();
  {
    char msg[160];
    snprintf(msg, sizeof(msg), "weather symbol=%s rain=%d night=%d", greenhouse_weather_symbol, greenhouse_weather_is_rain, greenhouse_weather_is_night);
    post_display_log(msg);
  }
  {
    char msg[180];
    snprintf(msg, sizeof(msg), "boot reset=%s boot=%u previousPhase=%s",
             reset_reason_text(greenhouse_boot_reset_reason),
             (unsigned)greenhouse_rtc_boot_count,
             previous_phase);
    post_display_log(msg);
  }
  set_diag_phase("boot-tempdata");
  fetch_temperature_from_api();
  post_display_log("boot after tempdata fetch");
  post_health_log("boot-tempdata");
  set_diag_phase("boot-stats");
  fetch_display_stats_from_api();
  {
    char msg[128];
    snprintf(msg, sizeof(msg), "stats http=%d temp=%d humidity=%d",
             greenhouse_last_display_stats_http,
             greenhouse_stats_temperature_count,
             greenhouse_stats_humidity_count);
    post_display_log(msg);
  }
  set_diag_phase("boot-display-config");
  fetch_display_config_from_api(false);
  {
    char msg[240];
    greenhouse_remote_slot_t *active_slot = greenhouse_find_remote_slot(greenhouse_last_active_slot);
    snprintf(msg, sizeof(msg), "display http=%d active=%s slots=%d binary=%d downloads=%d ready=%d activeHttp=%d activeSize=%d activeBytes=%u activeErr=%s heap=%u psram=%u",
             greenhouse_last_display_http,
             greenhouse_last_active_slot,
             greenhouse_last_display_slots_found,
             greenhouse_last_display_binary_found,
             greenhouse_last_display_downloads,
             greenhouse_last_display_ready,
             active_slot != NULL ? active_slot->last_http_status : 0,
             active_slot != NULL ? active_slot->last_content_length : 0,
             active_slot != NULL ? (unsigned)active_slot->last_bytes_read : 0,
             active_slot != NULL ? active_slot->last_error : "missing",
             (unsigned)greenhouse_last_free_heap,
             (unsigned)greenhouse_last_free_psram);
    post_display_log(msg);
  }
  last_display_config_fetch_ms = millis();
  greenhouse_booting = false;
  greenhouse_hide_boot_screen();
  last_api_fetch_ms = millis();
  last_health_log_ms = millis();
  set_diag_phase("idle");
}
void loop()
{
  set_diag_phase("loop-orientation");
  update_orientation_from_imu();

  if (greenhouse_refresh_requested || millis() - last_api_fetch_ms >= API_FETCH_INTERVAL_MS)
  {
    bool was_manual_refresh = greenhouse_refresh_requested;
    greenhouse_refresh_requested = false;
    last_api_fetch_ms = millis();
    set_diag_phase("loop-weather");
    fetch_weather_from_api();
    {
      char msg[160];
      snprintf(msg, sizeof(msg), "weather symbol=%s rain=%d night=%d", greenhouse_weather_symbol, greenhouse_weather_is_rain, greenhouse_weather_is_night);
      post_display_log(msg);
    }
    set_diag_phase("loop-tempdata");
    bool fetch_ok = fetch_temperature_from_api();
    set_diag_phase("loop-after-tempdata");
    if (was_manual_refresh || millis() - last_display_config_fetch_ms >= DISPLAY_CONFIG_FETCH_INTERVAL_MS)
    {
      set_diag_phase("loop-stats");
      fetch_display_stats_from_api();
      {
        char msg[128];
        snprintf(msg, sizeof(msg), "stats http=%d temp=%d humidity=%d",
                 greenhouse_last_display_stats_http,
                 greenhouse_stats_temperature_count,
                 greenhouse_stats_humidity_count);
        post_display_log(msg);
      }
      set_diag_phase("loop-display-config");
      fetch_display_config_from_api(false);
      {
        char msg[240];
        greenhouse_remote_slot_t *active_slot = greenhouse_find_remote_slot(greenhouse_last_active_slot);
        snprintf(msg, sizeof(msg), "display http=%d active=%s slots=%d binary=%d downloads=%d ready=%d activeHttp=%d activeSize=%d activeBytes=%u activeErr=%s heap=%u psram=%u",
                 greenhouse_last_display_http,
                 greenhouse_last_active_slot,
                 greenhouse_last_display_slots_found,
                 greenhouse_last_display_binary_found,
                 greenhouse_last_display_downloads,
                 greenhouse_last_display_ready,
                 active_slot != NULL ? active_slot->last_http_status : 0,
                 active_slot != NULL ? active_slot->last_content_length : 0,
                 active_slot != NULL ? (unsigned)active_slot->last_bytes_read : 0,
                 active_slot != NULL ? active_slot->last_error : "missing",
                 (unsigned)greenhouse_last_free_heap,
                 (unsigned)greenhouse_last_free_psram);
        post_display_log(msg);
      }
      last_display_config_fetch_ms = millis();
    }
    if (was_manual_refresh)
    {
      greenhouse_show_refresh_result(fetch_ok ? 1 : 0);
    }
    set_diag_phase("idle");
  }

  if (millis() - last_health_log_ms >= HEALTH_LOG_INTERVAL_MS)
  {
    last_health_log_ms = millis();
    post_health_log("periodic");
  }

  delay(50);
}
