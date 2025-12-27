/**
 * @file main.c
 * @brief Hello World for ESP32-S3 QEMU Emulation
 *
 * Target Hardware: M5NanoH2 / M5Stamp-S3 (ESP32-S3FN8)
 *
 * This demo exercises:
 * - UART output (works in QEMU)
 * - GPIO stubs for M5NanoH2 pins
 * - RGB LED (WS2812B) placeholder
 * - Timer/FreeRTOS tasks
 *
 * Note: Some peripherals (WiFi, actual GPIO toggling, WS2812B)
 * won't work in QEMU but the software structure is correct.
 */

#include <stdio.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_system.h"
#include "esp_log.h"
#include "esp_chip_info.h"
#include "esp_flash.h"
#include "driver/gpio.h"

// ============================================================================
// M5NanoH2 / M5Stamp-S3 Pin Definitions
// ============================================================================

// User button (directly accessible on M5Stamp-S3)
#define M5_BUTTON_PIN       GPIO_NUM_0

// RGB LED (WS2812B) - directly connected on both boards
#define M5_RGB_LED_PIN      GPIO_NUM_21  // M5Stamp-S3: G21

// M5NanoH2 additional pins (direct from ESP32-S3FN8)
// Note: M5NanoH2 has limited exposed pins
#define M5_NANO_G1          GPIO_NUM_1
#define M5_NANO_G2          GPIO_NUM_2
#define M5_NANO_G5          GPIO_NUM_5
#define M5_NANO_G6          GPIO_NUM_6
#define M5_NANO_G7          GPIO_NUM_7
#define M5_NANO_G8          GPIO_NUM_8
#define M5_NANO_G9          GPIO_NUM_9
#define M5_NANO_G10         GPIO_NUM_10

// M5Stamp-S3 GPIO ranges (more pins exposed)
// G0-G15, G39-G44, G46

// I2C defaults (typical for M5 devices)
#define M5_I2C_SDA          GPIO_NUM_13
#define M5_I2C_SCL          GPIO_NUM_15

// SPI defaults
#define M5_SPI_MOSI         GPIO_NUM_11
#define M5_SPI_MISO         GPIO_NUM_12
#define M5_SPI_CLK          GPIO_NUM_14

static const char *TAG = "M5NanoH2-QEMU";

// ============================================================================
// System Information
// ============================================================================

static void print_system_info(void)
{
    esp_chip_info_t chip_info;
    uint32_t flash_size;

    esp_chip_info(&chip_info);

    printf("\n");
    printf("╔══════════════════════════════════════════════════════════════════╗\n");
    printf("║  ESP32-S3 QEMU Hello World                                       ║\n");
    printf("║  Target: M5NanoH2 / M5Stamp-S3                                   ║\n");
    printf("╠══════════════════════════════════════════════════════════════════╣\n");

    printf("║  Chip: %s with %d CPU core(s), ", CONFIG_IDF_TARGET, chip_info.cores);

    // Feature flags
    printf("WiFi%s%s%s, ",
           (chip_info.features & CHIP_FEATURE_BT) ? "/BT" : "",
           (chip_info.features & CHIP_FEATURE_BLE) ? "/BLE" : "",
           (chip_info.features & CHIP_FEATURE_IEEE802154) ? "/802.15.4" : "");

    printf("Rev %d.%d\n", chip_info.revision / 100, chip_info.revision % 100);

    if (esp_flash_get_size(NULL, &flash_size) == ESP_OK) {
        printf("║  Flash: %luMB %s\n",
               flash_size / (1024 * 1024),
               (chip_info.features & CHIP_FEATURE_EMB_FLASH) ? "embedded" : "external");
    }

    printf("║  Free heap: %lu bytes\n", esp_get_free_heap_size());
    printf("║  IDF version: %s\n", esp_get_idf_version());
    printf("╚══════════════════════════════════════════════════════════════════╝\n");
    printf("\n");
}

// ============================================================================
// GPIO Stub (for demonstration - limited functionality in QEMU)
// ============================================================================

static void gpio_stub_init(void)
{
    ESP_LOGI(TAG, "Initializing GPIO stubs for M5NanoH2/Stamp-S3...");

    // Configure button pin as input with pull-up
    gpio_config_t btn_config = {
        .pin_bit_mask = (1ULL << M5_BUTTON_PIN),
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = GPIO_PULLUP_ENABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    gpio_config(&btn_config);

    // Configure RGB LED pin as output
    gpio_config_t led_config = {
        .pin_bit_mask = (1ULL << M5_RGB_LED_PIN),
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    gpio_config(&led_config);

    ESP_LOGI(TAG, "GPIO configured: Button=G%d, RGB=G%d",
             M5_BUTTON_PIN, M5_RGB_LED_PIN);
}

// ============================================================================
// RGB LED Stub (WS2812B - needs RMT driver in real hardware)
// ============================================================================

// Placeholder for WS2812B colors
typedef struct {
    uint8_t r;
    uint8_t g;
    uint8_t b;
} rgb_color_t;

static void rgb_led_set(rgb_color_t color)
{
    // In QEMU, we can't actually drive WS2812B
    // Just log what we would do
    ESP_LOGI(TAG, "RGB LED: R=%d G=%d B=%d (stub)", color.r, color.g, color.b);

    // Toggle the GPIO for demonstration
    static int led_state = 0;
    led_state = !led_state;
    gpio_set_level(M5_RGB_LED_PIN, led_state);
}

// ============================================================================
// Demo Tasks
// ============================================================================

// Task: Heartbeat LED blink
static void heartbeat_task(void *arg)
{
    rgb_color_t colors[] = {
        {255, 0, 0},     // Red
        {0, 255, 0},     // Green
        {0, 0, 255},     // Blue
        {255, 255, 0},   // Yellow
        {0, 255, 255},   // Cyan
        {255, 0, 255},   // Magenta
    };
    int color_index = 0;
    int tick = 0;

    while (1) {
        rgb_led_set(colors[color_index]);
        color_index = (color_index + 1) % (sizeof(colors) / sizeof(colors[0]));

        tick++;
        if (tick % 5 == 0) {
            ESP_LOGI(TAG, "Heartbeat tick: %d", tick);
        }

        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}

// Task: Button polling (demonstrates GPIO input)
static void button_task(void *arg)
{
    int last_state = 1;  // Pull-up, so default high

    while (1) {
        int current_state = gpio_get_level(M5_BUTTON_PIN);

        if (current_state != last_state) {
            if (current_state == 0) {
                ESP_LOGI(TAG, "Button PRESSED (G%d)", M5_BUTTON_PIN);
            } else {
                ESP_LOGI(TAG, "Button RELEASED (G%d)", M5_BUTTON_PIN);
            }
            last_state = current_state;
        }

        vTaskDelay(pdMS_TO_TICKS(50));  // 50ms debounce
    }
}

// Task: UART echo demo
static void uart_demo_task(void *arg)
{
    int counter = 0;

    while (1) {
        printf("[UART Demo] Counter: %d | Heap: %lu bytes\n",
               counter++, esp_get_free_heap_size());

        vTaskDelay(pdMS_TO_TICKS(5000));
    }
}

// ============================================================================
// Main Entry Point
// ============================================================================

void app_main(void)
{
    // Print system information
    print_system_info();

    // Initialize GPIO stubs
    gpio_stub_init();

    ESP_LOGI(TAG, "Starting demo tasks...");

    // Create FreeRTOS tasks
    xTaskCreate(heartbeat_task, "heartbeat", 2048, NULL, 5, NULL);
    xTaskCreate(button_task, "button", 2048, NULL, 5, NULL);
    xTaskCreate(uart_demo_task, "uart_demo", 2048, NULL, 5, NULL);

    ESP_LOGI(TAG, "All tasks started. Running in QEMU...");
    ESP_LOGI(TAG, "Press Ctrl+A then X to exit QEMU");

    // Main task can now idle or do other work
    while (1) {
        vTaskDelay(pdMS_TO_TICKS(10000));
    }
}
