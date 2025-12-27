/**
 * @file main.c
 * @brief Hello World for ESP32-H2 QEMU Emulation
 *
 * Target Hardware: M5NanoH2 (ESP32-H2FH4S)
 *
 * Key Differences from ESP32-S3:
 * - RISC-V 32-bit single-core @ 96MHz (not Xtensa dual-core @ 240MHz)
 * - NO WiFi! Only IEEE 802.15.4 (Zigbee/Thread/Matter) + BLE 5.0
 * - 4MB Flash, 320KB SRAM (no PSRAM)
 * - Different GPIO numbering
 *
 * M5NanoH2 Pin Map:
 * - G3  = IR TX (NEC protocol)
 * - G4  = Blue LED (directly controllable)
 * - G9  = Button (boot strapping pin, active low)
 * - G10 = RGB Power Enable (must be HIGH to power WS2812)
 * - G11 = RGB Data (WS2812B)
 * - G1  = Grove White (I2C SDA / GPIO)
 * - G2  = Grove Yellow (I2C SCL / GPIO)
 *
 * This demo exercises:
 * - UART output (works in QEMU)
 * - Blue LED blink (G4)
 * - Button polling (G9)
 * - RGB LED power sequencing (G10 → G11)
 * - IR TX placeholder (G3)
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
// M5NanoH2 Pin Definitions (ESP32-H2)
// ============================================================================

// IR Transmitter (NEC protocol capable)
#define M5NANO_IR_TX_PIN        GPIO_NUM_3

// Blue LED (directly connected, active high)
#define M5NANO_BLUE_LED_PIN     GPIO_NUM_4

// User Button (boot strapping pin, active low with internal pull-up)
#define M5NANO_BUTTON_PIN       GPIO_NUM_9

// RGB LED (WS2812B) - requires power enable!
#define M5NANO_RGB_POWER_PIN    GPIO_NUM_10  // Must be HIGH to enable RGB
#define M5NANO_RGB_DATA_PIN     GPIO_NUM_11  // WS2812 data line

// Grove Port (directly connected to ESP32-H2)
#define M5NANO_GROVE_WHITE_PIN  GPIO_NUM_1   // I2C SDA or GPIO
#define M5NANO_GROVE_YELLOW_PIN GPIO_NUM_2   // I2C SCL or GPIO

static const char *TAG = "M5NanoH2";

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
    printf("║  ESP32-H2 QEMU Hello World                                       ║\n");
    printf("║  Target: M5NanoH2 (ESP32-H2FH4S)                                 ║\n");
    printf("╠══════════════════════════════════════════════════════════════════╣\n");

    printf("║  Chip: %s (RISC-V) with %d CPU core @ 96MHz\n",
           CONFIG_IDF_TARGET, chip_info.cores);

    // Feature flags — ESP32-H2 has 802.15.4 + BLE, NO WiFi
    printf("║  Features: ");
    if (chip_info.features & CHIP_FEATURE_IEEE802154) {
        printf("IEEE 802.15.4 (Zigbee/Thread/Matter) ");
    }
    if (chip_info.features & CHIP_FEATURE_BLE) {
        printf("BLE 5.0 ");
    }
    // Explicitly note NO WiFi
    if (!(chip_info.features & CHIP_FEATURE_WIFI_BGN)) {
        printf("[NO WiFi]");
    }
    printf("\n");

    printf("║  Revision: %d.%d\n", chip_info.revision / 100, chip_info.revision % 100);

    if (esp_flash_get_size(NULL, &flash_size) == ESP_OK) {
        printf("║  Flash: %luMB %s\n",
               flash_size / (1024 * 1024),
               (chip_info.features & CHIP_FEATURE_EMB_FLASH) ? "embedded" : "external");
    }

    printf("║  Free heap: %lu bytes\n", esp_get_free_heap_size());
    printf("║  IDF version: %s\n", esp_get_idf_version());

    printf("╠══════════════════════════════════════════════════════════════════╣\n");
    printf("║  M5NanoH2 Pinout:                                                 ║\n");
    printf("║    G3  = IR TX          G9  = Button (boot)                      ║\n");
    printf("║    G4  = Blue LED       G10 = RGB Power EN                       ║\n");
    printf("║    G1  = Grove White    G11 = RGB Data (WS2812)                  ║\n");
    printf("║    G2  = Grove Yellow                                             ║\n");
    printf("╚══════════════════════════════════════════════════════════════════╝\n");
    printf("\n");
}

// ============================================================================
// GPIO Initialization
// ============================================================================

static void gpio_init_all(void)
{
    ESP_LOGI(TAG, "Initializing M5NanoH2 GPIO...");

    // ----- Blue LED (G4) - Output -----
    gpio_config_t led_config = {
        .pin_bit_mask = (1ULL << M5NANO_BLUE_LED_PIN),
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    gpio_config(&led_config);
    gpio_set_level(M5NANO_BLUE_LED_PIN, 0);  // Start OFF

    // ----- Button (G9) - Input with pull-up -----
    gpio_config_t btn_config = {
        .pin_bit_mask = (1ULL << M5NANO_BUTTON_PIN),
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = GPIO_PULLUP_ENABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    gpio_config(&btn_config);

    // ----- RGB Power Enable (G10) - Output -----
    gpio_config_t rgb_pwr_config = {
        .pin_bit_mask = (1ULL << M5NANO_RGB_POWER_PIN),
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    gpio_config(&rgb_pwr_config);
    gpio_set_level(M5NANO_RGB_POWER_PIN, 0);  // RGB OFF initially

    // ----- RGB Data (G11) - Output (WS2812 needs RMT driver for real use) -----
    gpio_config_t rgb_data_config = {
        .pin_bit_mask = (1ULL << M5NANO_RGB_DATA_PIN),
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    gpio_config(&rgb_data_config);

    // ----- IR TX (G3) - Output -----
    gpio_config_t ir_config = {
        .pin_bit_mask = (1ULL << M5NANO_IR_TX_PIN),
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    gpio_config(&ir_config);

    ESP_LOGI(TAG, "GPIO configured:");
    ESP_LOGI(TAG, "  Blue LED: G%d", M5NANO_BLUE_LED_PIN);
    ESP_LOGI(TAG, "  Button:   G%d", M5NANO_BUTTON_PIN);
    ESP_LOGI(TAG, "  RGB Pwr:  G%d", M5NANO_RGB_POWER_PIN);
    ESP_LOGI(TAG, "  RGB Data: G%d", M5NANO_RGB_DATA_PIN);
    ESP_LOGI(TAG, "  IR TX:    G%d", M5NANO_IR_TX_PIN);
}

// ============================================================================
// RGB LED Control (WS2812B)
// Note: Real WS2812B requires RMT driver with precise timing.
//       This is a stub for QEMU demonstration.
// ============================================================================

typedef struct {
    uint8_t r;
    uint8_t g;
    uint8_t b;
} rgb_color_t;

static bool rgb_enabled = false;

static void rgb_led_enable(bool enable)
{
    // M5NanoH2 requires G10 HIGH to power the WS2812 LED
    gpio_set_level(M5NANO_RGB_POWER_PIN, enable ? 1 : 0);
    rgb_enabled = enable;

    if (enable) {
        ESP_LOGI(TAG, "RGB LED power ENABLED (G%d=HIGH)", M5NANO_RGB_POWER_PIN);
        // Small delay for power stabilization
        vTaskDelay(pdMS_TO_TICKS(10));
    } else {
        ESP_LOGI(TAG, "RGB LED power DISABLED (G%d=LOW)", M5NANO_RGB_POWER_PIN);
    }
}

static void rgb_led_set(rgb_color_t color)
{
    if (!rgb_enabled) {
        ESP_LOGW(TAG, "RGB LED not enabled! Call rgb_led_enable(true) first.");
        return;
    }

    // In QEMU, we can't actually drive WS2812B timing
    // Just log what we would do
    ESP_LOGI(TAG, "RGB LED: R=%d G=%d B=%d (G%d stub)",
             color.r, color.g, color.b, M5NANO_RGB_DATA_PIN);

    // Toggle data pin as placeholder
    static int data_state = 0;
    data_state = !data_state;
    gpio_set_level(M5NANO_RGB_DATA_PIN, data_state);
}

// ============================================================================
// Blue LED Control
// ============================================================================

static void blue_led_set(bool on)
{
    gpio_set_level(M5NANO_BLUE_LED_PIN, on ? 1 : 0);
}

// ============================================================================
// IR TX Stub
// Note: Real IR requires RMT driver with NEC protocol timing.
// ============================================================================

static void ir_send_nec(uint8_t address, uint8_t command)
{
    // Stub - just log for QEMU
    ESP_LOGI(TAG, "IR TX (G%d): NEC addr=0x%02X cmd=0x%02X (stub)",
             M5NANO_IR_TX_PIN, address, command);

    // Toggle pin as placeholder
    gpio_set_level(M5NANO_IR_TX_PIN, 1);
    vTaskDelay(pdMS_TO_TICKS(1));
    gpio_set_level(M5NANO_IR_TX_PIN, 0);
}

// ============================================================================
// Demo Tasks
// ============================================================================

// Task: Blue LED heartbeat
static void led_heartbeat_task(void *arg)
{
    int tick = 0;
    bool led_on = false;

    while (1) {
        led_on = !led_on;
        blue_led_set(led_on);

        tick++;
        if (tick % 10 == 0) {
            ESP_LOGI(TAG, "Heartbeat tick: %d (Blue LED: %s)",
                     tick, led_on ? "ON" : "OFF");
        }

        vTaskDelay(pdMS_TO_TICKS(500));  // 1Hz blink
    }
}

// Task: RGB LED color cycle
static void rgb_cycle_task(void *arg)
{
    rgb_color_t colors[] = {
        {255, 0, 0},     // Red
        {0, 255, 0},     // Green
        {0, 0, 255},     // Blue
        {255, 255, 0},   // Yellow
        {0, 255, 255},   // Cyan
        {255, 0, 255},   // Magenta
        {255, 255, 255}, // White
    };
    int color_index = 0;

    // Enable RGB power first!
    rgb_led_enable(true);

    while (1) {
        rgb_led_set(colors[color_index]);
        color_index = (color_index + 1) % (sizeof(colors) / sizeof(colors[0]));

        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}

// Task: Button polling
static void button_task(void *arg)
{
    int last_state = 1;  // Pull-up, so default high
    int press_count = 0;

    while (1) {
        int current_state = gpio_get_level(M5NANO_BUTTON_PIN);

        if (current_state != last_state) {
            if (current_state == 0) {
                press_count++;
                ESP_LOGI(TAG, "Button PRESSED (G%d) — count: %d",
                         M5NANO_BUTTON_PIN, press_count);

                // Demo: Send IR command on button press
                ir_send_nec(0x00, press_count & 0xFF);
            } else {
                ESP_LOGI(TAG, "Button RELEASED (G%d)", M5NANO_BUTTON_PIN);
            }
            last_state = current_state;
        }

        vTaskDelay(pdMS_TO_TICKS(50));  // 50ms debounce
    }
}

// Task: UART status output
static void uart_status_task(void *arg)
{
    int counter = 0;

    while (1) {
        printf("[UART] Counter: %d | Heap: %lu bytes | RGB: %s\n",
               counter++,
               esp_get_free_heap_size(),
               rgb_enabled ? "ON" : "OFF");

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

    // Initialize all GPIO
    gpio_init_all();

    ESP_LOGI(TAG, "Starting demo tasks...");

    // Create FreeRTOS tasks
    xTaskCreate(led_heartbeat_task, "led_heartbeat", 2048, NULL, 5, NULL);
    xTaskCreate(rgb_cycle_task, "rgb_cycle", 2048, NULL, 5, NULL);
    xTaskCreate(button_task, "button", 2048, NULL, 5, NULL);
    xTaskCreate(uart_status_task, "uart_status", 2048, NULL, 4, NULL);

    ESP_LOGI(TAG, "All tasks started. Running on ESP32-H2 (RISC-V)...");
    ESP_LOGI(TAG, "Press Ctrl+A then X to exit QEMU");

    // Main task can now idle
    while (1) {
        vTaskDelay(pdMS_TO_TICKS(10000));
    }
}
