# EMBEDDER Project Configuration

**EMBEDDER PROJECT CONTEXT**
<OVERVIEW>
Name = tmnl
Target MCU = IMX8M Plus (Quad ARM Cortex-A53 @ 1.8GHz + ARM Cortex-M7 @ 800MHz)
Board = CompuLab MCM-iMX8M-Plus SoM
Toolchain = Rust (RTIC Framework) + GCC ARM Embedded (C/C++)
Debug Interface = probe-rs / OpenOCD / Serial
RTOS / SDK = RTIC (Real-Time Interrupt-driven Concurrency) + Linux
Architecture Pattern = RTIC Real-Time Framework with Dual-Core Processing
Project Summary = Mixed Rust/C Embedded Terminal Interface for IMX8M Plus Real-Time Systems
</OVERVIEW>

<COMMANDS>
# --- Build / Compile --------------------------------------------------------
# Rust RTIC firmware build
build_command = cargo build --release --target thumbv7em-none-eabihf
debug_build_command = cargo build --target thumbv7em-none-eabihf

# C/C++ firmware components
c_build_command = arm-none-eabi-gcc -mcpu=cortex-m7 -mthumb -O2 -Wall -Wextra
cmake_build_command = cmake --build build --target tmnl-firmware

# Nix development environment
nix_build_command = nix develop .#tmnl-embedded
nix_rust_shell = nix develop .#tmnl-rust

# --- Test -------------------------------------------------------------------
test_command = cargo test
unit_test_command = cargo test --lib
integration_test_command = cargo test --test '*'
lint_command = cargo clippy -- -D warnings
format_command = cargo fmt --check

# --- Hardware-in-Loop Testing ----------------------------------------------
hil_test_command = cargo test --target thumbv7em-none-eabihf --features hardware-testing
renode_test_command = renode --console scripts/test-suite.resc
qemu_test_command = qemu-system-arm -machine mcimx8m-evk -cpu cortex-a53

# --- Flash / Program --------------------------------------------------------
# Cortex-M7 firmware flashing via probe-rs
flash_command = probe-rs run --chip IMX8M7 target/thumbv7em-none-eabihf/release/tmnl-firmware
flash_debug_command = probe-rs run --chip IMX8M7 target/thumbv7em-none-eabihf/debug/tmnl-firmware

# Alternative flashing via OpenOCD
openocd_flash_command = openocd -f interface/cmsis-dap.cfg -f target/imx8mp.cfg -c "program target/thumbv7em-none-eabihf/release/tmnl-firmware.elf verify reset exit"

# U-Boot integration for dual-core deployment
uboot_deploy_command = fatload mmc 1:1 0x7e0000 tmnl-firmware.bin; bootaux 0x7e0000

# --- Debug ------------------------------------------------------------------
# Cortex-M7 debugging via probe-rs
gdb_server_command = probe-rs gdb --chip IMX8M7
gdb_server_host = localhost
gdb_server_port = 1337
gdb_client_command = arm-none-eabi-gdb target/thumbv7em-none-eabihf/debug/tmnl-firmware -ex "target remote :1337"

# Alternative debugging via OpenOCD
openocd_server_command = openocd -f interface/cmsis-dap.cfg -f target/imx8mp.cfg
openocd_gdb_command = arm-none-eabi-gdb -ex "target remote localhost:3333"

# RTIC Task Analysis
rtic_analysis_command = cargo expand --bin tmnl-firmware | rtic-expansion-analyzer
target_connection = probe-rs

# --- Serial Monitor for IMX8M Plus Debug -----------------------------------
serial_port = /dev/ttyUSB0
serial_baudrate = 115200
serial_monitor_command = tio {port} -b {baud}
serial_monitor_interactive = false
serial_encoding = ascii
serial_startup_commands = []

# Cortex-M7 RTT (Real-Time Transfer) debugging
rtt_command = probe-rs rtt --chip IMX8M7
rtt_channel = 0

# --- Static Analysis --------------------------------------------------------
static_analysis_command = cargo clippy -- -D warnings -D clippy::all
misra_check_command = cppcheck --enable=all --std=c11 src/
security_audit_command = cargo audit
memory_analysis_command = cargo bloat --release --crates

# --- Performance Analysis ---------------------------------------------------
timing_analysis_command = cargo run --bin timing-analysis --features perf-counters
stack_analysis_command = cargo stack-sizes --bin tmnl-firmware --target thumbv7em-none-eabihf
memory_map_command = arm-none-eabi-objdump -h target/thumbv7em-none-eabihf/release/tmnl-firmware
real_time_trace_command = probe-rs trace --chip IMX8M7
</COMMANDS>

# Project Overview

**tmnl** is a mixed Rust/C embedded firmware project implementing a real-time terminal interface system for the IMX8M Plus dual-core processor using the RTIC (Real-Time Interrupt-driven Concurrency) framework.

**Core Architecture:**
- **Cortex-M7 (800MHz)**: Real-time RTIC firmware in Rust handling deterministic tasks
- **Cortex-A53 (1.8GHz)**: High-level system management and communication (Linux userspace)
- **Hardware Platform**: CompuLab MCM-iMX8M-Plus System-on-Module
- **Real-Time Framework**: RTIC v2 for priority-based preemptive multitasking
- **Development Environment**: Nix-based reproducible toolchain with Fenix Rust
- **Testing**: Hardware-in-loop testing with Renode simulation and QEMU

**IMX8M Plus Capabilities Utilized:**
- **Neural Processing Unit (NPU)**: 2.3 TOPS for AI acceleration
- **Dual Camera ISP**: 375 MP/s image processing
- **Industrial Connectivity**: Dual Gigabit Ethernet with TSN, CAN-FD
- **Advanced Multimedia**: 4K video processing, 3D/2D GPU
- **Real-Time Coprocessor**: Cortex-M7 for microsecond-precision tasks
- **High-Speed Interfaces**: PCIe, USB 3.0, MIPI-CSI2

# System Architecture

## RTIC Real-Time Architecture

```rust
// RTIC App Definition for IMX8M Plus Cortex-M7
#[rtic::app(device = imx8mp_m7, peripherals = true, dispatchers = [SWI0, SWI1, SWI2])]
mod app {
    use imx8mp_hal::*;
    use heapless::{Vec, pool::{Pool, Node}};
    
    #[shared]
    struct Shared {
        terminal_buffer: heapless::Vec<u8, 1024>,
        system_state: SystemState,
        inter_core_mailbox: Mailbox,
    }
    
    #[local]
    struct Local {
        uart: UART4,
        gpio_leds: GpioLeds,
        timer: GPT1,
        dma_controller: DMA,
    }
    
    #[init]
    fn init(ctx: init::Context) -> (Shared, Local, init::Monotonics) {
        // Hardware initialization
        let dp = ctx.device;
        let cp = ctx.core;
        
        // Configure system clocks (800MHz Cortex-M7)
        let clocks = setup_clocks(dp.CCM);
        
        // Initialize RTIC monotonic timer
        let mono = setup_monotonic(dp.GPT2, &clocks);
        
        // Initialize shared resources
        let shared = Shared {
            terminal_buffer: heapless::Vec::new(),
            system_state: SystemState::Init,
            inter_core_mailbox: Mailbox::new(dp.MU_M7),
        };
        
        // Initialize local resources
        let local = Local {
            uart: UART4::new(dp.UART4, &clocks),
            gpio_leds: GpioLeds::new(dp.GPIO1, dp.GPIO2),
            timer: GPT1::new(dp.GPT1, &clocks),
            dma_controller: DMA::new(dp.DMA),
        };
        
        // Spawn initial tasks
        terminal_handler::spawn().ok();
        heartbeat_task::spawn().ok();
        
        (shared, local, init::Monotonics(mono))
    }
}
```

## Priority Levels (RTIC Framework)

```rust
// RTIC Priority Levels (0-15, higher number = higher priority)
const PRIORITY_CRITICAL: u8 = 15;    // Hardware fault handlers
const PRIORITY_INTERRUPT: u8 = 12;   // External interrupt handlers  
const PRIORITY_REALTIME: u8 = 10;    // Real-time control loops
const PRIORITY_SYSTEM: u8 = 8;       // System management tasks
const PRIORITY_COMMUNICATION: u8 = 6; // Inter-core communication
const PRIORITY_TERMINAL: u8 = 4;     // Terminal I/O operations
const PRIORITY_BACKGROUND: u8 = 2;   // Background processing
const PRIORITY_IDLE: u8 = 1;         // Idle tasks and diagnostics
```

## Dual-Core Resource Management

**Cortex-M7 Responsibilities (RTIC):**
- Real-time terminal character processing (< 10μs latency)
- Hardware interrupt handling and GPIO management
- Precision timing control and PWM generation  
- Direct sensor interfacing via I2C/SPI with deterministic timing
- Inter-core communication coordination via mailbox interrupts
- Critical system monitoring and fault detection

**Cortex-A53 Responsibilities (Linux):**
- High-level terminal emulation and protocol handling
- Network communication and file system operations
- Complex data processing and AI/ML inference coordination
- User interface management and display rendering
- Non-real-time system services and device management

## Hardware Resource Allocation

```rust
// Hardware resources managed by RTIC resource system
#[shared]
struct SharedResources {
    // Communication interfaces
    uart_debug: UART4,           // Debug console (115200 baud)
    uart_host: UART1,            // Host communication (configurable)
    i2c_sensors: I2C1,           // Sensor bus (400kHz)
    spi_peripherals: SPI1,       // High-speed peripheral bus
    
    // Inter-core communication  
    mailbox_a53: MU_A53,         // Mailbox to Cortex-A53
    shared_memory: SharedMem,     // Coherent memory region
    
    // System resources
    system_clocks: CCM,           // Clock control module
    power_management: GPC,        // Power management
    watchdog: WDOG1,             // System watchdog
}

#[local] 
struct LocalResources {
    // Real-time specific peripherals
    precise_timer: GPT1,         // Microsecond precision timer
    gpio_control: GPIO1,         // General purpose I/O
    dma_engine: DMA,             // Direct memory access
    adc_converter: ADC1,         // Analog-to-digital converter
}
```

# RTIC Task Implementation Patterns

## High-Priority Interrupt-Driven Tasks

```rust
// UART interrupt handler (Priority 12)
#[task(binds = UART4, priority = 12, shared = [terminal_buffer], local = [uart])]
fn uart_interrupt(mut ctx: uart_interrupt::Context) {
    let uart = ctx.local.uart;
    
    while let Ok(byte) = uart.read_byte() {
        ctx.shared.terminal_buffer.lock(|buffer| {
            if buffer.len() < buffer.capacity() {
                buffer.push(byte).ok();
            }
        });
    }
    
    // Spawn terminal processing task
    terminal_processor::spawn().ok();
}

// GPIO interrupt for external events (Priority 12) 
#[task(binds = GPIO1_INT15_0, priority = 12)]
fn gpio_interrupt(ctx: gpio_interrupt::Context) {
    // Handle external hardware events with guaranteed <1μs response
    let gpio_status = GPIO1::read_interrupt_status();
    
    match gpio_status {
        GpioEvent::UserButton => user_input_handler::spawn().ok(),
        GpioEvent::SystemAlert => system_fault_handler::spawn().ok(),
        GpioEvent::ExternalTrigger => precision_timing_task::spawn().ok(),
    }
    
    GPIO1::clear_interrupt(gpio_status);
}
```

## Real-Time Control Tasks

```rust
// Precision timing control loop (Priority 10)
#[task(priority = 10, shared = [system_state], local = [precise_timer])]
fn precision_timing_task(mut ctx: precision_timing_task::Context) {
    let timer = ctx.local.precise_timer;
    
    // Execute time-critical operations with μs precision
    timer.start_measurement();
    
    ctx.shared.system_state.lock(|state| {
        // Perform deterministic real-time operations
        match state {
            SystemState::ActiveTerminal => execute_terminal_timing(),
            SystemState::SensorSampling => execute_sensor_control(),
            SystemState::SystemMonitoring => execute_system_diagnostics(),
        }
    });
    
    let execution_time = timer.stop_measurement();
    assert!(execution_time < Duration::from_micros(50)); // Validate timing constraint
    
    // Schedule next execution
    precision_timing_task::spawn_after(Duration::from_millis(1)).ok();
}
```

## Inter-Core Communication Tasks

```rust
// Mailbox communication with Cortex-A53 (Priority 6)
#[task(priority = 6, shared = [inter_core_mailbox, terminal_buffer])]
fn inter_core_communication(mut ctx: inter_core_communication::Context) {
    ctx.shared.inter_core_mailbox.lock(|mailbox| {
        // Send terminal data to A53 for high-level processing
        if let Some(message) = mailbox.receive() {
            match message {
                A53Message::TerminalCommand(cmd) => {
                    terminal_command_executor::spawn(cmd).ok();
                }
                A53Message::SystemConfiguration(config) => {
                    system_config_update::spawn(config).ok();
                }
                A53Message::DiagnosticsRequest => {
                    diagnostics_reporter::spawn().ok();
                }
            }
        }
    });
    
    // Send buffered terminal data to A53
    ctx.shared.terminal_buffer.lock(|buffer| {
        if !buffer.is_empty() {
            let data = buffer.clone();
            buffer.clear();
            send_to_a53(InterCoreMessage::TerminalData(data));
        }
    });
}
```

## Resource-Constrained Task Design

```rust
// Background processing with static allocation (Priority 2)
#[task(priority = 2, capacity = 4)]
fn background_processor(ctx: background_processor::Context, data: ProcessingData) {
    // Use static memory allocation for embedded constraints
    static mut PROCESSING_BUFFER: [u8; 512] = [0; 512];
    static mut RESULT_BUFFER: [u8; 128] = [0; 128];
    
    let processing_buffer = unsafe { &mut PROCESSING_BUFFER };
    let result_buffer = unsafe { &mut RESULT_BUFFER };
    
    // Process data with bounded execution time and memory usage
    let result = process_terminal_data(
        &data, 
        processing_buffer, 
        result_buffer,
        Duration::from_millis(5) // Maximum processing time
    );
    
    match result {
        Ok(processed_data) => {
            output_handler::spawn(processed_data).ok();
        }
        Err(ProcessingError::TimeoutExceeded) => {
            error_handler::spawn(ErrorCode::ProcessingTimeout).ok();
        }
        Err(ProcessingError::InsufficientMemory) => {
            error_handler::spawn(ErrorCode::MemoryExhausted).ok();
        }
    }
}
```

# Hardware Abstraction Layer (HAL)

## IMX8M Plus Peripheral Drivers

```c
// C HAL for complex hardware interfaces
// File: src/hal/imx8mp_hal.h

#ifndef IMX8MP_HAL_H
#define IMX8MP_HAL_H

#include <stdint.h>
#include <stdbool.h>

// IMX8M Plus Memory Map
#define UART4_BASE_ADDR         0x30A60000
#define GPIO1_BASE_ADDR         0x30200000  
#define I2C1_BASE_ADDR          0x30A20000
#define GPT1_BASE_ADDR          0x302D0000
#define MU_M7_BASE_ADDR         0x30AA0000

// UART Hardware Abstraction
typedef struct {
    volatile uint32_t URXD;     // UART Receiver Register
    volatile uint32_t UTXD;     // UART Transmitter Register  
    volatile uint32_t UCR1;     // UART Control Register 1
    volatile uint32_t UCR2;     // UART Control Register 2
    volatile uint32_t UCR3;     // UART Control Register 3
    volatile uint32_t UCR4;     // UART Control Register 4
    volatile uint32_t UFCR;     // UART FIFO Control Register
    volatile uint32_t USR1;     // UART Status Register 1
    volatile uint32_t USR2;     // UART Status Register 2
} UART_TypeDef;

// GPIO Hardware Abstraction
typedef struct {
    volatile uint32_t DR;       // GPIO Data Register
    volatile uint32_t GDIR;     // GPIO Direction Register
    volatile uint32_t PSR;      // GPIO Pad Status Register
    volatile uint32_t ICR1;     // GPIO Interrupt Configuration Register 1
    volatile uint32_t ICR2;     // GPIO Interrupt Configuration Register 2
    volatile uint32_t IMR;      // GPIO Interrupt Mask Register
    volatile uint32_t ISR;      // GPIO Interrupt Status Register
    volatile uint32_t EDGE_SEL; // GPIO Edge Select Register
} GPIO_TypeDef;

// Messaging Unit for Inter-Core Communication
typedef struct {
    volatile uint32_t TR[4];    // Transmit Registers
    volatile uint32_t RR[4];    // Receive Registers
    volatile uint32_t SR;       // Status Register
    volatile uint32_t CR;       // Control Register
} MU_TypeDef;

// HAL Function Prototypes
void HAL_UART_Init(UART_TypeDef* uart, uint32_t baudrate);
bool HAL_UART_Transmit(UART_TypeDef* uart, uint8_t* data, uint16_t size, uint32_t timeout);
bool HAL_UART_Receive(UART_TypeDef* uart, uint8_t* buffer, uint16_t size, uint32_t timeout);

void HAL_GPIO_Init(GPIO_TypeDef* gpio, uint32_t pin, uint32_t mode);
void HAL_GPIO_WritePin(GPIO_TypeDef* gpio, uint32_t pin, bool state);
bool HAL_GPIO_ReadPin(GPIO_TypeDef* gpio, uint32_t pin);

void HAL_MU_Init(MU_TypeDef* mu);
bool HAL_MU_SendMessage(MU_TypeDef* mu, uint32_t message);
bool HAL_MU_ReceiveMessage(MU_TypeDef* mu, uint32_t* message);

#endif // IMX8MP_HAL_H
```

## Memory Management for Embedded Systems

```rust
// Memory management with static allocation
use heapless::{Vec, String, pool::{Pool, Node, singleton::{Pool as SingletonPool}}};

// Static memory pools for deterministic allocation
static mut UART_BUFFER_MEMORY: [Node<[u8; 256]>; 8] = [Node::new(); 8];
static UART_BUFFER_POOL: Pool<[u8; 256]> = Pool::new();

static mut TERMINAL_MESSAGE_MEMORY: [Node<TerminalMessage>; 16] = [Node::new(); 16];  
static TERMINAL_MESSAGE_POOL: Pool<TerminalMessage> = Pool::new();

// Initialize memory pools at startup
#[init]
fn init(ctx: init::Context) -> (Shared, Local, init::Monotonics) {
    // Initialize static memory pools
    unsafe {
        UART_BUFFER_POOL.grow_exact(&mut UART_BUFFER_MEMORY);
        TERMINAL_MESSAGE_POOL.grow_exact(&mut TERMINAL_MESSAGE_MEMORY);
    }
    
    // ... rest of initialization
}

// Use pooled allocation in tasks
#[task(priority = 4)]
fn terminal_handler(ctx: terminal_handler::Context, data: &[u8]) {
    // Allocate from static pool instead of heap
    if let Some(mut buffer) = UART_BUFFER_POOL.alloc() {
        buffer.copy_from_slice(data);
        
        // Process terminal data with guaranteed memory availability
        process_terminal_buffer(&buffer);
        
        // Return buffer to pool (automatic via Drop trait)
    } else {
        // Handle memory exhaustion gracefully
        error_handler::spawn(ErrorCode::BufferPoolExhausted).ok();
    }
}
```

# Development Environment

## Nix-based Reproducible Development

```bash
# Enter Rust RTIC development shell
nix develop .#tmnl-rust

# Enter general embedded development shell  
nix develop .#tmnl-embedded

# Available tools in embedded shell:
# - gcc-arm-embedded (arm-none-eabi-gcc)
# - probe-rs (modern Rust debugging/flashing)
# - openocd (traditional debugging interface)
# - qemu-system-arm (ARM emulation)
# - renode (hardware simulation framework)
```

## Build System Configuration

```toml
# Cargo.toml for RTIC Rust firmware
[package]
name = "tmnl-firmware"
version = "0.1.0"
edition = "2021"

[dependencies]
# RTIC Real-Time Framework
cortex-m = "0.7"
cortex-m-rt = "0.7"
rtic = { version = "2.0", features = ["thumbv7-backend"] }
rtic-monotonics = { version = "1.0", features = ["imxrt-gpt"] }

# Hardware Abstraction
imx8mp-hal = { path = "hal/imx8mp-hal" }
embedded-hal = "0.2"

# Memory Management
heapless = "0.8"
nb = "1.0"

# Utilities
panic-probe = "0.3"
defmt = "0.3"
defmt-rtt = "0.4"

[profile.release]
lto = true
codegen-units = 1
panic = "abort"
strip = "symbols"
opt-level = "s"  # Optimize for size

[profile.dev]
debug = true
opt-level = 1    # Some optimization for reasonable performance

[[bin]]
name = "tmnl-firmware"
path = "src/main.rs"

[features]
default = []
hardware-testing = ["defmt-rtt"]
perf-counters = ["cortex-m/critical-section-single-core"]
```

# Testing & Validation

## Hardware-in-Loop Testing

```rust
// Hardware-specific integration tests
#[cfg(test)]
mod hardware_tests {
    use super::*;
    use embedded_test::prelude::*;
    
    #[embedded_test::tests]
    mod tests {
        use super::*;
        
        #[init]
        fn init() -> TestContext {
            // Initialize hardware for testing
            let dp = unsafe { imx8mp_pac::Peripherals::steal() };
            TestContext::new(dp)
        }
        
        #[test]
        fn test_uart_transmission_timing(ctx: &mut TestContext) {
            let start = ctx.timer.now();
            
            // Transmit test data
            ctx.uart.write_bytes(b"TEST_DATA_TIMING");
            
            let duration = ctx.timer.now() - start;
            
            // Validate transmission completed within timing constraints
            assert!(duration < Duration::from_micros(100));
        }
        
        #[test] 
        fn test_gpio_interrupt_latency(ctx: &mut TestContext) {
            let mut interrupt_received = false;
            let start_time = ctx.timer.now();
            
            // Set up interrupt handler
            ctx.gpio.set_interrupt_handler(|| {
                let latency = ctx.timer.now() - start_time;
                assert!(latency < Duration::from_micros(10)); // < 10μs latency requirement
                interrupt_received = true;
            });
            
            // Trigger GPIO interrupt
            ctx.gpio.trigger_external_interrupt();
            
            // Wait for interrupt processing  
            ctx.timer.delay(Duration::from_millis(1));
            assert!(interrupt_received);
        }
        
        #[test]
        fn test_inter_core_communication(ctx: &mut TestContext) {
            let test_message = b"INTER_CORE_TEST";
            
            // Send message to Cortex-A53
            ctx.mailbox.send_message(test_message);
            
            // Wait for acknowledgment (with timeout)
            let ack = ctx.mailbox.wait_for_ack(Duration::from_millis(100));
            assert!(ack.is_ok());
        }
    }
}
```

## Renode Hardware Simulation

```bash
# Renode simulation script for IMX8M Plus
# File: scripts/test-suite.resc

using sysbus
mach create "imx8mp-test"

# Load IMX8M Plus platform definition  
machine LoadPlatformDescription @platforms/cpus/imx8mp.repl

# Load compiled firmware
sysbus LoadELF @target/thumbv7em-none-eabihf/debug/tmnl-firmware

# Configure serial output
showAnalyzer uart4

# Set up test scenario
macro reset
"""
    sysbus Reset
    cpu0 PC 0x00000000
"""

# Run test suite
runMacro $reset
start

# Execute automated test sequence
uart4 WriteChar 0x48  # Send 'H'
uart4 WriteChar 0x65  # Send 'e'  
uart4 WriteChar 0x6C  # Send 'l'
uart4 WriteChar 0x6C  # Send 'l'
uart4 WriteChar 0x6F  # Send 'o'

# Validate response
```

## Static Analysis & MISRA Compliance

```bash
# Comprehensive static analysis
cargo clippy -- -D warnings -D clippy::all -D clippy::pedantic -D clippy::nursery

# MISRA-C compliance checking for C HAL code
cppcheck --enable=all --std=c11 --addon=misra.py src/hal/

# Memory safety analysis
cargo miri test

# Stack usage analysis
cargo stack-sizes --bin tmnl-firmware --target thumbv7em-none-eabihf

# Binary size analysis
cargo bloat --release --crates

# Security audit
cargo audit

# Documentation coverage
cargo doc --no-deps --document-private-items
```

# Code Standards & Safety

## Rust Embedded Guidelines

**Memory Management:**
- **No Heap Allocation**: Use `heapless` collections and static allocation exclusively
- **Stack Size Limits**: Maximum 2KB stack usage per task
- **Static Buffers**: Pre-allocated buffer pools for all dynamic data
- **Resource Sharing**: RTIC resource system prevents data races by design

**Real-Time Constraints:**
- **Interrupt Service Routines**: Maximum 1μs execution time
- **Task Priorities**: Explicit priority assignment with analysis
- **Deadline Monitoring**: All tasks must complete within specified deadlines
- **Jitter Minimization**: Use monotonic timers and priority inheritance

**Safety & Reliability:**
- **Panic Handling**: All panics logged via defmt and system reset
- **Fault Recovery**: Watchdog timer with automatic recovery procedures  
- **Error Propagation**: Result types with comprehensive error handling
- **Hardware Validation**: All register accesses validated against datasheet

```rust
// Example: Safe register access patterns
use imx8mp_pac::UART4;

impl SafeUART {
    pub fn configure_baud_rate(&mut self, baudrate: u32) -> Result<(), UARTError> {
        // Validate input parameters against hardware constraints
        if baudrate < 1200 || baudrate > 4_000_000 {
            return Err(UARTError::InvalidBaudRate);
        }
        
        // Critical section for register access
        cortex_m::interrupt::free(|_| {
            // Calculate divider values according to IMX8MP reference manual
            let peripheral_clock = self.get_peripheral_clock_freq();
            let divider = peripheral_clock / (16 * baudrate);
            
            if divider > 0xFFFF {
                return Err(UARTError::BaudRateNotSupported);
            }
            
            // Configure UART registers with validated values
            self.registers.ufcr.modify(|_, w| {
                w.rfdiv().bits((divider >> 8) as u8)
            });
            
            self.registers.ubir.write(|w| {
                w.inc().bits((divider & 0xFF) as u16)
            });
            
            // Verify configuration took effect
            let readback = self.registers.ufcr.read().rfdiv().bits();
            if readback != ((divider >> 8) as u8) {
                return Err(UARTError::ConfigurationFailed);
            }
            
            Ok(())
        })
    }
}
```

## C Language Guidelines (MISRA-C Subset)

**Required Rules:**
- **Rule 8.14**: `static` for internal linkage functions
- **Rule 10.1**: Implicit conversions prohibited  
- **Rule 11.5**: No casts removing type qualifiers
- **Rule 17.4**: Array indexing preferred over pointer arithmetic
- **Rule 21.3**: Standard library functions require validation

**Memory Management:**
```c
// Safe memory operations following MISRA guidelines
// File: src/hal/safe_memory.c

#include "safe_memory.h"
#include <stdint.h>
#include <string.h>

// MISRA Rule 8.14: Static linkage for internal functions
static bool validate_memory_range(const void* ptr, size_t size) {
    // Validate pointer is within valid memory range for IMX8MP
    uintptr_t addr = (uintptr_t)ptr;
    
    // TCML memory range: 0x007F8000 - 0x007FFFFF (32KB)
    // TCMU memory range: 0x20200000 - 0x20207FFF (32KB)  
    // OCRAM memory range: 0x00900000 - 0x0097FFFF (512KB)
    
    bool in_tcml = (addr >= 0x007F8000U) && ((addr + size) <= 0x00800000U);
    bool in_tcmu = (addr >= 0x20200000U) && ((addr + size) <= 0x20208000U);
    bool in_ocram = (addr >= 0x00900000U) && ((addr + size) <= 0x00980000U);
    
    return in_tcml || in_tcmu || in_ocram;
}

// Safe memory copy with bounds checking
HAL_StatusTypeDef HAL_SafeMemCpy(void* dest, const void* src, size_t size) {
    // MISRA Rule 17.4: Validate parameters before use
    if ((dest == NULL) || (src == NULL) || (size == 0U)) {
        return HAL_ERROR;
    }
    
    // Validate memory ranges
    if (!validate_memory_range(dest, size) || !validate_memory_range(src, size)) {
        return HAL_ERROR;
    }
    
    // MISRA Rule 10.1: Explicit casting for pointer arithmetic
    const uint8_t* src_bytes = (const uint8_t*)src;
    uint8_t* dest_bytes = (uint8_t*)dest;
    
    // Copy data byte by byte to avoid alignment issues
    for (size_t i = 0U; i < size; i++) {
        dest_bytes[i] = src_bytes[i];
    }
    
    return HAL_OK;
}
```

**Hardware Register Access:**
```c
// Safe register access with read-back verification
// File: src/hal/imx8mp_uart.c

#include "imx8mp_uart.h"

HAL_StatusTypeDef UART_SetBaudRate(UART_TypeDef* uart, uint32_t baudrate) {
    // MISRA Rule 11.5: No removal of const qualifier
    volatile UART_TypeDef* const uart_regs = uart;
    
    // Validate parameters
    if ((uart_regs == NULL) || (baudrate < UART_MIN_BAUDRATE) || (baudrate > UART_MAX_BAUDRATE)) {
        return HAL_ERROR;
    }
    
    // Calculate baud rate divider according to IMX8MP Reference Manual
    uint32_t ref_freq = HAL_GetPeripheralClock(PERIPHERAL_UART4);
    uint32_t divider = ref_freq / (16U * baudrate);
    
    if (divider > UART_MAX_DIVIDER) {
        return HAL_ERROR;
    }
    
    // Configure baud rate registers with critical section
    __disable_irq();
    
    uart_regs->UFCR &= ~UART_UFCR_RFDIV_MASK;
    uart_regs->UFCR |= UART_UFCR_RFDIV(divider >> 8U);
    
    uart_regs->UBIR = UART_UBIR_INC(divider & 0xFFU);
    
    // Read-back verification
    uint32_t readback = (uart_regs->UFCR & UART_UFCR_RFDIV_MASK) >> UART_UFCR_RFDIV_SHIFT;
    
    __enable_irq();
    
    if (readback != (divider >> 8U)) {
        return HAL_ERROR;
    }
    
    return HAL_OK;
}
```

This comprehensive EMBEDDER.md provides a complete framework for developing professional-grade mixed Rust/C embedded firmware using the RTIC framework on the IMX8M Plus platform. The configuration supports both real-time requirements and safety-critical development practices.