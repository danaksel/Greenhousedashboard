#include "lcd_bsp.h"
#include "esp_lcd_sh8601.h"
#include "lcd_config.h"
#include "FT3168.h"
#include "read_lcd_id_bsp.h"
#include "esp_err.h"
#include "esp_log.h"
#include <stdio.h>
#include <string.h>
#include <math.h>
static SemaphoreHandle_t lvgl_mux = NULL; //mutex semaphores
#define LCD_HOST    SPI2_HOST

#define EXAMPLE_Rotate_90
#define SH8601_ID 0x86
#define CO5300_ID 0xff
static uint8_t READ_LCD_ID = 0x00; 
static const char *TAG = "lcd_bsp";
static const uint32_t GREENHOUSE_METRIC_BG = 0x2D3A21;
static const uint32_t GREENHOUSE_METRIC_TEXT = 0xD3DECA;
static const uint32_t GREENHOUSE_METRIC_TITLE = 0xADBCA2;
static const uint32_t GREENHOUSE_METRIC_LABEL = 0xFFFFFF;
static const lv_opa_t GREENHOUSE_METRIC_LABEL_OPA = 115;
static const uint32_t GREENHOUSE_MUTED_TEXT = 0x8D9D7E;
static const uint32_t GREENHOUSE_PANEL_BG = 0x3D4D2E;
static const uint32_t GREENHOUSE_ACCENT = 0xD28C31;
static const uint32_t GREENHOUSE_OK = 0x8FBC5F;
static const uint32_t GREENHOUSE_WARN = 0xFF6363;
static const uint32_t GREENHOUSE_COOL = 0x5190A1;
static const uint32_t GREENHOUSE_NO_COLOR_OVERRIDE = 0xFFFFFFFF;
static const uint8_t GREENHOUSE_NIGHT_DIM_BRIGHTNESS = 51;
static const uint8_t GREENHOUSE_DAY_BRIGHTNESS = 255;
static const uint32_t GREENHOUSE_NIGHT_IDLE_MS = 30000;
static const uint32_t GREENHOUSE_BRIGHTNESS_FADE_MS = 500;
static const char *GREENHOUSE_APP_VERSION = "v0.10.8";
static esp_lcd_panel_io_handle_t greenhouse_panel_io_handle = NULL;
static lv_disp_t *greenhouse_display = NULL;
static uint8_t greenhouse_brightness = 255;
static uint8_t greenhouse_manual_brightness = 255;
static uint8_t greenhouse_brightness_anim_var = 0;
static uint32_t greenhouse_last_brightness_tx_ms = 0;
static uint32_t greenhouse_last_activity_ms = 0;
static int greenhouse_last_oslo_hour = -1;

static lv_obj_t *greenhouse_page_1 = NULL;
static lv_obj_t *greenhouse_page_2 = NULL;
static lv_obj_t *greenhouse_page_3 = NULL;
static lv_obj_t *greenhouse_settings_page = NULL;
static lv_obj_t *greenhouse_photo = NULL;
static lv_obj_t *greenhouse_temp_metric = NULL;
static lv_obj_t *greenhouse_humidity_metric = NULL;
static lv_obj_t *greenhouse_temp_label = NULL;
static lv_obj_t *greenhouse_humidity_label = NULL;
static lv_obj_t *greenhouse_temp_title_label = NULL;
static lv_obj_t *greenhouse_humidity_title_label = NULL;
static lv_obj_t *greenhouse_temp_unit_label = NULL;
static lv_obj_t *greenhouse_humidity_unit_label = NULL;
static lv_obj_t *greenhouse_wifi_icon_label = NULL;
static lv_obj_t *greenhouse_refresh_icon_label = NULL;
static lv_obj_t *greenhouse_data_time_label = NULL;
static lv_obj_t *greenhouse_door_status_label = NULL;
static lv_obj_t *greenhouse_climate_status_label = NULL;
static lv_obj_t *greenhouse_window_status_label = NULL;
static lv_obj_t *greenhouse_door_icon = NULL;
static lv_obj_t *greenhouse_climate_icon = NULL;
static lv_obj_t *greenhouse_window_icon = NULL;
static lv_obj_t *greenhouse_brightness_slider = NULL;
static lv_obj_t *greenhouse_brightness_value_label = NULL;
static lv_obj_t *greenhouse_settings_clock_label = NULL;
static lv_obj_t *greenhouse_wifi_status_label = NULL;
static lv_obj_t *greenhouse_wifi_ssid_label = NULL;
static lv_obj_t *greenhouse_wifi_rssi_label = NULL;
static lv_obj_t *greenhouse_rotation_lock_value_label = NULL;
static lv_obj_t *greenhouse_rotation_toggle_knob = NULL;
static lv_obj_t *greenhouse_rotation_free_label = NULL;
static lv_obj_t *greenhouse_rotation_locked_label = NULL;
static lv_obj_t *greenhouse_version_label = NULL;
static lv_obj_t *greenhouse_updated_label_1 = NULL;
static lv_obj_t *greenhouse_updated_label_2 = NULL;
static lv_obj_t *greenhouse_stats_temp_line = NULL;
static lv_obj_t *greenhouse_stats_humidity_line = NULL;
static lv_obj_t *greenhouse_stats_temp_panel = NULL;
static lv_obj_t *greenhouse_stats_humidity_panel = NULL;
static lv_obj_t *greenhouse_stats_temp_label = NULL;
static lv_obj_t *greenhouse_stats_humidity_label = NULL;
static lv_obj_t *greenhouse_stats_temp_range_label = NULL;
static lv_obj_t *greenhouse_stats_humidity_range_label = NULL;
static lv_obj_t *greenhouse_stats_temp_degree_mark = NULL;
static lv_obj_t *greenhouse_stats_temp_c_label = NULL;
static lv_obj_t *greenhouse_updated_label_settings = NULL;
static lv_obj_t *greenhouse_wifi_alert_ring = NULL;
static lv_obj_t *greenhouse_wifi_alert_segment = NULL;
static lv_obj_t *greenhouse_refresh_toast = NULL;
static lv_obj_t *greenhouse_refresh_toast_label = NULL;
static lv_obj_t *greenhouse_boot_screen = NULL;
static lv_obj_t *greenhouse_boot_status_label = NULL;
static lv_timer_t *greenhouse_refresh_toast_timer = NULL;
static lv_timer_t *greenhouse_dashboard_timer = NULL;
static lv_timer_t *greenhouse_page_2_return_timer = NULL;
static lv_timer_t *greenhouse_settings_return_timer = NULL;
static lv_timer_t *greenhouse_auto_brightness_timer = NULL;
static uint8_t greenhouse_page_index = 0;
static lv_point_t greenhouse_touch_start = {0, 0};
static bool greenhouse_touch_active = false;
static bool greenhouse_touch_woke_screen = false;
static bool greenhouse_night_sleep_dimmed = false;
static uint32_t greenhouse_slide_1_aux_color = GREENHOUSE_METRIC_TITLE;
static bool greenhouse_setting_brightness_from_code = false;
static lv_point_t greenhouse_stats_temp_points[25];
static lv_point_t greenhouse_stats_humidity_points[25];
static volatile uint32_t greenhouse_lvgl_heartbeat_count = 0;
static volatile uint32_t greenhouse_lvgl_last_ms = 0;

LV_FONT_DECLARE(drivhus_digits_80);
LV_FONT_DECLARE(inter_24);
LV_FONT_DECLARE(inter_96);
LV_FONT_DECLARE(inter_16_new);
LV_FONT_DECLARE(ikoner_18);
LV_IMG_DECLARE(kristin_driv);
LV_IMG_DECLARE(GreenhouseIcon);
LV_IMG_DECLARE(image_cold);
LV_IMG_DECLARE(image_mild);
LV_IMG_DECLARE(image_warm);
LV_IMG_DECLARE(image_hot);
LV_IMG_DECLARE(window_closed);
LV_IMG_DECLARE(window_open);
LV_IMG_DECLARE(door_closed);
LV_IMG_DECLARE(door_open);
LV_IMG_DECLARE(fan_heating);
LV_IMG_DECLARE(fan_off);

float __attribute__((weak)) greenhouse_read_temperature_c(void)
{
  return NAN;
}

float __attribute__((weak)) greenhouse_read_humidity_percent(void)
{
  return NAN;
}

int __attribute__((weak)) greenhouse_read_stats_temperature(float *out_values, int max_values)
{
  (void)out_values;
  (void)max_values;
  return 0;
}

int __attribute__((weak)) greenhouse_read_stats_humidity(float *out_values, int max_values)
{
  (void)out_values;
  (void)max_values;
  return 0;
}

int __attribute__((weak)) greenhouse_read_door_closed(void)
{
  return -1;
}

int __attribute__((weak)) greenhouse_read_fan_on(void)
{
  return -1;
}

int __attribute__((weak)) greenhouse_read_heating_on(void)
{
  return -1;
}

int __attribute__((weak)) greenhouse_read_windows_open(void)
{
  return -1;
}

const char * __attribute__((weak)) greenhouse_read_updated_at(void)
{
  return "";
}

int __attribute__((weak)) greenhouse_read_wifi_connected(void)
{
  return -1;
}

int __attribute__((weak)) greenhouse_read_wifi_rssi(void)
{
  return 0;
}

const char * __attribute__((weak)) greenhouse_read_wifi_ssid(void)
{
  return "";
}

uint32_t __attribute__((weak)) greenhouse_read_theme_bg_color(const char *slot, uint32_t fallback)
{
  (void)slot;
  return fallback;
}

uint32_t __attribute__((weak)) greenhouse_read_theme_label_color(const char *slot, uint32_t fallback)
{
  (void)slot;
  return fallback;
}

uint8_t __attribute__((weak)) greenhouse_read_theme_label_opa(const char *slot, uint8_t fallback)
{
  (void)slot;
  return fallback;
}

uint32_t __attribute__((weak)) greenhouse_read_theme_temperature_value_color(const char *slot, uint32_t fallback)
{
  (void)slot;
  return fallback;
}

uint32_t __attribute__((weak)) greenhouse_read_theme_humidity_value_color(const char *slot, uint32_t fallback)
{
  (void)slot;
  return fallback;
}

uint32_t __attribute__((weak)) greenhouse_read_theme_unit_color(const char *slot, uint32_t fallback)
{
  (void)slot;
  return fallback;
}

uint32_t __attribute__((weak)) greenhouse_read_theme_aux_color(const char *slot, uint32_t fallback)
{
  (void)slot;
  return fallback;
}

uint32_t __attribute__((weak)) greenhouse_read_theme_graph_panel_bg(const char *slot, uint32_t fallback)
{
  (void)slot;
  return fallback;
}

uint32_t __attribute__((weak)) greenhouse_read_theme_graph_panel_border(const char *slot, uint32_t fallback)
{
  (void)slot;
  return fallback;
}

uint32_t __attribute__((weak)) greenhouse_read_theme_door_icon_color(const char *slot, uint32_t fallback)
{
  (void)slot;
  return fallback;
}

uint32_t __attribute__((weak)) greenhouse_read_theme_window_icon_color(const char *slot, uint32_t fallback)
{
  (void)slot;
  return fallback;
}

uint32_t __attribute__((weak)) greenhouse_read_theme_fan_icon_color(const char *slot, uint32_t fallback)
{
  (void)slot;
  return fallback;
}

const void * __attribute__((weak)) greenhouse_read_theme_image_src(const char *slot)
{
  (void)slot;
  return NULL;
}

int __attribute__((weak)) greenhouse_read_data_age_seconds(void)
{
  return -1;
}

int __attribute__((weak)) greenhouse_read_weather_is_rain(void)
{
  return 0;
}

int __attribute__((weak)) greenhouse_read_weather_is_night(void)
{
  return 0;
}

int __attribute__((weak)) greenhouse_read_current_oslo_hour(void)
{
  return -1;
}

const char * __attribute__((weak)) greenhouse_read_current_oslo_time_text(void)
{
  return "--:--:--";
}

void __attribute__((weak)) greenhouse_request_refresh(void)
{
}

int __attribute__((weak)) greenhouse_read_rotation_locked(void)
{
  return 1;
}

void __attribute__((weak)) greenhouse_set_rotation_locked(int locked)
{
  (void)locked;
}

static void greenhouse_update_dashboard(lv_timer_t *timer);
static void greenhouse_ui_create(void);
static void greenhouse_show_page(uint8_t page_index);
static void greenhouse_show_settings(bool show);
static void greenhouse_page_event_cb(lv_event_t *event);
static void greenhouse_settings_event_cb(lv_event_t *event);
static void greenhouse_settings_close_event_cb(lv_event_t *event);
static void greenhouse_rotation_lock_event_cb(lv_event_t *event);
static void greenhouse_wifi_alert_spin_cb(void *obj, int32_t value);
static void greenhouse_set_wifi_alert_visible(bool visible);
static void greenhouse_show_refresh_toast(const char *text, uint32_t border_color, bool auto_hide);
static void greenhouse_refresh_toast_timer_cb(lv_timer_t *timer);
static void greenhouse_page_2_return_timer_cb(lv_timer_t *timer);
static void greenhouse_settings_return_timer_cb(lv_timer_t *timer);
static void greenhouse_auto_brightness_timer_cb(lv_timer_t *timer);
static void greenhouse_add_page_touch_layer(lv_obj_t *page);
static lv_obj_t *greenhouse_create_page(lv_obj_t *parent);
static lv_obj_t *greenhouse_create_settings_page(lv_obj_t *parent);
static lv_obj_t *greenhouse_create_metric(lv_obj_t *parent, const char *title, lv_obj_t **value_label);
static lv_obj_t *greenhouse_create_metric_unit(lv_obj_t *parent, const char *title, const char *unit, lv_obj_t **title_label, lv_obj_t **value_label, lv_obj_t **unit_label);
static lv_obj_t *greenhouse_create_stats_graph(lv_obj_t *parent, int y, const char *title, uint32_t color, lv_obj_t **line, lv_obj_t **value_label, lv_obj_t **range_label);
static void greenhouse_create_status_item(lv_obj_t *parent, int16_t y, const void *icon_src, lv_obj_t **icon_obj, lv_obj_t **label_obj);
static lv_obj_t *greenhouse_create_status_value(lv_obj_t *parent, const char *title, lv_obj_t **value_label);
static lv_obj_t *greenhouse_create_info_value(lv_obj_t *parent, const char *title, lv_obj_t **value_label);
static void greenhouse_brightness_event_cb(lv_event_t *event);
static esp_err_t greenhouse_panel_tx_param(uint8_t command, const void *param, size_t param_size);
static void greenhouse_update_brightness_value_label(uint8_t brightness);
static void greenhouse_update_settings_clock(void);
static void greenhouse_brightness_anim_cb(void *var, int32_t value);
static void greenhouse_apply_brightness_now(uint8_t brightness, bool update_controls, bool log_change);
static void greenhouse_apply_brightness(uint8_t brightness, bool update_controls);
static void greenhouse_fade_brightness(uint8_t brightness, bool update_controls);
static void greenhouse_set_brightness(uint8_t brightness);
static void greenhouse_mark_activity(void);
static void greenhouse_note_activity(void);
static void greenhouse_reset_settings_return_timer(void);
static void greenhouse_update_auto_brightness(void);
static bool greenhouse_is_night_hour(int hour);
static bool greenhouse_is_current_night(void);
static void greenhouse_set_slide_1_slot_theme(const char *slot, uint32_t bg_color, uint32_t label_color, uint8_t label_opa, uint32_t temp_value_color, uint32_t humidity_value_color, uint32_t unit_color, uint32_t aux_color, const void *image_src);
static void greenhouse_set_fetching_labels(void);
static void greenhouse_update_rotation_lock_label(void);
static void greenhouse_set_updated_label(lv_obj_t *label, const char *updated_at, int data_age_seconds, int wifi_connected);
static void greenhouse_set_slide_1_data_time(const char *updated_at);
static void greenhouse_label_set_text(lv_obj_t *label, const char *text);
static void greenhouse_apply_temperature_theme(float temp_c);
static void greenhouse_set_slide_1_theme(uint32_t bg_color, uint32_t label_color, uint8_t label_opa, uint32_t temp_value_color, uint32_t humidity_value_color, uint32_t unit_color, uint32_t aux_color, uint32_t graph_panel_bg, uint32_t graph_panel_border, uint32_t door_icon_color, uint32_t window_icon_color, uint32_t fan_icon_color, const void *image_src);
static void greenhouse_update_stats_page(void);
static void greenhouse_update_stats_graph(const float *values, int count, lv_obj_t *line, lv_point_t *points, lv_obj_t *value_label, lv_obj_t *range_label, const char *unit);
static int greenhouse_last_sunday(int year, int month);
static int greenhouse_day_of_week(int year, int month, int day);
static bool greenhouse_oslo_time_from_utc(const char *updated_at, int *hour, int *minute);

static const sh8601_lcd_init_cmd_t sh8601_lcd_init_cmds[] = 
{
  {0x11, (uint8_t []){0x00}, 0, 120},
  {0x44, (uint8_t []){0x01, 0xD1}, 2, 0},
  {0x35, (uint8_t []){0x00}, 1, 0},
  {0x53, (uint8_t []){0x20}, 1, 10},
  {0x51, (uint8_t []){0x00}, 1, 10},
  {0x29, (uint8_t []){0x00}, 0, 10},
  {0x51, (uint8_t []){0xFF}, 1, 0},
  //{0x36, (uint8_t []){0x80}, 1, 0},
};
static const sh8601_lcd_init_cmd_t co5300_lcd_init_cmds[] = 
{
  {0x11, (uint8_t []){0x00}, 0, 80},   
  {0xC4, (uint8_t []){0x80}, 1, 0},
  //{0x44, (uint8_t []){0x01, 0xD1}, 2, 0},
  //{0x35, (uint8_t []){0x00}, 1, 0},//TE ON
  {0x53, (uint8_t []){0x20}, 1, 1},
  {0x63, (uint8_t []){0xFF}, 1, 1},
  {0x51, (uint8_t []){0x00}, 1, 1},
  {0x29, (uint8_t []){0x00}, 0, 10},
  {0x51, (uint8_t []){0xFF}, 1, 0},
  //{0x36, (uint8_t []){0x60}, 1, 0},
};


void lcd_lvgl_Init(void)
{
  READ_LCD_ID = read_lcd_id();
  static lv_disp_draw_buf_t disp_buf; // contains internal graphic buffer(s) called draw buffer(s)
  static lv_disp_drv_t disp_drv;      // contains callback functions

  const spi_bus_config_t buscfg = SH8601_PANEL_BUS_QSPI_CONFIG(EXAMPLE_PIN_NUM_LCD_PCLK,
                                                               EXAMPLE_PIN_NUM_LCD_DATA0,
                                                               EXAMPLE_PIN_NUM_LCD_DATA1,
                                                               EXAMPLE_PIN_NUM_LCD_DATA2,
                                                               EXAMPLE_PIN_NUM_LCD_DATA3,
                                                               EXAMPLE_LCD_H_RES * EXAMPLE_LVGL_BUF_HEIGHT * LCD_BIT_PER_PIXEL / 8);
  ESP_ERROR_CHECK(spi_bus_initialize(LCD_HOST, &buscfg, SPI_DMA_CH_AUTO));
  esp_lcd_panel_io_handle_t io_handle = NULL;

  const esp_lcd_panel_io_spi_config_t io_config = SH8601_PANEL_IO_QSPI_CONFIG(EXAMPLE_PIN_NUM_LCD_CS,
                                                                              example_notify_lvgl_flush_ready,
                                                                              &disp_drv);

  sh8601_vendor_config_t vendor_config = 
  {
    .flags = 
    {
      .use_qspi_interface = 1,
    },
  };
  ESP_ERROR_CHECK(esp_lcd_new_panel_io_spi((esp_lcd_spi_bus_handle_t)LCD_HOST, &io_config, &io_handle));
  greenhouse_panel_io_handle = io_handle;
  esp_lcd_panel_handle_t panel_handle = NULL;
  const esp_lcd_panel_dev_config_t panel_config = 
  {
    .reset_gpio_num = EXAMPLE_PIN_NUM_LCD_RST,
    .rgb_ele_order = LCD_RGB_ELEMENT_ORDER_RGB,
    .bits_per_pixel = LCD_BIT_PER_PIXEL,
    .vendor_config = &vendor_config,
  };
  if (READ_LCD_ID == SH8601_ID)
  {
    vendor_config.init_cmds = sh8601_lcd_init_cmds;
    vendor_config.init_cmds_size = sizeof(sh8601_lcd_init_cmds) / sizeof(sh8601_lcd_init_cmds[0]);
    ESP_LOGI(TAG, "Detected SH8601 LCD panel");
  }
  else if (READ_LCD_ID == CO5300_ID)
  {
    vendor_config.init_cmds = co5300_lcd_init_cmds;
    vendor_config.init_cmds_size = sizeof(co5300_lcd_init_cmds) / sizeof(co5300_lcd_init_cmds[0]);
    ESP_LOGI(TAG, "Detected CO5300 LCD panel");
  }
  else
  {
    vendor_config.init_cmds = co5300_lcd_init_cmds;
    vendor_config.init_cmds_size = sizeof(co5300_lcd_init_cmds) / sizeof(co5300_lcd_init_cmds[0]);
    ESP_LOGW(TAG, "Unknown LCD panel id 0x%02x, falling back to CO5300 init", READ_LCD_ID);
  }
  ESP_ERROR_CHECK(esp_lcd_new_panel_sh8601(io_handle, &panel_config, &panel_handle));
  ESP_ERROR_CHECK(esp_lcd_panel_reset(panel_handle));
  ESP_ERROR_CHECK(esp_lcd_panel_init(panel_handle));
  ESP_ERROR_CHECK(esp_lcd_panel_disp_on_off(panel_handle, true));

  lv_init();
  lv_color_t *buf1 = heap_caps_malloc(EXAMPLE_LCD_H_RES * EXAMPLE_LVGL_BUF_HEIGHT * sizeof(lv_color_t), MALLOC_CAP_DMA);
  assert(buf1);
  lv_color_t *buf2 = heap_caps_malloc(EXAMPLE_LCD_H_RES * EXAMPLE_LVGL_BUF_HEIGHT * sizeof(lv_color_t), MALLOC_CAP_DMA);
  if (buf2 == NULL)
  {
    ESP_LOGW(TAG, "Only one LVGL draw buffer allocated");
  }
  lv_disp_draw_buf_init(&disp_buf, buf1, buf2, EXAMPLE_LCD_H_RES * EXAMPLE_LVGL_BUF_HEIGHT);
  lv_disp_drv_init(&disp_drv);
  disp_drv.hor_res = EXAMPLE_LCD_H_RES;
  disp_drv.ver_res = EXAMPLE_LCD_V_RES;
  disp_drv.flush_cb = example_lvgl_flush_cb;
  disp_drv.rounder_cb = example_lvgl_rounder_cb;
  disp_drv.draw_buf = &disp_buf;
  disp_drv.user_data = panel_handle;
#ifdef EXAMPLE_Rotate_90
  disp_drv.sw_rotate = 1;
  disp_drv.rotated = LV_DISP_ROT_270;
#endif
  lv_disp_t *disp = lv_disp_drv_register(&disp_drv);
  greenhouse_display = disp;

  static lv_indev_drv_t indev_drv;    // Input device driver (Touch)
  lv_indev_drv_init(&indev_drv);
  indev_drv.type = LV_INDEV_TYPE_POINTER;
  indev_drv.disp = disp;
  indev_drv.read_cb = example_lvgl_touch_cb;
  lv_indev_drv_register(&indev_drv);

  const esp_timer_create_args_t lvgl_tick_timer_args = 
  {
    .callback = &example_increase_lvgl_tick,
    .name = "lvgl_tick"
  };
  esp_timer_handle_t lvgl_tick_timer = NULL;
  ESP_ERROR_CHECK(esp_timer_create(&lvgl_tick_timer_args, &lvgl_tick_timer));
  ESP_ERROR_CHECK(esp_timer_start_periodic(lvgl_tick_timer, EXAMPLE_LVGL_TICK_PERIOD_MS * 1000));

  lvgl_mux = xSemaphoreCreateMutex(); //mutex semaphores
  assert(lvgl_mux);
  if (example_lvgl_lock(-1)) 
  {   
    greenhouse_ui_create();
    greenhouse_auto_brightness_timer = lv_timer_create(greenhouse_auto_brightness_timer_cb, 1000, NULL);
    greenhouse_update_dashboard(NULL);

    // Release the mutex
    example_lvgl_unlock();
  }
  xTaskCreate(example_lvgl_port_task, "LVGL", EXAMPLE_LVGL_TASK_STACK_SIZE, NULL, EXAMPLE_LVGL_TASK_PRIORITY, NULL);
}

void greenhouse_start_dashboard_timer(void)
{
  if (lvgl_mux == NULL)
  {
    return;
  }

  if (example_lvgl_lock(1000))
  {
    greenhouse_update_dashboard(NULL);
    if (greenhouse_dashboard_timer == NULL)
    {
      greenhouse_dashboard_timer = lv_timer_create(greenhouse_update_dashboard, 10000, NULL);
    }
    example_lvgl_unlock();
  }
}

uint32_t greenhouse_read_lvgl_heartbeat_count(void)
{
  return greenhouse_lvgl_heartbeat_count;
}

uint32_t greenhouse_read_lvgl_last_ms(void)
{
  return greenhouse_lvgl_last_ms;
}

uint8_t greenhouse_read_page_index(void)
{
  return greenhouse_page_index;
}

int greenhouse_read_touch_active(void)
{
  return greenhouse_touch_active ? 1 : 0;
}

static void greenhouse_ui_create(void)
{
  lv_obj_t *screen = lv_scr_act();
  lv_obj_clear_flag(screen, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_style_bg_color(screen, lv_color_hex(GREENHOUSE_METRIC_BG), 0);
  lv_obj_set_style_bg_opa(screen, LV_OPA_COVER, 0);

  greenhouse_page_1 = greenhouse_create_page(screen);
  greenhouse_page_2 = greenhouse_create_page(screen);
  greenhouse_page_3 = greenhouse_create_page(screen);
  greenhouse_settings_page = greenhouse_create_settings_page(screen);
  lv_obj_add_event_cb(greenhouse_settings_page, greenhouse_settings_event_cb, LV_EVENT_GESTURE, NULL);
  lv_obj_add_event_cb(greenhouse_settings_page, greenhouse_settings_event_cb, LV_EVENT_CLICKED, NULL);

  greenhouse_photo = lv_img_create(greenhouse_page_1);
  lv_img_set_src(greenhouse_photo, &image_mild);
  lv_obj_add_flag(greenhouse_photo, LV_OBJ_FLAG_IGNORE_LAYOUT);
  lv_obj_clear_flag(greenhouse_photo, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_pos(greenhouse_photo, EXAMPLE_LCD_H_RES - 164, 0);

  greenhouse_wifi_icon_label = lv_label_create(greenhouse_page_1);
  lv_label_set_text(greenhouse_wifi_icon_label, "$");
  lv_obj_add_flag(greenhouse_wifi_icon_label, LV_OBJ_FLAG_IGNORE_LAYOUT);
  lv_obj_set_style_text_color(greenhouse_wifi_icon_label, lv_color_hex(0xFFFFFF), 0);
  lv_obj_set_style_text_font(greenhouse_wifi_icon_label, &ikoner_18, 0);
  lv_obj_set_style_bg_opa(greenhouse_wifi_icon_label, LV_OPA_TRANSP, 0);
  lv_obj_set_pos(greenhouse_wifi_icon_label, 252, 50);

  lv_obj_t *greenhouse_metric_group = lv_obj_create(greenhouse_page_1);
  lv_obj_remove_style_all(greenhouse_metric_group);
  lv_obj_add_flag(greenhouse_metric_group, LV_OBJ_FLAG_IGNORE_LAYOUT);
  lv_obj_clear_flag(greenhouse_metric_group, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_pos(greenhouse_metric_group, 34, 128);
  lv_obj_set_size(greenhouse_metric_group, 250, 258);
  lv_obj_add_flag(greenhouse_metric_group, LV_OBJ_FLAG_OVERFLOW_VISIBLE);
  lv_obj_set_style_bg_opa(greenhouse_metric_group, LV_OPA_TRANSP, 0);
  lv_obj_set_style_pad_all(greenhouse_metric_group, 0, 0);
  lv_obj_set_style_pad_row(greenhouse_metric_group, 0, 0);
  lv_obj_set_flex_flow(greenhouse_metric_group, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_flex_align(greenhouse_metric_group, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_END, LV_FLEX_ALIGN_END);

  greenhouse_temp_metric = greenhouse_create_metric_unit(greenhouse_metric_group, "TEMPERATUR", "\xC2\xB0" "C", &greenhouse_temp_title_label, &greenhouse_temp_label, &greenhouse_temp_unit_label);
  lv_obj_set_style_translate_y(greenhouse_temp_metric, -17, 0);
  greenhouse_humidity_metric = greenhouse_create_metric_unit(greenhouse_metric_group, "LUFTFUKTIGHET", "%", &greenhouse_humidity_title_label, &greenhouse_humidity_label, &greenhouse_humidity_unit_label);

  greenhouse_refresh_icon_label = lv_label_create(greenhouse_page_1);
  lv_label_set_text(greenhouse_refresh_icon_label, "\"");
  lv_obj_add_flag(greenhouse_refresh_icon_label, LV_OBJ_FLAG_IGNORE_LAYOUT);
  lv_obj_set_style_text_color(greenhouse_refresh_icon_label, lv_color_hex(GREENHOUSE_METRIC_TITLE), 0);
  lv_obj_set_style_text_font(greenhouse_refresh_icon_label, &ikoner_18, 0);
  lv_obj_set_style_bg_opa(greenhouse_refresh_icon_label, LV_OPA_TRANSP, 0);
  lv_obj_set_pos(greenhouse_refresh_icon_label, 192, 402);

  greenhouse_data_time_label = lv_label_create(greenhouse_page_1);
  lv_label_set_text(greenhouse_data_time_label, "--:--");
  lv_obj_add_flag(greenhouse_data_time_label, LV_OBJ_FLAG_IGNORE_LAYOUT);
  lv_obj_set_width(greenhouse_data_time_label, 74);
  lv_obj_set_style_text_align(greenhouse_data_time_label, LV_TEXT_ALIGN_LEFT, 0);
  lv_obj_set_style_text_color(greenhouse_data_time_label, lv_color_hex(GREENHOUSE_METRIC_TITLE), 0);
  lv_obj_set_style_text_font(greenhouse_data_time_label, &inter_16_new, 0);
  lv_obj_set_style_bg_opa(greenhouse_data_time_label, LV_OPA_TRANSP, 0);
  lv_obj_set_pos(greenhouse_data_time_label, 223, 402);

  greenhouse_updated_label_1 = lv_label_create(greenhouse_page_1);
  lv_label_set_text(greenhouse_updated_label_1, "Oppdatert: --:--");
  lv_obj_add_flag(greenhouse_updated_label_1, LV_OBJ_FLAG_HIDDEN);
  lv_obj_set_style_text_color(greenhouse_updated_label_1, lv_color_hex(GREENHOUSE_METRIC_TEXT), 0);
  lv_obj_set_style_text_font(greenhouse_updated_label_1, &inter_16_new, 0);
  greenhouse_add_page_touch_layer(greenhouse_page_1);

  greenhouse_create_status_item(greenhouse_page_2, 66, &window_closed, &greenhouse_window_icon, &greenhouse_window_status_label);
  greenhouse_create_status_item(greenhouse_page_2, 178, &door_closed, &greenhouse_door_icon, &greenhouse_door_status_label);
  greenhouse_create_status_item(greenhouse_page_2, 292, &fan_off, &greenhouse_climate_icon, &greenhouse_climate_status_label);

  greenhouse_updated_label_2 = lv_label_create(greenhouse_page_2);
  lv_label_set_text(greenhouse_updated_label_2, "Oppdatert: --:--");
  lv_obj_add_flag(greenhouse_updated_label_2, LV_OBJ_FLAG_HIDDEN);
  lv_obj_set_style_text_color(greenhouse_updated_label_2, lv_color_hex(GREENHOUSE_METRIC_TEXT), 0);
  lv_obj_set_style_text_font(greenhouse_updated_label_2, &inter_16_new, 0);
  greenhouse_add_page_touch_layer(greenhouse_page_2);

  lv_obj_t *stats_title = lv_label_create(greenhouse_page_3);
  lv_label_set_text(stats_title, "SISTE 12 TIMER");
  lv_obj_set_width(stats_title, 320);
  lv_obj_set_style_text_align(stats_title, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_set_style_text_color(stats_title, lv_color_hex(0xDCE8D4), 0);
  lv_obj_set_style_text_letter_space(stats_title, 1, 0);
  lv_obj_set_style_text_font(stats_title, &inter_24, 0);
  lv_obj_align(stats_title, LV_ALIGN_CENTER, 0, 0);

  lv_obj_t *temp_graph_panel = greenhouse_create_stats_graph(greenhouse_page_3, 72, "TEMPERATUR", GREENHOUSE_ACCENT, &greenhouse_stats_temp_line, &greenhouse_stats_temp_label, &greenhouse_stats_temp_range_label);
  greenhouse_stats_temp_panel = temp_graph_panel;
  greenhouse_stats_temp_degree_mark = lv_obj_create(temp_graph_panel);
  lv_obj_remove_style_all(greenhouse_stats_temp_degree_mark);
  lv_obj_set_size(greenhouse_stats_temp_degree_mark, 7, 7);
  lv_obj_set_pos(greenhouse_stats_temp_degree_mark, 292, 13);
  lv_obj_set_style_radius(greenhouse_stats_temp_degree_mark, 4, 0);
  lv_obj_set_style_border_width(greenhouse_stats_temp_degree_mark, 2, 0);
  lv_obj_set_style_border_color(greenhouse_stats_temp_degree_mark, lv_color_hex(GREENHOUSE_ACCENT), 0);
  lv_obj_set_style_bg_opa(greenhouse_stats_temp_degree_mark, LV_OPA_TRANSP, 0);
  lv_obj_clear_flag(greenhouse_stats_temp_degree_mark, LV_OBJ_FLAG_SCROLLABLE);

  greenhouse_stats_temp_c_label = lv_label_create(temp_graph_panel);
  lv_label_set_text(greenhouse_stats_temp_c_label, "C");
  lv_obj_set_style_text_color(greenhouse_stats_temp_c_label, lv_color_hex(GREENHOUSE_ACCENT), 0);
  lv_obj_set_style_text_font(greenhouse_stats_temp_c_label, &inter_16_new, 0);
  lv_obj_set_pos(greenhouse_stats_temp_c_label, 304, 8);
  greenhouse_stats_humidity_panel = greenhouse_create_stats_graph(greenhouse_page_3, 282, "LUFTFUKTIGHET", GREENHOUSE_COOL, &greenhouse_stats_humidity_line, &greenhouse_stats_humidity_label, &greenhouse_stats_humidity_range_label);
  greenhouse_add_page_touch_layer(greenhouse_page_3);

  lv_obj_t *settings_bottom = lv_obj_create(greenhouse_settings_page);
  lv_obj_remove_style_all(settings_bottom);
  lv_obj_clear_flag(settings_bottom, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_size(settings_bottom, EXAMPLE_LCD_H_RES, 146);
  lv_obj_set_pos(settings_bottom, 0, 320);
  lv_obj_set_style_bg_color(settings_bottom, lv_color_hex(GREENHOUSE_PANEL_BG), 0);
  lv_obj_set_style_bg_opa(settings_bottom, LV_OPA_COVER, 0);

  lv_obj_t *settings_logo = lv_img_create(greenhouse_settings_page);
  lv_img_set_src(settings_logo, &GreenhouseIcon);
  lv_obj_clear_flag(settings_logo, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_align(settings_logo, LV_ALIGN_TOP_MID, 0, 34);

  lv_obj_t *settings_title = lv_label_create(greenhouse_settings_page);
  lv_label_set_text(settings_title, "KRISTINS DRIVHUS");
  lv_obj_set_width(settings_title, 260);
  lv_obj_set_style_text_align(settings_title, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_set_style_text_color(settings_title, lv_color_hex(0xE8EDE3), 0);
  lv_obj_set_style_text_font(settings_title, &inter_16_new, 0);
  lv_obj_align(settings_title, LV_ALIGN_TOP_MID, 0, 100);

  greenhouse_version_label = lv_label_create(greenhouse_settings_page);
  greenhouse_label_set_text(greenhouse_version_label, GREENHOUSE_APP_VERSION);
  lv_obj_set_width(greenhouse_version_label, 120);
  lv_obj_set_style_text_align(greenhouse_version_label, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_set_style_text_color(greenhouse_version_label, lv_color_hex(GREENHOUSE_MUTED_TEXT), 0);
  lv_obj_set_style_text_font(greenhouse_version_label, &inter_16_new, 0);
  lv_obj_align(greenhouse_version_label, LV_ALIGN_TOP_MID, 0, 124);

  lv_obj_t *brightness_title = lv_label_create(greenhouse_settings_page);
  lv_label_set_text(brightness_title, "LYSSTYRKE SKJERM");
  lv_obj_set_width(brightness_title, 300);
  lv_obj_set_style_text_align(brightness_title, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_set_style_text_color(brightness_title, lv_color_hex(GREENHOUSE_ACCENT), 0);
  lv_obj_set_style_text_font(brightness_title, &inter_16_new, 0);
  lv_obj_set_pos(brightness_title, 83, 160);

  greenhouse_brightness_slider = lv_slider_create(greenhouse_settings_page);
  lv_obj_set_width(greenhouse_brightness_slider, 182);
  lv_obj_set_height(greenhouse_brightness_slider, 8);
  lv_obj_set_pos(greenhouse_brightness_slider, 126, 204);
  lv_obj_set_ext_click_area(greenhouse_brightness_slider, 24);
  lv_slider_set_range(greenhouse_brightness_slider, 8, 255);
  lv_slider_set_value(greenhouse_brightness_slider, greenhouse_manual_brightness, LV_ANIM_OFF);
  lv_obj_clear_flag(greenhouse_brightness_slider, LV_OBJ_FLAG_GESTURE_BUBBLE);
  lv_obj_add_flag(greenhouse_brightness_slider, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_add_event_cb(greenhouse_brightness_slider, greenhouse_brightness_event_cb, LV_EVENT_VALUE_CHANGED, NULL);
  lv_obj_add_event_cb(greenhouse_brightness_slider, greenhouse_brightness_event_cb, LV_EVENT_RELEASED, NULL);
  lv_obj_set_style_bg_color(greenhouse_brightness_slider, lv_color_hex(GREENHOUSE_METRIC_BG), LV_PART_MAIN);
  lv_obj_set_style_bg_opa(greenhouse_brightness_slider, LV_OPA_COVER, LV_PART_MAIN);
  lv_obj_set_style_radius(greenhouse_brightness_slider, 4, LV_PART_MAIN);
  lv_obj_set_style_bg_color(greenhouse_brightness_slider, lv_color_hex(0xF1ECEC), LV_PART_INDICATOR);
  lv_obj_set_style_radius(greenhouse_brightness_slider, 4, LV_PART_INDICATOR);
  lv_obj_set_style_bg_color(greenhouse_brightness_slider, lv_color_hex(GREENHOUSE_ACCENT), LV_PART_KNOB);
  lv_obj_set_style_pad_all(greenhouse_brightness_slider, 16, LV_PART_KNOB);

  greenhouse_brightness_value_label = lv_label_create(greenhouse_settings_page);
  lv_label_set_text(greenhouse_brightness_value_label, "100%");
  lv_label_set_long_mode(greenhouse_brightness_value_label, LV_LABEL_LONG_CLIP);
  lv_obj_set_width(greenhouse_brightness_value_label, 72);
  lv_obj_set_height(greenhouse_brightness_value_label, 32);
  lv_obj_set_pos(greenhouse_brightness_value_label, 326, 192);
  lv_obj_set_style_text_align(greenhouse_brightness_value_label, LV_TEXT_ALIGN_LEFT, 0);
  lv_obj_set_style_text_color(greenhouse_brightness_value_label, lv_color_hex(GREENHOUSE_METRIC_TEXT), 0);
  lv_obj_set_style_bg_opa(greenhouse_brightness_value_label, LV_OPA_TRANSP, 0);
  lv_obj_set_style_text_font(greenhouse_brightness_value_label, &inter_16_new, 0);
  greenhouse_update_brightness_value_label(greenhouse_manual_brightness);

  lv_obj_t *rotation_title = lv_label_create(greenhouse_settings_page);
  lv_label_set_text(rotation_title, "ROTASJON SKJERM");
  lv_obj_set_width(rotation_title, 300);
  lv_obj_set_style_text_align(rotation_title, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_set_style_text_color(rotation_title, lv_color_hex(GREENHOUSE_ACCENT), 0);
  lv_obj_set_style_text_font(rotation_title, &inter_16_new, 0);
  lv_obj_set_pos(rotation_title, 83, 246);

  greenhouse_rotation_free_label = lv_label_create(greenhouse_settings_page);
  lv_label_set_text(greenhouse_rotation_free_label, "FRI");
  lv_obj_set_width(greenhouse_rotation_free_label, 72);
  lv_obj_set_style_text_align(greenhouse_rotation_free_label, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_set_style_text_color(greenhouse_rotation_free_label, lv_color_hex(0xDCE8D4), 0);
  lv_obj_set_style_text_font(greenhouse_rotation_free_label, &inter_16_new, 0);
  lv_obj_set_pos(greenhouse_rotation_free_label, 115, 286);
  lv_obj_add_flag(greenhouse_rotation_free_label, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_set_ext_click_area(greenhouse_rotation_free_label, 14);
  lv_obj_clear_flag(greenhouse_rotation_free_label, LV_OBJ_FLAG_GESTURE_BUBBLE);
  lv_obj_add_event_cb(greenhouse_rotation_free_label, greenhouse_rotation_lock_event_cb, LV_EVENT_CLICKED, NULL);

  lv_obj_t *rotation_toggle = lv_obj_create(greenhouse_settings_page);
  lv_obj_remove_style_all(rotation_toggle);
  lv_obj_set_size(rotation_toggle, 86, 34);
  lv_obj_set_pos(rotation_toggle, 190, 281);
  lv_obj_set_style_bg_color(rotation_toggle, lv_color_hex(0x5D7342), 0);
  lv_obj_set_style_bg_opa(rotation_toggle, LV_OPA_COVER, 0);
  lv_obj_set_style_radius(rotation_toggle, 17, 0);
  lv_obj_add_flag(rotation_toggle, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_set_ext_click_area(rotation_toggle, 24);
  lv_obj_clear_flag(rotation_toggle, LV_OBJ_FLAG_GESTURE_BUBBLE);
  lv_obj_add_event_cb(rotation_toggle, greenhouse_rotation_lock_event_cb, LV_EVENT_CLICKED, NULL);

  greenhouse_rotation_toggle_knob = lv_obj_create(rotation_toggle);
  lv_obj_remove_style_all(greenhouse_rotation_toggle_knob);
  lv_obj_set_size(greenhouse_rotation_toggle_knob, 34, 34);
  lv_obj_set_style_bg_color(greenhouse_rotation_toggle_knob, lv_color_hex(GREENHOUSE_ACCENT), 0);
  lv_obj_set_style_bg_opa(greenhouse_rotation_toggle_knob, LV_OPA_COVER, 0);
  lv_obj_set_style_radius(greenhouse_rotation_toggle_knob, 17, 0);
  lv_obj_clear_flag(greenhouse_rotation_toggle_knob, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_add_flag(greenhouse_rotation_toggle_knob, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_set_ext_click_area(greenhouse_rotation_toggle_knob, 18);
  lv_obj_add_event_cb(greenhouse_rotation_toggle_knob, greenhouse_rotation_lock_event_cb, LV_EVENT_CLICKED, NULL);

  greenhouse_rotation_locked_label = lv_label_create(greenhouse_settings_page);
  lv_label_set_text(greenhouse_rotation_locked_label, "L\xC3\x85ST");
  lv_obj_set_width(greenhouse_rotation_locked_label, 86);
  lv_obj_set_style_text_align(greenhouse_rotation_locked_label, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_set_style_text_color(greenhouse_rotation_locked_label, lv_color_hex(0xDCE8D4), 0);
  lv_obj_set_style_text_font(greenhouse_rotation_locked_label, &inter_16_new, 0);
  lv_obj_set_pos(greenhouse_rotation_locked_label, 282, 286);
  lv_obj_add_flag(greenhouse_rotation_locked_label, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_set_ext_click_area(greenhouse_rotation_locked_label, 14);
  lv_obj_clear_flag(greenhouse_rotation_locked_label, LV_OBJ_FLAG_GESTURE_BUBBLE);
  lv_obj_add_event_cb(greenhouse_rotation_locked_label, greenhouse_rotation_lock_event_cb, LV_EVENT_CLICKED, NULL);

  greenhouse_rotation_lock_value_label = lv_label_create(greenhouse_settings_page);
  lv_obj_add_flag(greenhouse_rotation_lock_value_label, LV_OBJ_FLAG_HIDDEN);
  greenhouse_update_rotation_lock_label();

  greenhouse_settings_clock_label = lv_label_create(greenhouse_settings_page);
  lv_label_set_text(greenhouse_settings_clock_label, "--:--:--");
  lv_obj_set_width(greenhouse_settings_clock_label, 180);
  lv_obj_set_style_text_align(greenhouse_settings_clock_label, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_set_style_text_color(greenhouse_settings_clock_label, lv_color_hex(GREENHOUSE_METRIC_TEXT), 0);
  lv_obj_set_style_text_font(greenhouse_settings_clock_label, &inter_16_new, 0);
  lv_obj_set_pos(greenhouse_settings_clock_label, 143, 338);

  lv_obj_t *ssid_title = lv_label_create(greenhouse_settings_page);
  lv_label_set_text(ssid_title, "SSID:");
  lv_obj_set_style_text_color(ssid_title, lv_color_hex(GREENHOUSE_METRIC_TITLE), 0);
  lv_obj_set_style_text_font(ssid_title, &inter_16_new, 0);
  lv_obj_set_pos(ssid_title, 112, 376);

  greenhouse_wifi_ssid_label = lv_label_create(greenhouse_settings_page);
  lv_label_set_text(greenhouse_wifi_ssid_label, "--");
  lv_label_set_long_mode(greenhouse_wifi_ssid_label, LV_LABEL_LONG_DOT);
  lv_obj_set_width(greenhouse_wifi_ssid_label, 140);
  lv_obj_set_style_text_color(greenhouse_wifi_ssid_label, lv_color_hex(GREENHOUSE_METRIC_TEXT), 0);
  lv_obj_set_style_text_font(greenhouse_wifi_ssid_label, &inter_16_new, 0);
  lv_obj_set_pos(greenhouse_wifi_ssid_label, 112, 404);

  lv_obj_t *signal_title = lv_label_create(greenhouse_settings_page);
  lv_label_set_text(signal_title, "SIGNAL:");
  lv_obj_set_style_text_color(signal_title, lv_color_hex(GREENHOUSE_METRIC_TITLE), 0);
  lv_obj_set_style_text_font(signal_title, &inter_16_new, 0);
  lv_obj_set_pos(signal_title, 276, 376);

  greenhouse_wifi_rssi_label = lv_label_create(greenhouse_settings_page);
  lv_label_set_text(greenhouse_wifi_rssi_label, "-- dB");
  lv_label_set_long_mode(greenhouse_wifi_rssi_label, LV_LABEL_LONG_DOT);
  lv_obj_set_width(greenhouse_wifi_rssi_label, 140);
  lv_obj_set_style_text_color(greenhouse_wifi_rssi_label, lv_color_hex(GREENHOUSE_METRIC_TEXT), 0);
  lv_obj_set_style_text_font(greenhouse_wifi_rssi_label, &inter_16_new, 0);
  lv_obj_set_pos(greenhouse_wifi_rssi_label, 276, 404);

  lv_obj_t *settings_close = lv_btn_create(greenhouse_settings_page);
  lv_obj_set_size(settings_close, 88, 34);
  lv_obj_set_pos(settings_close, 189, 424);
  lv_obj_add_event_cb(settings_close, greenhouse_settings_close_event_cb, LV_EVENT_CLICKED, NULL);
  lv_obj_set_style_bg_color(settings_close, lv_color_hex(GREENHOUSE_METRIC_BG), 0);
  lv_obj_set_style_bg_opa(settings_close, LV_OPA_COVER, 0);
  lv_obj_set_style_radius(settings_close, 8, 0);
  lv_obj_set_style_shadow_opa(settings_close, LV_OPA_TRANSP, 0);

  lv_obj_t *settings_close_label = lv_label_create(settings_close);
  lv_label_set_text(settings_close_label, "LUKK");
  lv_obj_center(settings_close_label);
  lv_obj_set_style_text_color(settings_close_label, lv_color_hex(0xDCE8D4), 0);
  lv_obj_set_style_text_font(settings_close_label, &inter_16_new, 0);

  greenhouse_wifi_status_label = lv_label_create(greenhouse_settings_page);
  lv_obj_add_flag(greenhouse_wifi_status_label, LV_OBJ_FLAG_HIDDEN);

  greenhouse_updated_label_settings = lv_label_create(greenhouse_settings_page);
  lv_obj_add_flag(greenhouse_updated_label_settings, LV_OBJ_FLAG_HIDDEN);
  greenhouse_update_settings_clock();

  greenhouse_wifi_alert_ring = lv_arc_create(screen);
  lv_obj_remove_style_all(greenhouse_wifi_alert_ring);
  lv_obj_set_size(greenhouse_wifi_alert_ring, EXAMPLE_LCD_H_RES - 8, EXAMPLE_LCD_V_RES - 8);
  lv_obj_center(greenhouse_wifi_alert_ring);
  lv_arc_set_bg_angles(greenhouse_wifi_alert_ring, 0, 360);
  lv_arc_set_angles(greenhouse_wifi_alert_ring, 0, 0);
  lv_obj_clear_flag(greenhouse_wifi_alert_ring, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_set_style_arc_width(greenhouse_wifi_alert_ring, 8, LV_PART_MAIN);
  lv_obj_set_style_arc_color(greenhouse_wifi_alert_ring, lv_color_hex(0xFFFFFF), LV_PART_MAIN);
  lv_obj_set_style_arc_opa(greenhouse_wifi_alert_ring, LV_OPA_20, LV_PART_MAIN);
  lv_obj_set_style_arc_opa(greenhouse_wifi_alert_ring, LV_OPA_TRANSP, LV_PART_INDICATOR);
  lv_obj_set_style_arc_opa(greenhouse_wifi_alert_ring, LV_OPA_TRANSP, LV_PART_KNOB);
  lv_obj_set_style_bg_opa(greenhouse_wifi_alert_ring, LV_OPA_TRANSP, LV_PART_KNOB);

  greenhouse_wifi_alert_segment = lv_arc_create(screen);
  lv_obj_remove_style_all(greenhouse_wifi_alert_segment);
  lv_obj_set_size(greenhouse_wifi_alert_segment, EXAMPLE_LCD_H_RES - 8, EXAMPLE_LCD_V_RES - 8);
  lv_obj_center(greenhouse_wifi_alert_segment);
  lv_arc_set_bg_angles(greenhouse_wifi_alert_segment, 0, 360);
  lv_arc_set_angles(greenhouse_wifi_alert_segment, 0, 64);
  lv_obj_clear_flag(greenhouse_wifi_alert_segment, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_set_style_arc_opa(greenhouse_wifi_alert_segment, LV_OPA_TRANSP, LV_PART_MAIN);
  lv_obj_set_style_arc_width(greenhouse_wifi_alert_segment, 10, LV_PART_INDICATOR);
  lv_obj_set_style_arc_color(greenhouse_wifi_alert_segment, lv_color_hex(0xFFFFFF), LV_PART_INDICATOR);
  lv_obj_set_style_arc_opa(greenhouse_wifi_alert_segment, LV_OPA_COVER, LV_PART_INDICATOR);
  lv_obj_set_style_arc_opa(greenhouse_wifi_alert_segment, LV_OPA_TRANSP, LV_PART_KNOB);
  lv_obj_set_style_bg_opa(greenhouse_wifi_alert_segment, LV_OPA_TRANSP, LV_PART_KNOB);

  greenhouse_refresh_toast = lv_obj_create(screen);
  lv_obj_remove_style_all(greenhouse_refresh_toast);
  lv_obj_set_size(greenhouse_refresh_toast, 174, 58);
  lv_obj_center(greenhouse_refresh_toast);
  lv_obj_clear_flag(greenhouse_refresh_toast, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_clear_flag(greenhouse_refresh_toast, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_set_style_bg_color(greenhouse_refresh_toast, lv_color_hex(0x101D12), 0);
  lv_obj_set_style_bg_opa(greenhouse_refresh_toast, LV_OPA_COVER, 0);
  lv_obj_set_style_border_color(greenhouse_refresh_toast, lv_color_hex(GREENHOUSE_OK), 0);
  lv_obj_set_style_border_width(greenhouse_refresh_toast, 2, 0);
  lv_obj_set_style_radius(greenhouse_refresh_toast, 18, 0);
  lv_obj_set_style_shadow_opa(greenhouse_refresh_toast, LV_OPA_TRANSP, 0);

  greenhouse_refresh_toast_label = lv_label_create(greenhouse_refresh_toast);
  lv_label_set_text(greenhouse_refresh_toast_label, "Oppdatert");
  lv_obj_set_style_text_color(greenhouse_refresh_toast_label, lv_color_hex(0xDCE8D4), 0);
  lv_obj_set_style_text_font(greenhouse_refresh_toast_label, &inter_16_new, 0);
  lv_obj_center(greenhouse_refresh_toast_label);
  lv_obj_add_flag(greenhouse_refresh_toast, LV_OBJ_FLAG_HIDDEN);

  greenhouse_boot_screen = lv_obj_create(screen);
  lv_obj_remove_style_all(greenhouse_boot_screen);
  lv_obj_set_size(greenhouse_boot_screen, EXAMPLE_LCD_H_RES, EXAMPLE_LCD_V_RES);
  lv_obj_center(greenhouse_boot_screen);
  lv_obj_clear_flag(greenhouse_boot_screen, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_style_bg_color(greenhouse_boot_screen, lv_color_hex(GREENHOUSE_METRIC_BG), 0);
  lv_obj_set_style_bg_opa(greenhouse_boot_screen, LV_OPA_COVER, 0);
  lv_obj_set_style_radius(greenhouse_boot_screen, 0, 0);
  lv_obj_set_style_pad_all(greenhouse_boot_screen, 0, 0);

  lv_obj_t *boot_logo = lv_img_create(greenhouse_boot_screen);
  lv_img_set_src(boot_logo, &GreenhouseIcon);
  lv_obj_clear_flag(boot_logo, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_align(boot_logo, LV_ALIGN_CENTER, 0, -40);

  greenhouse_boot_status_label = lv_label_create(greenhouse_boot_screen);
  lv_label_set_text(greenhouse_boot_status_label, "Starter skjerm");
  lv_obj_set_width(greenhouse_boot_status_label, 250);
  lv_obj_set_style_text_align(greenhouse_boot_status_label, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_set_style_text_color(greenhouse_boot_status_label, lv_color_hex(GREENHOUSE_MUTED_TEXT), 0);
  lv_obj_set_style_text_font(greenhouse_boot_status_label, &inter_16_new, 0);
  lv_obj_align(greenhouse_boot_status_label, LV_ALIGN_CENTER, 0, 34);

  lv_obj_t *boot_version_label = lv_label_create(greenhouse_boot_screen);
  lv_label_set_text(boot_version_label, GREENHOUSE_APP_VERSION);
  lv_obj_set_width(boot_version_label, 120);
  lv_obj_set_style_text_align(boot_version_label, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_set_style_text_color(boot_version_label, lv_color_hex(0x5F714F), 0);
  lv_obj_set_style_text_font(boot_version_label, &inter_16_new, 0);
  lv_obj_align(boot_version_label, LV_ALIGN_CENTER, 0, 78);
  lv_obj_move_foreground(greenhouse_boot_screen);

  lv_anim_t wifi_alert_anim;
  lv_anim_init(&wifi_alert_anim);
  lv_anim_set_var(&wifi_alert_anim, greenhouse_wifi_alert_segment);
  lv_anim_set_values(&wifi_alert_anim, 0, 360);
  lv_anim_set_time(&wifi_alert_anim, 1800);
  lv_anim_set_repeat_count(&wifi_alert_anim, LV_ANIM_REPEAT_INFINITE);
  lv_anim_set_exec_cb(&wifi_alert_anim, greenhouse_wifi_alert_spin_cb);
  lv_anim_start(&wifi_alert_anim);
  greenhouse_set_wifi_alert_visible(false);

  greenhouse_show_page(0);
  greenhouse_show_settings(false);
}

static lv_obj_t *greenhouse_create_page(lv_obj_t *parent)
{
  lv_obj_t *page = lv_obj_create(parent);
  lv_obj_remove_style_all(page);
  lv_obj_set_size(page, EXAMPLE_LCD_H_RES, EXAMPLE_LCD_V_RES);
  lv_obj_center(page);
  lv_obj_clear_flag(page, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_style_bg_color(page, lv_color_hex(GREENHOUSE_METRIC_BG), 0);
  lv_obj_set_style_bg_opa(page, LV_OPA_COVER, 0);
  lv_obj_set_style_radius(page, 0, 0);
  lv_obj_set_style_pad_all(page, 0, 0);
  lv_obj_set_style_pad_row(page, 0, 0);
  lv_obj_set_flex_flow(page, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_flex_align(page, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
  return page;
}

static lv_obj_t *greenhouse_create_settings_page(lv_obj_t *parent)
{
  lv_obj_t *page = lv_obj_create(parent);
  lv_obj_remove_style_all(page);
  lv_obj_set_size(page, EXAMPLE_LCD_H_RES, EXAMPLE_LCD_V_RES);
  lv_obj_center(page);
  lv_obj_clear_flag(page, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_style_bg_color(page, lv_color_hex(GREENHOUSE_METRIC_BG), 0);
  lv_obj_set_style_bg_opa(page, LV_OPA_COVER, 0);
  lv_obj_set_style_radius(page, 0, 0);
  lv_obj_set_style_pad_all(page, 0, 0);
  lv_obj_add_flag(page, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_clear_flag(page, LV_OBJ_FLAG_GESTURE_BUBBLE);
  return page;
}

static lv_obj_t *greenhouse_create_stats_graph(lv_obj_t *parent, int y, const char *title, uint32_t color, lv_obj_t **line, lv_obj_t **value_label, lv_obj_t **range_label)
{
  lv_obj_t *panel = lv_obj_create(parent);
  lv_obj_remove_style_all(panel);
  lv_obj_clear_flag(panel, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_add_flag(panel, LV_OBJ_FLAG_IGNORE_LAYOUT);
  lv_obj_set_size(panel, 332, 122);
  lv_obj_set_pos(panel, 67, y);
  lv_obj_set_style_bg_color(panel, lv_color_hex(0x25341D), 0);
  lv_obj_set_style_bg_opa(panel, LV_OPA_COVER, 0);
  lv_obj_set_style_radius(panel, 10, 0);
  lv_obj_set_style_border_width(panel, 1, 0);
  lv_obj_set_style_border_color(panel, lv_color_hex(0x4E6240), 0);
  lv_obj_set_style_pad_all(panel, 0, 0);

  lv_obj_t *title_label = lv_label_create(panel);
  lv_label_set_text(title_label, title);
  lv_obj_set_style_text_color(title_label, lv_color_hex(GREENHOUSE_METRIC_TITLE), 0);
  lv_obj_set_style_text_font(title_label, &inter_16_new, 0);
  lv_obj_set_pos(title_label, 18, 12);

  *value_label = lv_label_create(panel);
  lv_label_set_text(*value_label, "--");
  lv_obj_set_width(*value_label, 92);
  lv_obj_set_style_text_align(*value_label, LV_TEXT_ALIGN_RIGHT, 0);
  lv_obj_set_style_text_color(*value_label, lv_color_hex(color), 0);
  lv_obj_set_style_text_font(*value_label, &inter_16_new, 0);
  lv_obj_set_pos(*value_label, 196, 12);

  *line = lv_line_create(panel);
  lv_obj_set_size(*line, 286, 58);
  lv_obj_set_pos(*line, 22, 46);
  lv_obj_set_style_line_width(*line, 3, 0);
  lv_obj_set_style_line_color(*line, lv_color_hex(color), 0);
  lv_obj_set_style_line_rounded(*line, true, 0);

  *range_label = lv_label_create(panel);
  lv_label_set_text(*range_label, "12t --");
  lv_obj_set_width(*range_label, 286);
  lv_obj_set_style_text_align(*range_label, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_set_style_text_color(*range_label, lv_color_hex(GREENHOUSE_MUTED_TEXT), 0);
  lv_obj_set_style_text_font(*range_label, &inter_16_new, 0);
  lv_obj_set_pos(*range_label, 22, 106);
  return panel;
}

static lv_obj_t *greenhouse_create_metric(lv_obj_t *parent, const char *title, lv_obj_t **value_label)
{
  lv_obj_t *metric = lv_obj_create(parent);
  lv_obj_remove_style_all(metric);
  lv_obj_add_flag(metric, LV_OBJ_FLAG_OVERFLOW_VISIBLE);
  lv_obj_clear_flag(metric, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_width(metric, LV_PCT(100));
  lv_obj_set_height(metric, 150);
  lv_obj_set_style_bg_color(metric, lv_color_hex(GREENHOUSE_METRIC_BG), 0);
  lv_obj_set_style_bg_opa(metric, LV_OPA_COVER, 0);
  lv_obj_set_style_radius(metric, 0, 0);
  lv_obj_set_flex_flow(metric, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_flex_align(metric, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);

  lv_obj_t *title_label = lv_label_create(metric);
  lv_label_set_text(title_label, title);
  lv_obj_set_style_text_color(title_label, lv_color_hex(GREENHOUSE_METRIC_TEXT), 0);
  lv_obj_set_style_text_letter_space(title_label, 1, 0);
  lv_obj_set_style_text_font(title_label, &inter_24, 0);

  *value_label = lv_label_create(metric);
  lv_label_set_text(*value_label, "--.-");
  lv_label_set_long_mode(*value_label, LV_LABEL_LONG_CLIP);
  lv_obj_set_width(*value_label, 370);
  lv_obj_set_style_text_align(*value_label, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_set_style_text_color(*value_label, lv_color_hex(GREENHOUSE_METRIC_TEXT), 0);
  lv_obj_set_style_bg_color(*value_label, lv_color_hex(GREENHOUSE_METRIC_BG), 0);
  lv_obj_set_style_bg_opa(*value_label, LV_OPA_TRANSP, 0);
  lv_obj_set_style_radius(*value_label, 0, 0);
  lv_obj_set_style_pad_all(*value_label, 0, 0);
  lv_obj_set_style_text_font(*value_label, &drivhus_digits_80, 0);

  return metric;
}

static lv_obj_t *greenhouse_create_metric_unit(lv_obj_t *parent, const char *title, const char *unit, lv_obj_t **title_label, lv_obj_t **value_label, lv_obj_t **unit_label)
{
  lv_obj_t *metric = lv_obj_create(parent);
  lv_obj_remove_style_all(metric);
  lv_obj_add_flag(metric, LV_OBJ_FLAG_OVERFLOW_VISIBLE);
  lv_obj_clear_flag(metric, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_width(metric, 250);
  lv_obj_set_height(metric, 126);
  lv_obj_set_style_bg_color(metric, lv_color_hex(GREENHOUSE_METRIC_BG), 0);
  lv_obj_set_style_bg_opa(metric, LV_OPA_TRANSP, 0);
  lv_obj_set_style_radius(metric, 0, 0);
  lv_obj_set_style_pad_all(metric, 0, 0);
  lv_obj_set_flex_flow(metric, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_flex_align(metric, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_END, LV_FLEX_ALIGN_END);

  *title_label = lv_label_create(metric);
  lv_label_set_text(*title_label, title);
  lv_obj_set_width(*title_label, 250);
  lv_obj_set_style_text_align(*title_label, LV_TEXT_ALIGN_RIGHT, 0);
  lv_obj_set_style_text_color(*title_label, lv_color_hex(GREENHOUSE_METRIC_LABEL), 0);
  lv_obj_set_style_text_opa(*title_label, GREENHOUSE_METRIC_LABEL_OPA, 0);
  lv_obj_set_style_text_font(*title_label, &inter_24, 0);

  lv_obj_t *value_row = lv_obj_create(metric);
  lv_obj_remove_style_all(value_row);
  lv_obj_clear_flag(value_row, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_width(value_row, 250);
  lv_obj_set_height(value_row, 82);
  lv_obj_set_style_bg_opa(value_row, LV_OPA_TRANSP, 0);
  lv_obj_set_style_pad_all(value_row, 0, 0);
  lv_obj_set_style_pad_column(value_row, 6, 0);
  lv_obj_set_flex_flow(value_row, LV_FLEX_FLOW_ROW);
  lv_obj_set_flex_align(value_row, LV_FLEX_ALIGN_END, LV_FLEX_ALIGN_END, LV_FLEX_ALIGN_END);

  *value_label = lv_label_create(value_row);
  lv_label_set_text(*value_label, "--.-");
  lv_label_set_long_mode(*value_label, LV_LABEL_LONG_CLIP);
  lv_obj_set_width(*value_label, LV_SIZE_CONTENT);
  lv_obj_set_style_text_align(*value_label, LV_TEXT_ALIGN_LEFT, 0);
  lv_obj_set_style_text_color(*value_label, lv_color_hex(GREENHOUSE_METRIC_TEXT), 0);
  lv_obj_set_style_bg_opa(*value_label, LV_OPA_TRANSP, 0);
  lv_obj_set_style_pad_all(*value_label, 0, 0);
  lv_obj_set_style_text_font(*value_label, &inter_96, 0);

  *unit_label = lv_label_create(value_row);
  lv_label_set_text(*unit_label, unit);
  lv_obj_set_style_text_color(*unit_label, lv_color_hex(GREENHOUSE_METRIC_TEXT), 0);
  lv_obj_set_style_text_font(*unit_label, &inter_24, 0);
  lv_obj_set_style_pad_bottom(*unit_label, 0, 0);

  return metric;
}

static void greenhouse_create_status_item(lv_obj_t *parent, int16_t y, const void *icon_src, lv_obj_t **icon_obj, lv_obj_t **label_obj)
{
  lv_obj_t *item = lv_obj_create(parent);
  lv_obj_remove_style_all(item);
  lv_obj_add_flag(item, LV_OBJ_FLAG_IGNORE_LAYOUT);
  lv_obj_clear_flag(item, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_pos(item, 83, y);
  lv_obj_set_size(item, 300, 92);
  lv_obj_set_style_bg_opa(item, LV_OPA_TRANSP, 0);
  lv_obj_set_style_pad_all(item, 0, 0);
  lv_obj_set_flex_flow(item, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_flex_align(item, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);

  *icon_obj = lv_img_create(item);
  lv_img_set_src(*icon_obj, icon_src);
  lv_obj_clear_flag(*icon_obj, LV_OBJ_FLAG_SCROLLABLE);

  *label_obj = lv_label_create(item);
  lv_label_set_text(*label_obj, "--");
  lv_label_set_long_mode(*label_obj, LV_LABEL_LONG_CLIP);
  lv_obj_set_width(*label_obj, 300);
  lv_obj_set_style_text_align(*label_obj, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_set_style_text_color(*label_obj, lv_color_hex(GREENHOUSE_METRIC_TEXT), 0);
  lv_obj_set_style_text_font(*label_obj, &inter_16_new, 0);
  lv_obj_set_style_pad_top(*label_obj, 10, 0);
}

static lv_obj_t *greenhouse_create_status_value(lv_obj_t *parent, const char *title, lv_obj_t **value_label)
{
  lv_obj_t *status = lv_obj_create(parent);
  lv_obj_remove_style_all(status);
  lv_obj_clear_flag(status, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_width(status, LV_PCT(100));
  lv_obj_set_height(status, 96);
  lv_obj_set_style_bg_color(status, lv_color_hex(GREENHOUSE_METRIC_BG), 0);
  lv_obj_set_style_bg_opa(status, LV_OPA_COVER, 0);
  lv_obj_set_style_radius(status, 0, 0);
  lv_obj_set_flex_flow(status, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_flex_align(status, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);

  lv_obj_t *title_label = lv_label_create(status);
  lv_label_set_text(title_label, title);
  lv_obj_set_style_text_color(title_label, lv_color_hex(GREENHOUSE_METRIC_TEXT), 0);
  lv_obj_set_style_text_font(title_label, &inter_16_new, 0);

  *value_label = lv_label_create(status);
  lv_label_set_text(*value_label, "--");
  lv_label_set_long_mode(*value_label, LV_LABEL_LONG_WRAP);
  lv_obj_set_width(*value_label, 320);
  lv_obj_set_style_text_align(*value_label, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_set_style_text_color(*value_label, lv_color_hex(GREENHOUSE_METRIC_TEXT), 0);
  lv_obj_set_style_bg_color(*value_label, lv_color_hex(GREENHOUSE_METRIC_BG), 0);
  lv_obj_set_style_bg_opa(*value_label, LV_OPA_TRANSP, 0);
  lv_obj_set_style_radius(*value_label, 0, 0);
  lv_obj_set_style_pad_all(*value_label, 0, 0);
  lv_obj_set_style_text_font(*value_label, &inter_24, 0);

  return status;
}

static lv_obj_t *greenhouse_create_info_value(lv_obj_t *parent, const char *title, lv_obj_t **value_label)
{
  lv_obj_t *status = lv_obj_create(parent);
  lv_obj_remove_style_all(status);
  lv_obj_clear_flag(status, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_size(status, 150, 44);
  lv_obj_set_style_bg_color(status, lv_color_hex(0x0B1F10), 0);
  lv_obj_set_style_bg_opa(status, LV_OPA_COVER, 0);
  lv_obj_set_style_radius(status, 8, 0);
  lv_obj_set_style_pad_left(status, 8, 0);
  lv_obj_set_style_pad_right(status, 8, 0);
  lv_obj_set_style_pad_top(status, 2, 0);
  lv_obj_set_style_pad_bottom(status, 2, 0);
  lv_obj_set_flex_flow(status, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_flex_align(status, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);

  lv_obj_t *title_label = lv_label_create(status);
  lv_label_set_text(title_label, title);
  lv_obj_set_width(title_label, LV_PCT(100));
  lv_obj_set_style_text_align(title_label, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_set_style_text_color(title_label, lv_color_hex(0x5F714F), 0);
  lv_obj_set_style_text_font(title_label, &inter_16_new, 0);

  *value_label = lv_label_create(status);
  lv_label_set_text(*value_label, "--");
  lv_label_set_long_mode(*value_label, LV_LABEL_LONG_DOT);
  lv_obj_set_width(*value_label, LV_PCT(100));
  lv_obj_set_height(*value_label, 22);
  lv_obj_set_style_text_align(*value_label, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_set_style_text_color(*value_label, lv_color_hex(0xDCE8D4), 0);
  lv_obj_set_style_bg_opa(*value_label, LV_OPA_TRANSP, 0);
  lv_obj_set_style_text_font(*value_label, &inter_16_new, 0);

  return status;
}

static void greenhouse_show_page(uint8_t page_index)
{
  greenhouse_page_index = page_index > 2 ? 0 : page_index;
  if (greenhouse_page_index == 0)
  {
    lv_obj_clear_flag(greenhouse_page_1, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(greenhouse_page_2, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(greenhouse_page_3, LV_OBJ_FLAG_HIDDEN);
  }
  else if (greenhouse_page_index == 1)
  {
    lv_obj_add_flag(greenhouse_page_1, LV_OBJ_FLAG_HIDDEN);
    lv_obj_clear_flag(greenhouse_page_2, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(greenhouse_page_3, LV_OBJ_FLAG_HIDDEN);
  }
  else
  {
    lv_obj_add_flag(greenhouse_page_1, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(greenhouse_page_2, LV_OBJ_FLAG_HIDDEN);
    lv_obj_clear_flag(greenhouse_page_3, LV_OBJ_FLAG_HIDDEN);
    greenhouse_update_stats_page();
  }

  if (greenhouse_page_index == 1)
  {
    if (greenhouse_page_2_return_timer == NULL)
    {
      greenhouse_page_2_return_timer = lv_timer_create(greenhouse_page_2_return_timer_cb, 6000, NULL);
    }
    else
    {
      lv_timer_reset(greenhouse_page_2_return_timer);
      lv_timer_resume(greenhouse_page_2_return_timer);
    }
  }
  else if (greenhouse_page_2_return_timer != NULL)
  {
    lv_timer_pause(greenhouse_page_2_return_timer);
  }

  lv_obj_invalidate(lv_scr_act());
}

static void greenhouse_show_settings(bool show)
{
  if (greenhouse_settings_page == NULL)
  {
    return;
  }

  if (show)
  {
    greenhouse_update_settings_clock();
    lv_obj_clear_flag(greenhouse_settings_page, LV_OBJ_FLAG_HIDDEN);
    lv_obj_move_foreground(greenhouse_settings_page);
    greenhouse_reset_settings_return_timer();
    if (greenhouse_wifi_alert_ring != NULL && !lv_obj_has_flag(greenhouse_wifi_alert_ring, LV_OBJ_FLAG_HIDDEN))
    {
      lv_obj_move_foreground(greenhouse_wifi_alert_ring);
      lv_obj_move_foreground(greenhouse_wifi_alert_segment);
    }
  }
  else
  {
    lv_obj_add_flag(greenhouse_settings_page, LV_OBJ_FLAG_HIDDEN);
    if (greenhouse_settings_return_timer != NULL)
    {
      lv_timer_pause(greenhouse_settings_return_timer);
    }
  }

  lv_obj_invalidate(lv_scr_act());
}

static void greenhouse_wifi_alert_spin_cb(void *obj, int32_t value)
{
  if (obj != NULL)
  {
    lv_arc_set_rotation((lv_obj_t *)obj, value);
  }
}

static void greenhouse_set_wifi_alert_visible(bool visible)
{
  if (greenhouse_wifi_alert_ring == NULL || greenhouse_wifi_alert_segment == NULL)
  {
    return;
  }

  if (visible)
  {
    lv_obj_clear_flag(greenhouse_wifi_alert_ring, LV_OBJ_FLAG_HIDDEN);
    lv_obj_clear_flag(greenhouse_wifi_alert_segment, LV_OBJ_FLAG_HIDDEN);
    lv_obj_move_foreground(greenhouse_wifi_alert_ring);
    lv_obj_move_foreground(greenhouse_wifi_alert_segment);
  }
  else
  {
    lv_obj_add_flag(greenhouse_wifi_alert_ring, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(greenhouse_wifi_alert_segment, LV_OBJ_FLAG_HIDDEN);
  }
}

static void greenhouse_show_refresh_toast(const char *text, uint32_t border_color, bool auto_hide)
{
  if (greenhouse_refresh_toast == NULL || greenhouse_refresh_toast_label == NULL)
  {
    return;
  }

  greenhouse_label_set_text(greenhouse_refresh_toast_label, text);
  lv_obj_set_style_border_color(greenhouse_refresh_toast, lv_color_hex(border_color), 0);
  lv_obj_clear_flag(greenhouse_refresh_toast, LV_OBJ_FLAG_HIDDEN);
  lv_obj_move_foreground(greenhouse_refresh_toast);

  if (greenhouse_refresh_toast_timer != NULL)
  {
    lv_timer_del(greenhouse_refresh_toast_timer);
    greenhouse_refresh_toast_timer = NULL;
  }

  if (auto_hide)
  {
    greenhouse_refresh_toast_timer = lv_timer_create(greenhouse_refresh_toast_timer_cb, 1000, NULL);
  }
  lv_obj_invalidate(lv_scr_act());
}

void greenhouse_show_refresh_result(int success)
{
  if (lvgl_mux == NULL)
  {
    return;
  }

  if (example_lvgl_lock(1000))
  {
    greenhouse_show_refresh_toast(success ? "Oppdatert" : "Feilet",
                                  success ? GREENHOUSE_OK : GREENHOUSE_WARN,
                                  true);
    example_lvgl_unlock();
  }
}

static void greenhouse_refresh_toast_timer_cb(lv_timer_t *timer)
{
  if (greenhouse_refresh_toast != NULL)
  {
    lv_obj_add_flag(greenhouse_refresh_toast, LV_OBJ_FLAG_HIDDEN);
  }

  greenhouse_refresh_toast_timer = NULL;
  lv_obj_invalidate(lv_scr_act());
  if (greenhouse_page_index == 0 && greenhouse_page_1 != NULL)
  {
    lv_obj_invalidate(greenhouse_page_1);
  }
  else if (greenhouse_page_index == 1 && greenhouse_page_2 != NULL)
  {
    lv_obj_invalidate(greenhouse_page_2);
  }
  else if (greenhouse_page_3 != NULL)
  {
    lv_obj_invalidate(greenhouse_page_3);
  }
  lv_timer_del(timer);
}

static void greenhouse_page_2_return_timer_cb(lv_timer_t *timer)
{
  greenhouse_page_2_return_timer = NULL;
  if (greenhouse_page_index == 1)
  {
    greenhouse_show_page(0);
  }
  lv_timer_del(timer);
}

static void greenhouse_settings_return_timer_cb(lv_timer_t *timer)
{
  (void)timer;
  if (greenhouse_settings_page != NULL && !lv_obj_has_flag(greenhouse_settings_page, LV_OBJ_FLAG_HIDDEN))
  {
    greenhouse_show_settings(false);
  }
}

static void greenhouse_auto_brightness_timer_cb(lv_timer_t *timer)
{
  (void)timer;
  greenhouse_update_settings_clock();
  greenhouse_update_auto_brightness();
}

static void greenhouse_add_page_touch_layer(lv_obj_t *page)
{
  lv_obj_t *touch_layer = lv_obj_create(page);
  lv_obj_remove_style_all(touch_layer);
  lv_obj_add_flag(touch_layer, LV_OBJ_FLAG_IGNORE_LAYOUT);
  lv_obj_add_flag(touch_layer, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_clear_flag(touch_layer, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_pos(touch_layer, 0, 0);
  lv_obj_set_size(touch_layer, EXAMPLE_LCD_H_RES, EXAMPLE_LCD_V_RES);
  lv_obj_set_style_bg_opa(touch_layer, LV_OPA_TRANSP, 0);
  lv_obj_add_event_cb(touch_layer, greenhouse_page_event_cb, LV_EVENT_PRESSED, NULL);
  lv_obj_add_event_cb(touch_layer, greenhouse_page_event_cb, LV_EVENT_RELEASED, NULL);
  lv_obj_add_event_cb(touch_layer, greenhouse_page_event_cb, LV_EVENT_PRESS_LOST, NULL);
}

static void greenhouse_page_event_cb(lv_event_t *event)
{
  lv_event_stop_bubbling(event);
  lv_event_code_t code = lv_event_get_code(event);

  if (code == LV_EVENT_PRESSED)
  {
    greenhouse_touch_woke_screen = greenhouse_night_sleep_dimmed;
    greenhouse_note_activity();
    lv_indev_t *indev = lv_indev_get_act();
    if (indev != NULL)
    {
      lv_indev_get_point(indev, &greenhouse_touch_start);
      greenhouse_touch_active = true;
    }
    return;
  }

  if (code != LV_EVENT_RELEASED && code != LV_EVENT_PRESS_LOST)
  {
    return;
  }

  if (!greenhouse_touch_active)
  {
    greenhouse_touch_woke_screen = false;
    return;
  }
  greenhouse_touch_active = false;

  if (greenhouse_touch_woke_screen)
  {
    greenhouse_touch_woke_screen = false;
    return;
  }

  lv_point_t touch_end = greenhouse_touch_start;
  lv_indev_t *indev = lv_indev_get_act();
  if (indev != NULL)
  {
    lv_indev_get_point(indev, &touch_end);
  }

  int32_t dx = touch_end.x - greenhouse_touch_start.x;
  int32_t dy = touch_end.y - greenhouse_touch_start.y;
  int32_t abs_dx = dx < 0 ? -dx : dx;
  int32_t abs_dy = dy < 0 ? -dy : dy;

  if (abs_dy > 48 && abs_dy > abs_dx)
  {
    if (dy < 0)
    {
      greenhouse_set_fetching_labels();
      greenhouse_request_refresh();
      greenhouse_show_refresh_toast("Oppdaterer...", GREENHOUSE_ACCENT, false);
    }
    else
    {
      greenhouse_show_settings(true);
    }
  }
  else if (abs_dx < 42 && abs_dy < 42)
  {
    greenhouse_show_page((greenhouse_page_index + 1) % 3);
  }
}

static void greenhouse_settings_event_cb(lv_event_t *event)
{
  lv_event_code_t code = lv_event_get_code(event);
  greenhouse_mark_activity();
  greenhouse_reset_settings_return_timer();
  lv_event_stop_bubbling(event);
  if (code == LV_EVENT_CLICKED)
  {
    return;
  }

  lv_dir_t dir = lv_indev_get_gesture_dir(lv_indev_get_act());
  if (dir == LV_DIR_TOP || dir == LV_DIR_BOTTOM)
  {
    greenhouse_show_settings(false);
  }
  else if (dir == LV_DIR_LEFT || dir == LV_DIR_RIGHT)
  {
    greenhouse_show_settings(false);
  }
}

static void greenhouse_settings_close_event_cb(lv_event_t *event)
{
  greenhouse_mark_activity();
  lv_event_stop_bubbling(event);
  if (lv_event_get_code(event) == LV_EVENT_CLICKED)
  {
    greenhouse_show_settings(false);
  }
}

static void greenhouse_rotation_lock_event_cb(lv_event_t *event)
{
  greenhouse_mark_activity();
  greenhouse_reset_settings_return_timer();
  lv_event_stop_bubbling(event);
  if (lv_event_get_code(event) == LV_EVENT_CLICKED)
  {
    greenhouse_set_rotation_locked(!greenhouse_read_rotation_locked());
    greenhouse_update_rotation_lock_label();
  }
}

static void greenhouse_brightness_event_cb(lv_event_t *event)
{
  if (greenhouse_setting_brightness_from_code)
  {
    return;
  }

  greenhouse_mark_activity();
  greenhouse_reset_settings_return_timer();
  lv_event_stop_bubbling(event);
  lv_event_code_t code = lv_event_get_code(event);
  int32_t value = lv_slider_get_value(greenhouse_brightness_slider);
  if (value < 8)
  {
    value = 8;
  }
  else if (value > 255)
  {
    value = 255;
  }

  greenhouse_manual_brightness = (uint8_t)value;
  greenhouse_update_brightness_value_label(greenhouse_manual_brightness);

  uint32_t now = lv_tick_get();
  if (code == LV_EVENT_RELEASED || now - greenhouse_last_brightness_tx_ms >= 120)
  {
    greenhouse_set_brightness(greenhouse_manual_brightness);
    greenhouse_last_brightness_tx_ms = now;
  }
}

static esp_err_t greenhouse_panel_tx_param(uint8_t command, const void *param, size_t param_size)
{
  if (greenhouse_panel_io_handle == NULL)
  {
    return ESP_ERR_INVALID_STATE;
  }

  uint32_t lcd_cmd = command;
  lcd_cmd &= 0xff;
  lcd_cmd <<= 8;
  lcd_cmd |= 0x02UL << 24;
  return esp_lcd_panel_io_tx_param(greenhouse_panel_io_handle, lcd_cmd, param, param_size);
}

static void greenhouse_update_brightness_value_label(uint8_t brightness)
{
  if (greenhouse_brightness_value_label != NULL)
  {
    char text[12];
    int percent = (brightness * 100 + 127) / 255;
    snprintf(text, sizeof(text), "%d%%", percent);
    greenhouse_label_set_text(greenhouse_brightness_value_label, text);
  }
}

static void greenhouse_update_settings_clock(void)
{
  if (greenhouse_settings_clock_label == NULL)
  {
    return;
  }

  const char *time_text = greenhouse_read_current_oslo_time_text();
  if (time_text == NULL || time_text[0] == '\0')
  {
    greenhouse_label_set_text(greenhouse_settings_clock_label, "--:--:--");
    lv_obj_set_style_text_color(greenhouse_settings_clock_label, lv_color_hex(GREENHOUSE_MUTED_TEXT), 0);
    return;
  }

  greenhouse_label_set_text(greenhouse_settings_clock_label, time_text);
  lv_obj_set_style_text_color(greenhouse_settings_clock_label,
                              strcmp(time_text, "--:--:--") == 0 ? lv_color_hex(GREENHOUSE_MUTED_TEXT) : lv_color_hex(GREENHOUSE_METRIC_TEXT),
                              0);
}

static void greenhouse_update_rotation_lock_label(void)
{
  bool locked = greenhouse_read_rotation_locked() != 0;
  if (greenhouse_rotation_lock_value_label != NULL)
  {
    greenhouse_label_set_text(greenhouse_rotation_lock_value_label, locked ? "L\xC3\x85ST" : "FRI");
  }
  if (greenhouse_rotation_toggle_knob != NULL)
  {
    lv_obj_set_x(greenhouse_rotation_toggle_knob, locked ? 52 : 0);
  }
  if (greenhouse_rotation_free_label != NULL)
  {
    lv_obj_set_style_text_color(greenhouse_rotation_free_label, locked ? lv_color_hex(GREENHOUSE_MUTED_TEXT) : lv_color_hex(0xF1ECEC), 0);
  }
  if (greenhouse_rotation_locked_label != NULL)
  {
    lv_obj_set_style_text_color(greenhouse_rotation_locked_label, locked ? lv_color_hex(0xF1ECEC) : lv_color_hex(GREENHOUSE_MUTED_TEXT), 0);
  }
}

void greenhouse_set_display_rotation(uint8_t rotation)
{
  if (greenhouse_display == NULL || lvgl_mux == NULL)
  {
    return;
  }

  lv_disp_rot_t lv_rotation = LV_DISP_ROT_270;
  switch (rotation % 4)
  {
    case 0:
      lv_rotation = LV_DISP_ROT_270;
      break;
    case 1:
      lv_rotation = LV_DISP_ROT_NONE;
      break;
    case 2:
      lv_rotation = LV_DISP_ROT_90;
      break;
    case 3:
      lv_rotation = LV_DISP_ROT_180;
      break;
  }

  if (example_lvgl_lock(1000))
  {
    if (lv_disp_get_rotation(greenhouse_display) != lv_rotation)
    {
      lv_disp_set_rotation(greenhouse_display, lv_rotation);
      lv_obj_invalidate(lv_scr_act());
    }
    example_lvgl_unlock();
  }
}

static void greenhouse_brightness_anim_cb(void *var, int32_t value)
{
  (void)var;
  if (value < 0)
  {
    value = 0;
  }
  else if (value > 255)
  {
    value = 255;
  }

  greenhouse_apply_brightness_now((uint8_t)value, false, false);
}

static void greenhouse_apply_brightness_now(uint8_t brightness, bool update_controls, bool log_change)
{
  greenhouse_brightness = brightness;
  if (greenhouse_panel_io_handle != NULL)
  {
    uint8_t panel_brightness = brightness;
    esp_err_t result = greenhouse_panel_tx_param(0x51, &panel_brightness, 1);
    if (result != ESP_OK)
    {
      ESP_LOGW(TAG, "Failed to set brightness with 0x51: %d", result);
    }

    if (READ_LCD_ID == CO5300_ID || READ_LCD_ID != SH8601_ID)
    {
      result = greenhouse_panel_tx_param(0x63, &panel_brightness, 1);
      if (result != ESP_OK)
      {
        ESP_LOGW(TAG, "Failed to set brightness with 0x63: %d", result);
      }
    }
  }
  if (log_change)
  {
    ESP_LOGI(TAG, "Brightness set to %u", brightness);
  }

  if (update_controls && greenhouse_brightness_slider != NULL && lv_slider_get_value(greenhouse_brightness_slider) != brightness)
  {
    greenhouse_setting_brightness_from_code = true;
    lv_slider_set_value(greenhouse_brightness_slider, brightness, LV_ANIM_OFF);
    greenhouse_setting_brightness_from_code = false;
  }
  if (update_controls)
  {
    greenhouse_update_brightness_value_label(brightness);
  }
}

static void greenhouse_apply_brightness(uint8_t brightness, bool update_controls)
{
  lv_anim_del(&greenhouse_brightness_anim_var, greenhouse_brightness_anim_cb);
  greenhouse_apply_brightness_now(brightness, update_controls, true);
}

static void greenhouse_fade_brightness(uint8_t brightness, bool update_controls)
{
  if (greenhouse_brightness == brightness)
  {
    if (update_controls)
    {
      greenhouse_update_brightness_value_label(brightness);
    }
    return;
  }

  if (update_controls && greenhouse_brightness_slider != NULL && lv_slider_get_value(greenhouse_brightness_slider) != brightness)
  {
    greenhouse_setting_brightness_from_code = true;
    lv_slider_set_value(greenhouse_brightness_slider, brightness, LV_ANIM_OFF);
    greenhouse_setting_brightness_from_code = false;
    greenhouse_update_brightness_value_label(brightness);
  }

  lv_anim_del(&greenhouse_brightness_anim_var, greenhouse_brightness_anim_cb);
  lv_anim_t brightness_anim;
  lv_anim_init(&brightness_anim);
  lv_anim_set_var(&brightness_anim, &greenhouse_brightness_anim_var);
  lv_anim_set_exec_cb(&brightness_anim, greenhouse_brightness_anim_cb);
  lv_anim_set_values(&brightness_anim, greenhouse_brightness, brightness);
  lv_anim_set_time(&brightness_anim, GREENHOUSE_BRIGHTNESS_FADE_MS);
  lv_anim_set_path_cb(&brightness_anim, lv_anim_path_ease_in_out);
  lv_anim_start(&brightness_anim);
  ESP_LOGI(TAG, "Brightness fading to %u", brightness);
}

static void greenhouse_set_brightness(uint8_t brightness)
{
  greenhouse_night_sleep_dimmed = false;
  greenhouse_apply_brightness(brightness, true);
}

static void greenhouse_mark_activity(void)
{
  greenhouse_last_activity_ms = lv_tick_get();
}

static void greenhouse_note_activity(void)
{
  greenhouse_mark_activity();
  if (greenhouse_is_current_night() && greenhouse_night_sleep_dimmed)
  {
    greenhouse_night_sleep_dimmed = false;
    greenhouse_fade_brightness(GREENHOUSE_DAY_BRIGHTNESS, false);
  }
}

static void greenhouse_reset_settings_return_timer(void)
{
  if (greenhouse_settings_page == NULL || lv_obj_has_flag(greenhouse_settings_page, LV_OBJ_FLAG_HIDDEN))
  {
    return;
  }

  if (greenhouse_settings_return_timer == NULL)
  {
    greenhouse_settings_return_timer = lv_timer_create(greenhouse_settings_return_timer_cb, 6000, NULL);
  }
  else
  {
    lv_timer_reset(greenhouse_settings_return_timer);
    lv_timer_resume(greenhouse_settings_return_timer);
  }
}

static bool greenhouse_is_night_hour(int hour)
{
  return hour >= 23 || (hour >= 0 && hour < 6);
}

static bool greenhouse_is_current_night(void)
{
  int current_hour = greenhouse_read_current_oslo_hour();
  if (current_hour < 0)
  {
    current_hour = greenhouse_last_oslo_hour;
  }

  if (current_hour < 0)
  {
    return false;
  }

  return greenhouse_is_night_hour(current_hour);
}

static void greenhouse_update_auto_brightness(void)
{
  if (!greenhouse_is_current_night())
  {
    greenhouse_night_sleep_dimmed = false;
    if (greenhouse_brightness != greenhouse_manual_brightness)
    {
      greenhouse_fade_brightness(greenhouse_manual_brightness, false);
    }
    return;
  }

  uint32_t now = lv_tick_get();
  bool idle = greenhouse_last_activity_ms == 0 || now - greenhouse_last_activity_ms >= GREENHOUSE_NIGHT_IDLE_MS;
  if (idle)
  {
    greenhouse_night_sleep_dimmed = true;
    if (greenhouse_brightness != GREENHOUSE_NIGHT_DIM_BRIGHTNESS)
    {
      greenhouse_fade_brightness(GREENHOUSE_NIGHT_DIM_BRIGHTNESS, false);
    }
  }
}

static void greenhouse_set_fetching_labels(void)
{
  if (greenhouse_updated_label_1 != NULL)
  {
    greenhouse_label_set_text(greenhouse_updated_label_1, "HENTER");
    lv_obj_set_style_text_color(greenhouse_updated_label_1, lv_color_hex(GREENHOUSE_ACCENT), 0);
  }
  if (greenhouse_updated_label_2 != NULL)
  {
    greenhouse_label_set_text(greenhouse_updated_label_2, "HENTER");
    lv_obj_set_style_text_color(greenhouse_updated_label_2, lv_color_hex(GREENHOUSE_ACCENT), 0);
  }
}

void greenhouse_set_boot_status(const char *status)
{
  if (status == NULL)
  {
    return;
  }

  if (lvgl_mux == NULL)
  {
    if (greenhouse_boot_status_label != NULL)
    {
      greenhouse_label_set_text(greenhouse_boot_status_label, status);
      lv_obj_set_style_text_opa(greenhouse_boot_status_label, LV_OPA_COVER, 0);
    }
    return;
  }

  if (example_lvgl_lock(1000))
  {
    if (greenhouse_boot_status_label != NULL)
    {
      greenhouse_label_set_text(greenhouse_boot_status_label, status);
      lv_obj_set_style_text_opa(greenhouse_boot_status_label, LV_OPA_COVER, 0);
      if (greenhouse_boot_screen != NULL)
      {
        lv_obj_clear_flag(greenhouse_boot_screen, LV_OBJ_FLAG_HIDDEN);
        lv_obj_move_foreground(greenhouse_boot_screen);
      }
      lv_obj_invalidate(lv_scr_act());
    }
    example_lvgl_unlock();
  }
}

void greenhouse_hide_boot_screen(void)
{
  if (lvgl_mux == NULL)
  {
    if (greenhouse_boot_screen != NULL)
    {
      if (greenhouse_boot_status_label != NULL)
      {
        lv_obj_set_style_text_opa(greenhouse_boot_status_label, LV_OPA_COVER, 0);
      }
      lv_obj_add_flag(greenhouse_boot_screen, LV_OBJ_FLAG_HIDDEN);
    }
    return;
  }

  if (example_lvgl_lock(1000))
  {
    if (greenhouse_boot_screen != NULL)
    {
      if (greenhouse_boot_status_label != NULL)
      {
        lv_obj_set_style_text_opa(greenhouse_boot_status_label, LV_OPA_COVER, 0);
      }
      lv_obj_add_flag(greenhouse_boot_screen, LV_OBJ_FLAG_HIDDEN);
      lv_obj_invalidate(lv_scr_act());
    }
    example_lvgl_unlock();
  }
}

static void greenhouse_label_set_text(lv_obj_t *label, const char *text)
{
  if (label == NULL || text == NULL)
  {
    return;
  }

  const char *current_text = lv_label_get_text(label);
  if (current_text != NULL && strcmp(current_text, text) == 0)
  {
    return;
  }

  lv_obj_t *parent = lv_obj_get_parent(label);
  lv_obj_invalidate(label);
  if (parent != NULL)
  {
    lv_obj_invalidate(parent);
  }

  lv_label_set_text(label, text);

  lv_obj_invalidate(label);
  if (parent != NULL)
  {
    lv_obj_invalidate(parent);
  }
}

static void greenhouse_set_updated_label(lv_obj_t *label, const char *updated_at, int data_age_seconds, int wifi_connected)
{
  if (label == NULL)
  {
    return;
  }

  const char *status = "Oppdatert:";
  lv_color_t status_color = lv_color_hex(GREENHOUSE_OK);
  if (wifi_connected == 0)
  {
    status = "Offline:";
    status_color = lv_color_hex(GREENHOUSE_WARN);
  }
  else if (data_age_seconds < 0)
  {
    status = "Venter:";
    status_color = lv_color_hex(GREENHOUSE_MUTED_TEXT);
  }
  else if (data_age_seconds > 300)
  {
    status = "Gammel:";
    status_color = lv_color_hex(GREENHOUSE_ACCENT);
  }

  if (updated_at == NULL || updated_at[0] == '\0')
  {
    char text[32];
    snprintf(text, sizeof(text), "%s --:--", status);
    greenhouse_label_set_text(label, text);
    lv_obj_set_style_text_color(label, status_color, 0);
    return;
  }

  int hour = 0;
  int minute = 0;
  char text[32];
  if (greenhouse_oslo_time_from_utc(updated_at, &hour, &minute))
  {
    snprintf(text, sizeof(text), "%s %02d:%02d", status, hour, minute);
  }
  else
  {
    snprintf(text, sizeof(text), "%s --:--", status);
  }
  greenhouse_label_set_text(label, text);
  lv_obj_set_style_text_color(label, status_color, 0);
}

static void greenhouse_set_slide_1_data_time(const char *updated_at)
{
  if (greenhouse_data_time_label == NULL)
  {
    return;
  }

  int hour = 0;
  int minute = 0;
  char text[16];
  if (greenhouse_oslo_time_from_utc(updated_at, &hour, &minute))
  {
    snprintf(text, sizeof(text), "%02d:%02d", hour, minute);
  }
  else
  {
    snprintf(text, sizeof(text), "--:--");
  }

  greenhouse_label_set_text(greenhouse_data_time_label, text);
}

static void greenhouse_apply_temperature_theme(float temp_c)
{
  bool is_night = greenhouse_is_current_night() || greenhouse_read_weather_is_night() > 0;
  int is_rain = greenhouse_read_weather_is_rain();

  if (isnan(temp_c))
  {
    greenhouse_set_slide_1_slot_theme("normal", GREENHOUSE_METRIC_BG, GREENHOUSE_METRIC_LABEL, GREENHOUSE_METRIC_LABEL_OPA, GREENHOUSE_METRIC_TEXT, GREENHOUSE_METRIC_TEXT, 0xB3BEA3, GREENHOUSE_METRIC_TITLE, &image_mild);
  }
  else if (is_night && temp_c < 12.0f)
  {
    greenhouse_set_slide_1_slot_theme("coldNight", GREENHOUSE_METRIC_BG, GREENHOUSE_METRIC_LABEL, GREENHOUSE_METRIC_LABEL_OPA, GREENHOUSE_COOL, GREENHOUSE_METRIC_TEXT, 0xB3BEA3, GREENHOUSE_COOL, &image_cold);
  }
  else if (is_night)
  {
    greenhouse_set_slide_1_slot_theme("night", GREENHOUSE_METRIC_BG, GREENHOUSE_METRIC_LABEL, GREENHOUSE_METRIC_LABEL_OPA, 0xD0DEC8, GREENHOUSE_METRIC_TEXT, 0xB3BEA3, GREENHOUSE_METRIC_TITLE, &image_mild);
  }
  else if (is_rain > 0)
  {
    greenhouse_set_slide_1_slot_theme("rain", GREENHOUSE_METRIC_BG, GREENHOUSE_METRIC_LABEL, GREENHOUSE_METRIC_LABEL_OPA, GREENHOUSE_COOL, GREENHOUSE_METRIC_TEXT, 0xB3BEA3, GREENHOUSE_COOL, &image_mild);
  }
  else if (temp_c > 28.0f)
  {
    greenhouse_set_slide_1_slot_theme("hot", GREENHOUSE_METRIC_BG, GREENHOUSE_METRIC_LABEL, GREENHOUSE_METRIC_LABEL_OPA, 0xC44747, GREENHOUSE_METRIC_TEXT, 0xB3BEA3, GREENHOUSE_WARN, &image_hot);
  }
  else if (temp_c >= 23.0f)
  {
    greenhouse_set_slide_1_slot_theme("warm", GREENHOUSE_METRIC_BG, GREENHOUSE_METRIC_LABEL, GREENHOUSE_METRIC_LABEL_OPA, GREENHOUSE_ACCENT, GREENHOUSE_METRIC_TEXT, 0xB3BEA3, GREENHOUSE_ACCENT, &image_warm);
  }
  else if (temp_c < 12.0f)
  {
    greenhouse_set_slide_1_slot_theme("cold", GREENHOUSE_METRIC_BG, GREENHOUSE_METRIC_LABEL, GREENHOUSE_METRIC_LABEL_OPA, GREENHOUSE_COOL, GREENHOUSE_METRIC_TEXT, 0xB3BEA3, GREENHOUSE_COOL, &image_cold);
  }
  else
  {
    greenhouse_set_slide_1_slot_theme("normal", GREENHOUSE_METRIC_BG, GREENHOUSE_METRIC_LABEL, GREENHOUSE_METRIC_LABEL_OPA, 0xD0DEC8, GREENHOUSE_METRIC_TEXT, 0xB3BEA3, GREENHOUSE_METRIC_TITLE, &image_mild);
  }
}

static void greenhouse_set_slide_1_slot_theme(const char *slot, uint32_t bg_color, uint32_t label_color, uint8_t label_opa, uint32_t temp_value_color, uint32_t humidity_value_color, uint32_t unit_color, uint32_t aux_color, const void *image_src)
{
  uint32_t resolved_bg_color = greenhouse_read_theme_bg_color(slot, bg_color);
  uint32_t resolved_label_color = greenhouse_read_theme_label_color(slot, label_color);
  uint8_t resolved_label_opa = greenhouse_read_theme_label_opa(slot, label_opa);
  uint32_t resolved_temp_value_color = greenhouse_read_theme_temperature_value_color(slot, temp_value_color);
  uint32_t resolved_humidity_value_color = greenhouse_read_theme_humidity_value_color(slot, humidity_value_color);
  uint32_t resolved_unit_color = greenhouse_read_theme_unit_color(slot, unit_color);
  uint32_t resolved_aux_color = greenhouse_read_theme_aux_color(slot, aux_color);
  uint32_t resolved_graph_panel_bg = greenhouse_read_theme_graph_panel_bg(slot, 0x25341D);
  uint32_t resolved_graph_panel_border = greenhouse_read_theme_graph_panel_border(slot, 0x4E6240);
  uint32_t resolved_door_icon_color = greenhouse_read_theme_door_icon_color(slot, GREENHOUSE_NO_COLOR_OVERRIDE);
  uint32_t resolved_window_icon_color = greenhouse_read_theme_window_icon_color(slot, GREENHOUSE_NO_COLOR_OVERRIDE);
  uint32_t resolved_fan_icon_color = greenhouse_read_theme_fan_icon_color(slot, GREENHOUSE_NO_COLOR_OVERRIDE);
  const void *resolved_image_src = greenhouse_read_theme_image_src(slot);
  greenhouse_set_slide_1_theme(resolved_bg_color, resolved_label_color, resolved_label_opa, resolved_temp_value_color, resolved_humidity_value_color, resolved_unit_color, resolved_aux_color, resolved_graph_panel_bg, resolved_graph_panel_border, resolved_door_icon_color, resolved_window_icon_color, resolved_fan_icon_color, resolved_image_src != NULL ? resolved_image_src : image_src);
}

static void greenhouse_set_slide_1_theme(uint32_t bg_color, uint32_t label_color, uint8_t label_opa, uint32_t temp_value_color, uint32_t humidity_value_color, uint32_t unit_color, uint32_t aux_color, uint32_t graph_panel_bg, uint32_t graph_panel_border, uint32_t door_icon_color, uint32_t window_icon_color, uint32_t fan_icon_color, const void *image_src)
{
  greenhouse_slide_1_aux_color = aux_color;

  if (greenhouse_page_1 != NULL)
  {
    lv_obj_set_style_bg_color(greenhouse_page_1, lv_color_hex(bg_color), 0);
  }

  if (greenhouse_stats_temp_panel != NULL)
  {
    lv_obj_set_style_bg_color(greenhouse_stats_temp_panel, lv_color_hex(graph_panel_bg), 0);
    lv_obj_set_style_border_color(greenhouse_stats_temp_panel, lv_color_hex(graph_panel_border), 0);
  }
  if (greenhouse_stats_humidity_panel != NULL)
  {
    lv_obj_set_style_bg_color(greenhouse_stats_humidity_panel, lv_color_hex(graph_panel_bg), 0);
    lv_obj_set_style_border_color(greenhouse_stats_humidity_panel, lv_color_hex(graph_panel_border), 0);
  }
  if (greenhouse_door_icon != NULL)
  {
    if (door_icon_color == GREENHOUSE_NO_COLOR_OVERRIDE)
    {
      lv_obj_set_style_img_recolor_opa(greenhouse_door_icon, LV_OPA_TRANSP, 0);
    }
    else
    {
      lv_obj_set_style_img_recolor(greenhouse_door_icon, lv_color_hex(door_icon_color), 0);
      lv_obj_set_style_img_recolor_opa(greenhouse_door_icon, LV_OPA_COVER, 0);
    }
  }
  if (greenhouse_window_icon != NULL)
  {
    if (window_icon_color == GREENHOUSE_NO_COLOR_OVERRIDE)
    {
      lv_obj_set_style_img_recolor_opa(greenhouse_window_icon, LV_OPA_TRANSP, 0);
    }
    else
    {
      lv_obj_set_style_img_recolor(greenhouse_window_icon, lv_color_hex(window_icon_color), 0);
      lv_obj_set_style_img_recolor_opa(greenhouse_window_icon, LV_OPA_COVER, 0);
    }
  }
  if (greenhouse_climate_icon != NULL)
  {
    if (fan_icon_color == GREENHOUSE_NO_COLOR_OVERRIDE)
    {
      lv_obj_set_style_img_recolor_opa(greenhouse_climate_icon, LV_OPA_TRANSP, 0);
    }
    else
    {
      lv_obj_set_style_img_recolor(greenhouse_climate_icon, lv_color_hex(fan_icon_color), 0);
      lv_obj_set_style_img_recolor_opa(greenhouse_climate_icon, LV_OPA_COVER, 0);
    }
  }

  if (greenhouse_temp_title_label != NULL)
  {
    lv_obj_set_style_text_color(greenhouse_temp_title_label, lv_color_hex(label_color), 0);
    lv_obj_set_style_text_opa(greenhouse_temp_title_label, label_opa, 0);
  }
  if (greenhouse_humidity_title_label != NULL)
  {
    lv_obj_set_style_text_color(greenhouse_humidity_title_label, lv_color_hex(label_color), 0);
    lv_obj_set_style_text_opa(greenhouse_humidity_title_label, label_opa, 0);
  }
  if (greenhouse_temp_label != NULL)
  {
    lv_obj_set_style_text_color(greenhouse_temp_label, lv_color_hex(temp_value_color), 0);
  }
  if (greenhouse_humidity_label != NULL)
  {
    lv_obj_set_style_text_color(greenhouse_humidity_label, lv_color_hex(humidity_value_color), 0);
  }
  if (greenhouse_temp_unit_label != NULL)
  {
    lv_obj_set_style_text_color(greenhouse_temp_unit_label, lv_color_hex(unit_color), 0);
  }
  if (greenhouse_humidity_unit_label != NULL)
  {
    lv_obj_set_style_text_color(greenhouse_humidity_unit_label, lv_color_hex(unit_color), 0);
  }
  if (greenhouse_updated_label_1 != NULL)
  {
    lv_obj_set_style_text_color(greenhouse_updated_label_1, lv_color_hex(aux_color), 0);
  }
  if (greenhouse_refresh_icon_label != NULL)
  {
    lv_obj_set_style_text_color(greenhouse_refresh_icon_label, lv_color_hex(aux_color), 0);
  }
  if (greenhouse_data_time_label != NULL)
  {
    lv_obj_set_style_text_color(greenhouse_data_time_label, lv_color_hex(aux_color), 0);
  }
  if (greenhouse_wifi_icon_label != NULL && strcmp(lv_label_get_text(greenhouse_wifi_icon_label), "$") != 0)
  {
    lv_obj_set_style_text_color(greenhouse_wifi_icon_label, lv_color_hex(aux_color), 0);
  }
  if (greenhouse_photo != NULL && image_src != NULL)
  {
    lv_img_cache_invalidate_src(image_src);
    lv_img_set_src(greenhouse_photo, image_src);
  }

  if (greenhouse_page_1 != NULL)
  {
    lv_obj_invalidate(greenhouse_page_1);
  }
}

static void greenhouse_update_stats_graph(const float *values, int count, lv_obj_t *line, lv_point_t *points, lv_obj_t *value_label, lv_obj_t *range_label, const char *unit)
{
  if (line == NULL || points == NULL || value_label == NULL || range_label == NULL)
  {
    return;
  }

  if (values == NULL || count <= 1)
  {
    greenhouse_label_set_text(value_label, "--");
    greenhouse_label_set_text(range_label, "12t: venter på data");
    lv_line_set_points(line, points, 0);
    return;
  }

  if (count > 25)
  {
    count = 25;
  }

  float min_value = values[0];
  float max_value = values[0];
  for (int i = 1; i < count; i++)
  {
    if (values[i] < min_value)
    {
      min_value = values[i];
    }
    if (values[i] > max_value)
    {
      max_value = values[i];
    }
  }

  float span = max_value - min_value;
  if (span < 0.5f)
  {
    span = 0.5f;
    min_value -= 0.25f;
    max_value += 0.25f;
  }

  const int graph_width = 286;
  const int graph_height = 58;
  for (int i = 0; i < count; i++)
  {
    float normalized = (values[i] - min_value) / span;
    if (normalized < 0.0f)
    {
      normalized = 0.0f;
    }
    if (normalized > 1.0f)
    {
      normalized = 1.0f;
    }
    points[i].x = count <= 1 ? 0 : (int16_t)((i * graph_width) / (count - 1));
    points[i].y = (int16_t)(graph_height - (normalized * graph_height));
  }

  lv_line_set_points(line, points, count);

  char value_text[24];
  snprintf(value_text, sizeof(value_text), "%.1f%s", values[count - 1], unit);
  greenhouse_label_set_text(value_label, value_text);

  char range_text[48];
  snprintf(range_text, sizeof(range_text), "min %.1f%s   maks %.1f%s", min_value, unit, max_value, unit);
  greenhouse_label_set_text(range_label, range_text);
}

static void greenhouse_update_stats_page(void)
{
  float temp_values[25];
  float humidity_values[25];
  int temp_count = greenhouse_read_stats_temperature(temp_values, 25);
  int humidity_count = greenhouse_read_stats_humidity(humidity_values, 25);

  greenhouse_update_stats_graph(temp_values, temp_count, greenhouse_stats_temp_line, greenhouse_stats_temp_points, greenhouse_stats_temp_label, greenhouse_stats_temp_range_label, "");
  if (greenhouse_stats_temp_degree_mark != NULL && greenhouse_stats_temp_c_label != NULL)
  {
    if (temp_count > 1)
    {
      lv_obj_clear_flag(greenhouse_stats_temp_degree_mark, LV_OBJ_FLAG_HIDDEN);
      lv_obj_clear_flag(greenhouse_stats_temp_c_label, LV_OBJ_FLAG_HIDDEN);
    }
    else
    {
      lv_obj_add_flag(greenhouse_stats_temp_degree_mark, LV_OBJ_FLAG_HIDDEN);
      lv_obj_add_flag(greenhouse_stats_temp_c_label, LV_OBJ_FLAG_HIDDEN);
    }
  }
  greenhouse_update_stats_graph(humidity_values, humidity_count, greenhouse_stats_humidity_line, greenhouse_stats_humidity_points, greenhouse_stats_humidity_label, greenhouse_stats_humidity_range_label, "%");

  if (greenhouse_page_3 != NULL)
  {
    lv_obj_invalidate(greenhouse_page_3);
  }
}

static void greenhouse_update_dashboard(lv_timer_t *timer)
{
  (void)timer;

  if (greenhouse_temp_label == NULL || greenhouse_humidity_label == NULL)
  {
    return;
  }

  float temp_c = greenhouse_read_temperature_c();
  float humidity = greenhouse_read_humidity_percent();
  int door_is_closed = greenhouse_read_door_closed();
  int fan_on = greenhouse_read_fan_on();
  int heating_on = greenhouse_read_heating_on();
  int windows_open = greenhouse_read_windows_open();
  const char *updated_at = greenhouse_read_updated_at();
  int wifi_connected = greenhouse_read_wifi_connected();
  int wifi_rssi = greenhouse_read_wifi_rssi();
  const char *wifi_ssid = greenhouse_read_wifi_ssid();
  int data_age_seconds = greenhouse_read_data_age_seconds();
  int oslo_hour = 0;
  int oslo_minute = 0;
  if (greenhouse_oslo_time_from_utc(updated_at, &oslo_hour, &oslo_minute))
  {
    greenhouse_last_oslo_hour = oslo_hour;
  }

  greenhouse_set_wifi_alert_visible(wifi_connected == 0);
  greenhouse_apply_temperature_theme(temp_c);
  greenhouse_set_slide_1_data_time(updated_at);
  greenhouse_update_stats_page();
  greenhouse_update_auto_brightness();

  if (greenhouse_wifi_icon_label != NULL)
  {
    if (wifi_connected > 0)
    {
      greenhouse_label_set_text(greenhouse_wifi_icon_label, "#");
      lv_obj_set_style_text_color(greenhouse_wifi_icon_label, lv_color_hex(greenhouse_slide_1_aux_color), 0);
    }
    else
    {
      greenhouse_label_set_text(greenhouse_wifi_icon_label, "$");
      lv_obj_set_style_text_color(greenhouse_wifi_icon_label, lv_color_hex(greenhouse_slide_1_aux_color), 0);
    }
  }

  char text[32];
  if (isnan(temp_c))
  {
    greenhouse_label_set_text(greenhouse_temp_label, "--.-");
  }
  else
  {
    snprintf(text, sizeof(text), "%.1f", temp_c);
    greenhouse_label_set_text(greenhouse_temp_label, text);
  }

  if (isnan(humidity))
  {
    greenhouse_label_set_text(greenhouse_humidity_label, "--.-");
  }
  else
  {
    snprintf(text, sizeof(text), "%.1f", humidity);
    greenhouse_label_set_text(greenhouse_humidity_label, text);
  }

  if (door_is_closed < 0)
  {
    lv_img_set_src(greenhouse_door_icon, &door_closed);
    greenhouse_label_set_text(greenhouse_door_status_label, "D\xC3\x98R UKJENT");
    lv_obj_set_style_text_color(greenhouse_door_status_label, lv_color_hex(GREENHOUSE_MUTED_TEXT), 0);
  }
  else if (door_is_closed)
  {
    lv_img_set_src(greenhouse_door_icon, &door_closed);
    greenhouse_label_set_text(greenhouse_door_status_label, "D\xC3\x98R LUKKET");
    lv_obj_set_style_text_color(greenhouse_door_status_label, lv_color_hex(GREENHOUSE_METRIC_TEXT), 0);
  }
  else
  {
    lv_img_set_src(greenhouse_door_icon, &door_open);
    greenhouse_label_set_text(greenhouse_door_status_label, "D\xC3\x98R \xC3\x85PEN");
    lv_obj_set_style_text_color(greenhouse_door_status_label, lv_color_hex(GREENHOUSE_ACCENT), 0);
  }

  if (windows_open < 0)
  {
    lv_img_set_src(greenhouse_window_icon, &window_closed);
    greenhouse_label_set_text(greenhouse_window_status_label, "VINDUER UKJENT");
    lv_obj_set_style_text_color(greenhouse_window_status_label, lv_color_hex(GREENHOUSE_MUTED_TEXT), 0);
  }
  else if (windows_open <= 0)
  {
    lv_img_set_src(greenhouse_window_icon, &window_closed);
    greenhouse_label_set_text(greenhouse_window_status_label, "VINDUER LUKKET");
    lv_obj_set_style_text_color(greenhouse_window_status_label, lv_color_hex(GREENHOUSE_METRIC_TEXT), 0);
  }
  else
  {
    lv_img_set_src(greenhouse_window_icon, &window_open);
    int shown_windows_open = windows_open > 3 ? 3 : windows_open;
    snprintf(text, sizeof(text), "%d/3 VINDU \xC3\x85PNE", shown_windows_open);
    greenhouse_label_set_text(greenhouse_window_status_label, text);
    lv_obj_set_style_text_color(greenhouse_window_status_label, lv_color_hex(GREENHOUSE_METRIC_TEXT), 0);
  }

  if (heating_on > 0 || fan_on > 0)
  {
    lv_img_set_src(greenhouse_climate_icon, &fan_heating);
    greenhouse_label_set_text(greenhouse_climate_status_label, "VIFTE P\xC3\x85");
    lv_obj_set_style_text_color(greenhouse_climate_status_label, lv_color_hex(GREENHOUSE_METRIC_TEXT), 0);
  }
  else if (heating_on < 0 && fan_on < 0)
  {
    lv_img_set_src(greenhouse_climate_icon, &fan_off);
    greenhouse_label_set_text(greenhouse_climate_status_label, "VIFTE UKJENT");
    lv_obj_set_style_text_color(greenhouse_climate_status_label, lv_color_hex(GREENHOUSE_MUTED_TEXT), 0);
  }
  else
  {
    lv_img_set_src(greenhouse_climate_icon, &fan_off);
    greenhouse_label_set_text(greenhouse_climate_status_label, "VIFTE AV");
    lv_obj_set_style_text_color(greenhouse_climate_status_label, lv_color_hex(GREENHOUSE_METRIC_TEXT), 0);
  }

  greenhouse_set_updated_label(greenhouse_updated_label_2, updated_at, data_age_seconds, wifi_connected);
  greenhouse_set_updated_label(greenhouse_updated_label_settings, updated_at, data_age_seconds, wifi_connected);
  lv_obj_invalidate(greenhouse_page_1);
  lv_obj_invalidate(greenhouse_page_2);
  lv_obj_invalidate(greenhouse_page_3);

  if (wifi_connected > 0)
  {
    greenhouse_label_set_text(greenhouse_wifi_status_label, "TILKOBLET");
    lv_obj_set_style_text_color(greenhouse_wifi_status_label, lv_color_hex(GREENHOUSE_OK), 0);
  }
  else
  {
    greenhouse_label_set_text(greenhouse_wifi_status_label, "IKKE TILKOBLET");
    lv_obj_set_style_text_color(greenhouse_wifi_status_label, lv_color_hex(GREENHOUSE_WARN), 0);
  }

  if (wifi_ssid != NULL && wifi_ssid[0] != '\0')
  {
    greenhouse_label_set_text(greenhouse_wifi_ssid_label, wifi_ssid);
  }
  else
  {
    greenhouse_label_set_text(greenhouse_wifi_ssid_label, "--");
  }

  if (wifi_connected > 0)
  {
    const char *signal_text = "SVAK";
    if (wifi_rssi >= -60)
    {
      signal_text = "STERK";
    }
    else if (wifi_rssi >= -75)
    {
      signal_text = "OK";
    }

    snprintf(text, sizeof(text), "%s %d dB", signal_text, wifi_rssi);
    greenhouse_label_set_text(greenhouse_wifi_rssi_label, text);
    lv_obj_set_style_text_color(greenhouse_wifi_rssi_label, lv_color_hex(GREENHOUSE_METRIC_TEXT), 0);
  }
  else
  {
    greenhouse_label_set_text(greenhouse_wifi_rssi_label, "-- dB");
    lv_obj_set_style_text_color(greenhouse_wifi_rssi_label, lv_color_hex(GREENHOUSE_MUTED_TEXT), 0);
  }
}

static bool greenhouse_oslo_time_from_utc(const char *updated_at, int *hour, int *minute)
{
  int year = 0;
  int month = 0;
  int day = 0;
  int utc_hour = 0;
  int utc_minute = 0;

  if (updated_at == NULL)
  {
    return false;
  }

  if (sscanf(updated_at, "%4d-%2d-%2dT%2d:%2d", &year, &month, &day, &utc_hour, &utc_minute) != 5)
  {
    return false;
  }

  int offset = 1;
  int march_last_sunday = greenhouse_last_sunday(year, 3);
  int october_last_sunday = greenhouse_last_sunday(year, 10);
  bool after_dst_start = month > 3 || (month == 3 && (day > march_last_sunday || (day == march_last_sunday && utc_hour >= 1)));
  bool before_dst_end = month < 10 || (month == 10 && (day < october_last_sunday || (day == october_last_sunday && utc_hour < 1)));
  if (after_dst_start && before_dst_end)
  {
    offset = 2;
  }

  *hour = utc_hour + offset;
  *minute = utc_minute;
  if (*hour >= 24)
  {
    *hour -= 24;
  }
  return true;
}

static int greenhouse_last_sunday(int year, int month)
{
  int day = 31;
  while (greenhouse_day_of_week(year, month, day) != 0)
  {
    day--;
  }
  return day;
}

static int greenhouse_day_of_week(int year, int month, int day)
{
  if (month < 3)
  {
    month += 12;
    year--;
  }
  int k = year % 100;
  int j = year / 100;
  int h = (day + (13 * (month + 1)) / 5 + k + k / 4 + j / 4 + 5 * j) % 7;
  return (h + 6) % 7;
}

static bool example_lvgl_lock(int timeout_ms)
{
  assert(lvgl_mux && "bsp_display_start must be called first");

  const TickType_t timeout_ticks = (timeout_ms == -1) ? portMAX_DELAY : pdMS_TO_TICKS(timeout_ms);
  return xSemaphoreTake(lvgl_mux, timeout_ticks) == pdTRUE;
}

static void example_lvgl_unlock(void)
{
  assert(lvgl_mux && "bsp_display_start must be called first");
  xSemaphoreGive(lvgl_mux);
}
static void example_lvgl_port_task(void *arg)
{
  uint32_t task_delay_ms = EXAMPLE_LVGL_TASK_MAX_DELAY_MS;
  for(;;)
  {
    if (example_lvgl_lock(-1))
    {
      task_delay_ms = lv_timer_handler();
      greenhouse_lvgl_heartbeat_count++;
      greenhouse_lvgl_last_ms = (uint32_t)(esp_timer_get_time() / 1000ULL);
      
      example_lvgl_unlock();
    }
    if (task_delay_ms > EXAMPLE_LVGL_TASK_MAX_DELAY_MS)
    {
      task_delay_ms = EXAMPLE_LVGL_TASK_MAX_DELAY_MS;
    }
    else if (task_delay_ms < EXAMPLE_LVGL_TASK_MIN_DELAY_MS)
    {
      task_delay_ms = EXAMPLE_LVGL_TASK_MIN_DELAY_MS;
    }
    vTaskDelay(pdMS_TO_TICKS(task_delay_ms));
  }
}
static void example_increase_lvgl_tick(void *arg)
{
  lv_tick_inc(EXAMPLE_LVGL_TICK_PERIOD_MS);
}
static bool example_notify_lvgl_flush_ready(esp_lcd_panel_io_handle_t panel_io, esp_lcd_panel_io_event_data_t *edata, void *user_ctx)
{
  lv_disp_drv_t *disp_driver = (lv_disp_drv_t *)user_ctx;
  lv_disp_flush_ready(disp_driver);
  return false;
}
static void example_lvgl_flush_cb(lv_disp_drv_t *drv, const lv_area_t *area, lv_color_t *color_map)
{
  esp_lcd_panel_handle_t panel_handle = (esp_lcd_panel_handle_t) drv->user_data;
  const int offsetx1 = (READ_LCD_ID == SH8601_ID) ? area->x1 : area->x1 + 0x06;
  const int offsetx2 = (READ_LCD_ID == SH8601_ID) ? area->x2 : area->x2 + 0x06;
  const int offsety1 = area->y1;
  const int offsety2 = area->y2;

  esp_lcd_panel_draw_bitmap(panel_handle, offsetx1, offsety1, offsetx2 + 1, offsety2 + 1, color_map);
}
void example_lvgl_rounder_cb(struct _lv_disp_drv_t *disp_drv, lv_area_t *area)
{
  uint16_t x1 = area->x1;
  uint16_t x2 = area->x2;

  uint16_t y1 = area->y1;
  uint16_t y2 = area->y2;

  // round the start of coordinate down to the nearest 2M number
  area->x1 = (x1 >> 1) << 1;
  area->y1 = (y1 >> 1) << 1;
  // round the end of coordinate up to the nearest 2N+1 number
  area->x2 = ((x2 >> 1) << 1) + 1;
  area->y2 = ((y2 >> 1) << 1) + 1;
}
static void example_lvgl_touch_cb(lv_indev_drv_t *drv, lv_indev_data_t *data)
{
  (void)drv;
  uint16_t tp_x,tp_y;
  uint8_t win = getTouch(&tp_x,&tp_y);
  if(win)
  {
    data->point.x = tp_x;
    data->point.y = tp_y;
    data->state = LV_INDEV_STATE_PRESSED;
  }
  else
  {
    data->state = LV_INDEV_STATE_RELEASED;
  }
}
