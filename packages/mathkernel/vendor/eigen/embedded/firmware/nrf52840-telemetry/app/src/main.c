#include <inttypes.h>
#include <zephyr/kernel.h>
#include <zephyr/sys/printk.h>

#ifndef TMNL_TELEMETRY_INTERVAL_US
#define TMNL_TELEMETRY_INTERVAL_US 50
#endif

#ifndef TMNL_DEVICE_NAME
#define TMNL_DEVICE_NAME "nrf52840"
#endif

int main(void)
{
  uint32_t seq = 0;

  while (true) {
    uint64_t now_ms = (uint64_t)k_uptime_get();
    uint32_t value = seq % 1000;

    printk("{\"ts_ms\":%llu,\"seq\":%u,\"device\":\"%s\",\"value\":%u}\n",
           (unsigned long long)now_ms,
           seq,
           TMNL_DEVICE_NAME,
           value);

    seq++;
    k_busy_wait(TMNL_TELEMETRY_INTERVAL_US);
  }

  return 0;
}
