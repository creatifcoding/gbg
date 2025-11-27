# ORE - Ontological Reverse Engineer

A universal intervention platform for mapping and manipulating the runtime reality of any target system. ORE provides tools for dissecting, analyzing, and controlling target processes through ontological mapping and Frida instrumentation.

## Overview

ORE is a Tauri-based desktop application designed for ontological reverse engineering—extracting the implicit ontology of running systems and providing operators with tools to reshape it. The platform supports universal hooking, active injection, binary patching, and dynamic ontological mapping across multiple architectures and runtime environments.

## Features

### 🔍 Asset Analysis
- **Directory Scanning**: Analyze target application directories recursively
- **File Classification**: Automatically categorize files by type (JavaScript, TypeScript, CSS, HTML, images, fonts, binaries, etc.)
- **Function Extraction**: Extract function names from JavaScript/TypeScript files
- **File Content Viewing**: Read and display file contents with size limits for safety
- **Statistics**: View total file count and directory size

### 🎯 Frida Instrumentation
- **Pre-built Scripts**: Collection of ready-to-use Frida scripts for:
  - Hooking all JavaScript functions
  - Monitoring file system access
  - Tracing plugin API calls
  - Extracting API endpoints
  - Memory dumping
- **Custom Script Generation**: Automatically generate Frida scripts for specific functions
- **Usage Instructions**: Comprehensive guide for Frida installation and usage
- **Copy to Clipboard**: Easy script export for immediate use

### 🔧 Universal Intervention
- **Multi-Architecture Support**: Works with x64, ARM, and other architectures
- **Runtime Agnostic**: Supports native (C/C++), managed (JS/C#/Java), and hybrid applications
- **Dynamic Mapping**: Converts memory addresses and function signatures into semantic graphs
- **Active Control**: Inject logic, patch binaries, and trigger internal routines

## Installation

### Prerequisites

Pre requisites fulfilled by Nix!! Enjoy

### Build

```bash
cd packages/ore
bun install
bun tauri build
```

### Development

```bash
cd packages/ore
bun install
bun tauri dev
```

## Usage

### Analyzing Target Applications

1. Launch the application
2. Navigate to the "Asset Analysis" tab
3. Enter the path to your target application directory:
   - **macOS**: `/Applications/TargetApp.app`
   - **Windows**: `C:\Program Files\TargetApp`
   - **Linux**: `/usr/bin/targetapp` or similar
4. Click "Analyze Directory"
5. Browse files in the list and view their contents
6. Functions detected in JavaScript/TypeScript files will be listed

### Using Frida Scripts

1. Navigate to the "Frida Scripts" tab
2. Browse the available script templates
3. Click on a script to view its code
4. Use "Copy to Clipboard" to copy the script
5. Follow the instructions to use with Frida

### Generating Custom Scripts

1. Analyze a directory and select a JavaScript/TypeScript file
2. In the detected functions list, click "Generate Frida Script" next to any function
3. The custom script will appear in the Frida Scripts tab

## Frida Integration

### Installing Frida

```bash
pip install frida-tools
```

### Using Generated Scripts

1. Find the target process:
   ```bash
   frida-ps | grep -i <process-name>
   ```

2. Save a script to a file (e.g., `hook.js`)

3. Attach Frida to the target:
   ```bash
   frida -p <pid> -l hook.js
   ```

   Or by process name:
   ```bash
   frida <ProcessName> -l hook.js
   ```

## Architecture

### Backend (Rust)

- **analyzer.rs**: Directory scanning, file analysis, and function extraction
- **frida.rs**: Frida script templates and generation
- **lib.rs**: Tauri command handlers

### Frontend (React + TypeScript)

- **App.tsx**: Main application UI with tabs for analysis and Frida scripts
- **App.css**: Modern, responsive styling with dark/light mode support

### Key Technologies

- **Tauri 2**: Lightweight desktop app framework
- **React 19**: UI library
- **TypeScript**: Type-safe development
- **Vite**: Fast build tool
- **Rust**: High-performance backend with walkdir and regex crates

## Operational Domains

ORE operates across three domains as defined in the project charter:

1. **The Intervention Domain**: Polymorphic engine (Frida + Capstone + Keystone) capable of hooking, assembling, and disassembling code across architectures
2. **The Ontological Domain**: Dynamic mapping layer that converts raw memory addresses and function signatures into a semantic graph
3. **The Control Domain**: Active command interface allowing operators to inject logic, patch binaries, and trigger internal routines

## Security Considerations

- File reading is limited to 1MB by default to prevent memory issues
- Only text files should be read for content viewing
- Frida instrumentation requires appropriate permissions
- Some operations may require elevated privileges
- System stability is secondary to system access—crashes are acceptable data points

## License

Part of the GBG monorepo. See the root LICENSE file for details.

## Contributing

This package is part of a larger monorepo. Contributions should follow the monorepo's contribution guidelines.

## Notes

- Target applications may be Electron-based, containing both JavaScript/TypeScript and native code
- Build folders typically contain bundled/minified code
- For best results, analyze the unpacked application resources
- Frida scripts work best with debug builds or when symbols are available
- ORE rejects passive compliance—it is designed for active intervention and control

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
