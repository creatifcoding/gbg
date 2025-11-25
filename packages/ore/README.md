# Obsidian Reverse Engineer

A Tauri-based desktop application for reverse engineering Obsidian by analyzing its assets, build folders, and providing Frida instrumentation scripts.

## Features

### 🔍 Asset Analysis
- **Directory Scanning**: Analyze Obsidian installation directories recursively
- **File Classification**: Automatically categorize files by type (JavaScript, TypeScript, CSS, HTML, images, fonts, etc.)
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

### Analyzing Obsidian

1. Launch the application
2. Navigate to the "Asset Analysis" tab
3. Enter the path to your Obsidian installation:
   - **macOS**: `/Applications/Obsidian.app`
   - **Windows**: `C:\Program Files\Obsidian`
   - **Linux**: `/usr/bin/obsidian` or similar
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

1. Find the Obsidian process:
   ```bash
   frida-ps | grep -i obsidian
   ```

2. Save a script to a file (e.g., `hook.js`)

3. Attach Frida to Obsidian:
   ```bash
   frida -p <pid> -l hook.js
   ```

   Or by process name:
   ```bash
   frida Obsidian -l hook.js
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

## Security Considerations

- File reading is limited to 1MB by default to prevent memory issues
- Only text files should be read for content viewing
- Frida instrumentation requires appropriate permissions
- Some operations may require elevated privileges

## License

Part of the GBG monorepo. See the root LICENSE file for details.

## Contributing

This package is part of a larger monorepo. Contributions should follow the monorepo's contribution guidelines.

## Notes

- Obsidian is an Electron application, so it contains both JavaScript/TypeScript and native code
- The build folder typically contains bundled/minified code
- For best results, analyze the unpacked application resources
- Frida scripts work best with debug builds or when symbols are available

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
