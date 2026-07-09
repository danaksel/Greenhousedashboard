#ifndef FT3168_H
#define FT3168_H
#include "driver/i2c.h"
#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif 

void Touch_Init(void);

uint8_t getTouch(uint16_t *x,uint16_t *y);
uint32_t touch_get_read_count(void);
uint32_t touch_get_press_count(void);
uint32_t touch_get_error_count(void);
esp_err_t touch_get_last_error(void);
#ifdef __cplusplus
}
#endif
#endif
