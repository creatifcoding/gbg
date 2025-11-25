## **SELFCHARTERS TERMINAL - i.MX 8M PLUS AMP ARCHITECTURE**

### **SYSTEM ARCHITECTURE OVERVIEW**

```
┌─────────────────────────────────────────────────────────────┐
│                    LINUX DOMAIN (A53)                       │
│  NixOS + Yocto BSP → Qt6/Wayland UI → Application Logic    │
│                           ↕                                  │
│              [RPMsg/Mailbox/Shared Memory]                  │
│                           ↕                                  │
│                   RTOS DOMAIN (M7)                          │
│  Zephyr RTOS → Module Manager → USB-C PD Protocol          │
│  ├─ Hotplug Detection (GPIO interrupts)                    │
│  ├─ Block Enumeration (USB VID/PID)                        │
│  ├─ Power Management (I2C to BMS/STUSB4500)                │
│  └─ Real-time Communication (CAN-FD/SPI to Blocks)         │
└─────────────────────────────────────────────────────────────┘
```

**Why This Architecture is Brilliant:**

- **A53 Cores**: High-level OS, UI rendering, application logic, networking
- **M7 Core**: Hard real-time module interfacing, power negotiation, hotplug events
- **Separation of Concerns**: Linux doesn't handle timing-critical module detection
- **Fault Isolation**: M7 crash doesn't kill Linux; Linux crash doesn't break module management

---

## **1. i.MX 8M PLUS HARDWARE SPECIFICATION**

### **Core SoC Details:**

|Feature|Specification|Your Use Case|
|---|---|---|
|**Application Cores**|4x Cortex-A53 @ 1.8GHz|NixOS/Yocto Linux, UI, apps|
|**Real-Time Core**|1x Cortex-M7 @ 800MHz|Zephyr RTOS, module manager|
|**NPU**|2.3 TOPS (Vivante VIPNano-SI)|ML inference for vision/sensors|
|**GPU**|Vivante GC7000UL (OpenGL ES 3.1)|Wayland compositing|
|**Video**|1080p60 H.265/H.264 encode, 4K decode|Optional video Block modules|
|**ISP**|Dual ISP, 2x MIPI-CSI (12MP each)|Camera Blocks for vision|
|**Memory**|Up to 6GB LPDDR4-3200|Recommend 4GB for your use|
|**Display**|MIPI-DSI (4-lane), LVDS (dual), HDMI 2.0a|Scale from 7" to 32"|

### **Recommended SoM Selection for Your Design:**

|SoM|Cost|RAM|eMMC|Wireless|Justification|
|---|---|---|---|---|---|
|**Toradex Verdin iMX8M Plus**|$150-180|4GB|32GB|WiFi 6|Best Zephyr support, excellent docs, Torizon ecosystem|
|**Variscite VAR-SOM-MX8M-PLUS**|$120-160|4GB|32GB|WiFi 6/BT 5.4|Pin2Pin family, industrial temp, strong Linux BSP|
|**SolidRun HummingBoard Pulse SoM**|$89-145|2-4GB|16-32GB|Optional|Open-source schematics, community support|

**RECOMMENDATION**: **Toradex Verdin iMX8M Plus** - they have _excellent_ AMP documentation, pre-built Zephyr examples for M7, and Torizon OS already integrates NixOS-like principles (containers, OTA updates).

---

## **2. CORTEX-M7 ZEPHYR RTOS ARCHITECTURE**

### **Zephyr on M7 - Module Manager Firmware**

**Purpose**: Real-time module detection, power management, and communication bridge to A53 Linux.

**M7 Resource Allocation:**

```
Cortex-M7 @ 800MHz:
├─ 512KB TCM (Tightly-Coupled Memory) - critical code
├─ Shared DRAM (4MB reserved from Linux) - DMA buffers
├─ Peripherals under M7 control:
│   ├─ GPIO (module hotplug interrupts)
│   ├─ I2C2/I2C3 (STUSB4500 PD controllers, BMS)
│   ├─ SPI3 (fast module comms)
│   ├─ CAN2 (industrial Block protocols)
│   ├─ UART4 (debug console for M7)
│   └─ Mailbox/MU (Messaging Unit to A53)
```

### **Zephyr Module Manager Responsibilities:**

1. **Hotplug Detection**
    
    - GPIO interrupt on magnetic pogo connection
    - Debounce logic (20ms)
    - Signal A53 via RPMsg
2. **USB-C PD Negotiation**
    
    - I2C control of STUSB4500 on each edge
    - Request 20V/5A (100W) profiles
    - Monitor voltage/current telemetry
3. **Block Enumeration**
    
    - Read USB VID/PID from connected Block
    - Load Block descriptor (capabilities, power req)
    - Send Block metadata to A53 over RPMsg
4. **Power Management**
    
    - Monitor per-edge power draw (I2C ADC)
    - Implement load shedding (shut off non-critical Blocks)
    - Battery state-of-charge (I2C to BMS)
    - Coordinate sleep/wake with A53
5. **Communication Bridge**
    
    - Fast path: SPI3 for bulk data (sensors, etc)
    - Slow path: I2C for config/telemetry
    - Bridge to A53 via shared memory + RPMsg

---

## **3. INTER-PROCESSOR COMMUNICATION (M7 ↔ A53)**

### **NXP's AMP Communication Stack:**

**Primary Mechanism: RPMsg (Remote Processor Messaging)**

- Built on top of VirtIO
- Message passing between A53 Linux and M7 Zephyr
- Zephyr has `rpmsg` subsystem
- Linux has `rpmsg_char` driver

**Architecture:**

```
┌──────────────────────────────────────────────────────┐
│                  A53 Linux Side                      │
│  /dev/rpmsg_ctrl0 → rpmsg_char driver               │
│         ↓                                            │
│  VirtIO Ring Buffers (in shared DRAM)               │
│         ↓                                            │
│  Messaging Unit (MU) hardware mailbox                │
└──────────────────────────────────────────────────────┘
                       ↕
┌──────────────────────────────────────────────────────┐
│                  M7 Zephyr Side                      │
│  OpenAMP library → rpmsg endpoint                    │
│         ↓                                            │
│  VirtIO Ring Buffers (same shared DRAM)             │
│         ↓                                            │
│  Messaging Unit (MU) hardware mailbox                │
└──────────────────────────────────────────────────────┘
```

### **Message Protocol Design:**

**Block Lifecycle Messages (M7 → A53):**

```c
// Zephyr M7 sends to Linux A53
enum block_event {
    BLOCK_INSERTED,    // Magnetic connection detected
    BLOCK_REMOVED,     // Disconnection detected
    BLOCK_ENUMERATED,  // VID/PID read, descriptor available
    BLOCK_FAULT,       // Overcurrent, thermal, etc.
};

struct block_msg {
    uint8_t edge;           // 0=top, 1=right, 2=bottom, 3=left
    enum block_event event;
    uint16_t vid, pid;      // USB vendor/product ID
    uint32_t capabilities;  // Bitmask of Block features
    uint16_t power_mw;      // Power draw in milliwatts
} __attribute__((packed));
```

**Control Messages (A53 → M7):**

```c
// Linux A53 sends to Zephyr M7
enum block_cmd {
    BLOCK_ENABLE,      // Power on Block
    BLOCK_DISABLE,     // Power off Block
    BLOCK_QUERY,       // Request telemetry
    BLOCK_CONFIGURE,   // Set I2C/SPI parameters
};

struct block_control {
    uint8_t edge;
    enum block_cmd cmd;
    uint32_t param;        // Command-specific parameter
} __attribute__((packed));
```

### **Shared Memory Layout:**

```
DRAM Reserved for M7 AMP: 4MB @ 0x8FF00000
├─ 0x8FF00000: M7 code/data (2MB)
├─ 0x90100000: VirtIO ring buffers (256KB)
├─ 0x90140000: Block DMA buffers (1MB)
└─ 0x90240000: Telemetry ringbuffer (768KB)
```

---

## **4. NIXOS + YOCTO INTEGRATION STRATEGY**

### **Why NixOS + Yocto?**

**Yocto's Role:**

- Hardware-specific BSP layer (NXP provides `meta-freescale`)
- Kernel config with i.MX 8M Plus device trees
- U-Boot bootloader with M7 co-processor loading
- Low-level firmware blobs (DDR training, Cortex-M7 firmware)

**NixOS's Role:**

- Declarative userspace configuration
- Reproducible application layer
- Atomic OTA updates with rollback
- System configuration as code

### **Integration Architecture:**

```
Yocto (meta-freescale) → Builds:
  ├─ Linux Kernel 6.1 LTS (NXP patches)
  ├─ U-Boot 2024.01 (M7 firmware loader)
  ├─ Device Tree Blobs (DTBs)
  ├─ Root filesystem (minimal busybox)
  └─ Firmware blobs (lpddr4_pmu_train, cortex-m7.elf)

NixOS → Overlays Yocto artifacts:
  ├─ Import Kernel/U-Boot from Yocto build
  ├─ NixOS stage-1 init (initrd)
  ├─ NixOS stage-2 (systemd, full userspace)
  ├─ Qt6 + Wayland compositor
  └─ Custom services (module-manager.service)
```

### **Practical Implementation:**

**Step 1: Yocto BSP Build (generates kernel + bootloader)**

```bash
# Clone NXP BSP
git clone https://github.com/nxp-imx/imx-manifest.git
cd imx-manifest
repo init -u https://github.com/nxp-imx/imx-manifest -b imx-linux-mickledore -m imx-6.1.55-2.2.0.xml
repo sync

# Build for i.MX 8M Plus
DISTRO=fsl-imx-wayland MACHINE=imx8mpevk source setup-environment build
bitbake imx-image-core

# Outputs:
# tmp/deploy/images/imx8mpevk/Image (kernel)
# tmp/deploy/images/imx8mpevk/u-boot.bin
# tmp/deploy/images/imx8mpevk/imx8mp-evk.dtb
```

**Step 2: NixOS Flake for i.MX 8M Plus**

```nix
# flake.nix
{
  description = "Selfcharters Terminal NixOS for i.MX 8M Plus";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    nixos-hardware.url = "github:NixOS/nixos-hardware";
  };

  outputs = { self, nixpkgs, ... }: {
    nixosConfigurations.selfcharters-terminal = nixpkgs.lib.nixosSystem {
      system = "aarch64-linux";
      modules = [
        ./hardware-configuration.nix
        ./terminal-configuration.nix
        {
          # Import Yocto-built kernel
          boot.kernelPackages = pkgs.linuxPackagesFor (pkgs.callPackage ./yocto-kernel.nix {});
          
          # M7 firmware loading
          systemd.services.cortex-m7-loader = {
            description = "Load Zephyr firmware to Cortex-M7";
            wantedBy = [ "multi-user.target" ];
            script = ''
              echo /lib/firmware/imx8mp_m7_TCM_selfcharters.elf > /sys/class/remoteproc/remoteproc0/firmware
              echo start > /sys/class/remoteproc/remoteproc0/state
            '';
          };

          # RPMsg character device
          boot.kernelModules = [ "imx_rpmsg_tty" "rpmsg_char" ];
        }
      ];
    };
  };
}
```

**Step 3: Yocto Kernel Derivation for NixOS**

```nix
# yocto-kernel.nix
{ stdenv, lib, fetchurl, ... }:

stdenv.mkDerivation {
  pname = "linux-imx8mp";
  version = "6.1.55-nxp";
  
  # Copy from Yocto build output
  src = /path/to/yocto/tmp/deploy/images/imx8mpevk;
  
  installPhase = ''
    mkdir -p $out
    cp Image $out/Image
    cp imx8mp-*.dtb $out/
  '';
  
  meta = {
    description = "NXP i.MX 8M Plus kernel from Yocto";
    platforms = [ "aarch64-linux" ];
  };
}
```

---

## **5. ZEPHYR RTOS FIRMWARE FOR M7**

### **Zephyr Project Structure:**

```
selfcharters-m7-firmware/
├── CMakeLists.txt
├── prj.conf                    # Zephyr Kconfig
├── boards/
│   └── imx8mp_verdin_m7.overlay  # Device tree overlay
├── src/
│   ├── main.c                  # M7 entry point
│   ├── module_manager.c        # Core module logic
│   ├── rpmsg_bridge.c          # Communication with A53
│   ├── usb_pd.c                # STUSB4500 driver
│   └── power_mgmt.c            # BMS interface
└── dts/
    └── bindings/               # Custom device bindings
```

### **Zephyr Configuration (prj.conf):**

```ini
# Core Zephyr features
CONFIG_CPLUSPLUS=n
CONFIG_NEWLIB_LIBC=y
CONFIG_HEAP_MEM_POOL_SIZE=16384

# OpenAMP/RPMsg for A53 communication
CONFIG_OPENAMP=y
CONFIG_OPENAMP_RSC_TABLE=y
CONFIG_IPM=y
CONFIG_IPM_IMX=y
CONFIG_RPMSG_SERVICE=y

# I2C for USB-C PD controllers
CONFIG_I2C=y
CONFIG_I2C_IMX=y

# GPIO for hotplug detection
CONFIG_GPIO=y
CONFIG_GPIO_IMX=y

# SPI for Block communication
CONFIG_SPI=y
CONFIG_SPI_IMX=y

# Logging
CONFIG_LOG=y
CONFIG_LOG_DEFAULT_LEVEL=3
CONFIG_UART_CONSOLE=y
CONFIG_CONSOLE=y
```

### **M7 Main Loop (Simplified):**

```c
// src/main.c
#include <zephyr/kernel.h>
#include <zephyr/drivers/gpio.h>
#include <zephyr/ipc/rpmsg_service.h>

#define EDGE_TOP    0
#define EDGE_RIGHT  1
#define EDGE_BOTTOM 2
#define EDGE_LEFT   3

/* GPIO pins for hotplug detection (one per edge) */
static const struct gpio_dt_spec hotplug_gpios[4] = {
    GPIO_DT_SPEC_GET_BY_IDX(DT_NODELABEL(edge_detect), gpios, 0),
    GPIO_DT_SPEC_GET_BY_IDX(DT_NODELABEL(edge_detect), gpios, 1),
    GPIO_DT_SPEC_GET_BY_IDX(DT_NODELABEL(edge_detect), gpios, 2),
    GPIO_DT_SPEC_GET_BY_IDX(DT_NODELABEL(edge_detect), gpios, 3),
};

/* RPMsg endpoint to A53 */
static struct rpmsg_endpoint module_ep;

void hotplug_callback(const struct device *dev, struct gpio_callback *cb, uint32_t pins)
{
    /* Determine which edge triggered */
    for (int edge = 0; edge < 4; edge++) {
        if (pins & BIT(hotplug_gpios[edge].pin)) {
            /* Block inserted on this edge */
            printk("M7: Block detected on edge %d\n", edge);
            
            /* Send message to A53 */
            struct block_msg msg = {
                .edge = edge,
                .event = BLOCK_INSERTED,
            };
            rpmsg_send(&module_ep, &msg, sizeof(msg));
            
            /* Start enumeration in separate thread */
            k_work_submit(&enumerate_work[edge]);
        }
    }
}

void enumerate_block(int edge)
{
    /* Read USB VID/PID via I2C from Block's descriptor chip */
    uint16_t vid, pid;
    i2c_read_vid_pid(edge, &vid, &pid);
    
    /* Send enumeration complete to A53 */
    struct block_msg msg = {
        .edge = edge,
        .event = BLOCK_ENUMERATED,
        .vid = vid,
        .pid = pid,
    };
    rpmsg_send(&module_ep, &msg, sizeof(msg));
}

int main(void)
{
    printk("M7 Module Manager starting...\n");
    
    /* Initialize GPIOs for hotplug detection */
    for (int i = 0; i < 4; i++) {
        gpio_pin_configure_dt(&hotplug_gpios[i], GPIO_INPUT);
        gpio_pin_interrupt_configure_dt(&hotplug_gpios[i], GPIO_INT_EDGE_BOTH);
    }
    
    /* Setup GPIO callbacks */
    static struct gpio_callback hotplug_cb;
    gpio_init_callback(&hotplug_cb, hotplug_callback, 
                       BIT(hotplug_gpios[0].pin) | BIT(hotplug_gpios[1].pin) |
                       BIT(hotplug_gpios[2].pin) | BIT(hotplug_gpios[3].pin));
    
    for (int i = 0; i < 4; i++) {
        gpio_add_callback(hotplug_gpios[i].port, &hotplug_cb);
    }
    
    /* Initialize RPMsg to A53 */
    rpmsg_service_register_endpoint("selfcharters-module", &module_ep);
    
    /* Main loop: power management, telemetry */
    while (1) {
        monitor_power_draw();
        update_battery_soc();
        k_sleep(K_MSEC(100));
    }
    
    return 0;
}
```

---

## **6. MODULE DETECTION PROTOCOL**

### **Physical Layer (Magnetic Pogo):**

**8-Pin Configuration per Edge:**

```
Pin 1: VBUS (20V from PD negotiation)
Pin 2: GND
Pin 3: USB D+ (differential pair)
Pin 4: USB D- (differential pair)
Pin 5: I2C SDA (Block config/telemetry)
Pin 6: I2C SCL
Pin 7: DETECT (GPIO to M7, pulled high when Block present)
Pin 8: AUX_POWER (5V for Block controller)
```

### **Enumeration Sequence:**

1. **Magnetic Connection** → DETECT pin goes HIGH → M7 GPIO interrupt
2. **M7 Debounce** (20ms) → Confirm stable connection
3. **Power Negotiation** → M7 configures STUSB4500 via I2C, requests 20V/5A
4. **Block Descriptor Read** → M7 reads I2C EEPROM on Block at address 0x50:
    
    ```c
    struct block_descriptor {    uint16_t vid;             // USB Vendor ID    uint16_t pid;             // USB Product ID    uint8_t  block_type;      // BATTERY, SOLAR, IO_EXPANDER, etc.    uint16_t max_power_mw;    // Maximum power draw    uint8_t  features[8];     // Capability bitmask    char     name[32];        // Human-readable name} __packed;
    ```
    
5. **Send to A53** → M7 sends `BLOCK_ENUMERATED` message via RPMsg
6. **A53 Action** → Linux module-manager daemon receives message, loads driver

### **Linux Userspace Daemon (A53):**

```python
# module-manager.py (systemd service on NixOS)
import os
import struct
from pathlib import Path

RPMSG_DEV = "/dev/rpmsg_ctrl0"

class BlockManager:
    def __init__(self):
        self.blocks = {0: None, 1: None, 2: None, 3: None}  # 4 edges
        
    def handle_message(self, msg):
        edge, event, vid, pid, caps, power = struct.unpack("<BBHHIH", msg)
        
        if event == BLOCK_INSERTED:
            print(f"Block inserted on edge {edge}")
        elif event == BLOCK_ENUMERATED:
            print(f"Block enumerated: VID={vid:04x} PID={pid:04x} Power={power}mW")
            self.load_driver(edge, vid, pid)
        elif event == BLOCK_REMOVED:
            print(f"Block removed from edge {edge}")
            self.unload_driver(edge)
            
    def load_driver(self, edge, vid, pid):
        # Example: Battery Block with VID=0xBEEF, PID=0x0001
        if vid == 0xBEEF and pid == 0x0001:
            os.system("modprobe selfcharters_battery")
            # Notify UI via D-Bus
            
    def run(self):
        with open(RPMSG_DEV, 'rb') as rpmsg:
            while True:
                msg = rpmsg.read(64)
                if msg:
                    self.handle_message(msg)

if __name__ == "__main__":
    manager = BlockManager()
    manager.run()
```

---

## **7. UPDATED BOM FOR i.MX 8M PLUS SYSTEM**

|Component|Part/Vendor|Cost|Notes|
|---|---|---|---|
|**SoM**|Toradex Verdin iMX8M Plus (4GB/32GB)|$165|Quad A53 + M7, WiFi 6|
|**Carrier Board**|Custom (4-layer PCB)|$45|Pogo connectors, USB-C PD, I2C routing|
|**Display**|10.1" Riverdi MIPI DSI 1280x800|$160|Industrial, P-Cap touch|
|**USB-C PD ICs**|4x STUSB4500|$20|One per edge, I2C to M7|
|**Pogo Connectors**|4x 8-pin magnetic pairs|$30|Adafruit-style for prototype|
|**Battery**|4S2P 21700 cells + BQ76940 BMS|$55|148Wh, I2C to M7|
|**Power Management**|TI BQ25703A (100W USB-C PD charger)|$8|Buck-boost, solar MPPT|
|**Enclosure**|CNC aluminum + plastic back|$95|Prototype via Xometry|
|**Misc**|Cables, magnets, fasteners|$25|-|
|**Assembly**|PCB fab + pick-and-place|$80|JLCPCB or similar|
|**TOTAL**||**$683**|Prototype cost|

**Volume Optimizations (100+ units):**

- SoM: Negotiate to $140
- Display: MOQ discount to $135
- Injection-molded enclosure: $45
- **Volume Target: $515-550**

---

## **8. DEVELOPMENT ROADMAP**

### **Phase 1: Hardware Bring-Up (Weeks 1-4)**

- [ ] Order Toradex Verdin iMX8M Plus + Dahlia carrier board
- [ ] Order Riverdi 10.1" MIPI DSI display
- [ ] Boot Toradex BSP Linux (Torizon OS)
- [ ] Validate MIPI DSI connection to display
- [ ] Test Cortex-M7 with Toradex's Zephyr examples

### **Phase 2: M7 Firmware (Weeks 5-8)**

- [ ] Port Zephyr to your custom board (device tree overlay)
- [ ] Implement GPIO hotplug detection
- [ ] Implement I2C driver for STUSB4500
- [ ] Test RPMsg communication to A53
- [ ] Build basic module enumeration logic

### **Phase 3: NixOS Integration (Weeks 9-12)**

- [ ] Extract Yocto kernel from Toradex BSP
- [ ] Create NixOS flake importing Yocto artifacts
- [ ] Boot NixOS on A53 with M7 co-processor
- [ ] Test RPMsg from Linux userspace
- [ ] Implement Python module-manager daemon

### **Phase 4: Custom Carrier Board (Weeks 13-18)**

- [ ] Design carrier PCB with 4x pogo connector footprints
- [ ] Route I2C buses to M7-controlled I2C2/I2C3
- [ ] Add STUSB4500 per edge with USB-C connectors
- [ ] Fabricate via JLCPCB, assemble first prototype
- [ ] Test with dummy Block (LED + I2C EEPROM)

### **Phase 5: First Selfcharters Block (Weeks 19-24)**

- [ ] Design Battery Block (4S2P cells, BMS, pogo mating connector)
- [ ] Implement Block firmware (descriptor EEPROM, status LEDs)
- [ ] Test hotplug detection and power delivery
- [ ] Linux driver for Battery Block (reports to UPower)

---

## **9. KEY TECHNICAL RESOURCES**

### **Documentation:**

- [NXP i.MX 8M Plus Reference Manual](https://www.nxp.com/docs/en/reference-manual/IMX8MPRM.pdf) - 5000+ pages, critical reading
- [Toradex Verdin iMX8M Plus Docs](https://developer.toradex.com/hardware/verdin-som-family/modules/verdin-imx8m-plus) - Best getting-started guide
- [Zephyr i.MX 8M Plus Support](https://docs.zephyrproject.org/latest/boards/nxp/mimx8mp_evk/doc/index.html) - Official Zephyr board support
- [NXP AMP Framework Guide](https://www.nxp.com/docs/en/application-note/AN13264.pdf) - Asymmetric multiprocessing setup

### **Code Examples:**

- [Toradex M7 Examples](https://github.com/toradex/FreeRTOS-Variscite) - Though FreeRTOS, adaptable to Zephyr
- [NXP MCUXpresso SDK](https://mcuxpresso.nxp.com/) - Has M7 bare-metal examples for RPMsg
- [Zephyr RPMsg Sample](https://github.com/zephyrproject-rtos/zephyr/tree/main/samples/subsys/ipc/openamp) - Starting point for your firmware

---

The M7 handling your module system is going to give you deterministic hotplug/power management that Linux cannot guarantee. NXP's AMP framework is mature, Zephyr has excellent i.MX support, and NixOS will give you the reproducibility you need for production.

Want me to dive deeper into the Zephyr firmware architecture, or shall we spec out the first prototype Block (Battery Block seems like the obvious MVP)?