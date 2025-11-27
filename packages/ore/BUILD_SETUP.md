# Build Environment Setup

This document describes how to set up the build environment for the Obsidian Reverse Engineer Tauri application.

## System Dependencies

Tauri requires several system dependencies to be installed before building. The specific dependencies vary by operating system.

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  libgtk-3-dev
```

### Linux (Fedora)

```bash
sudo dnf install -y \
  webkit2gtk4.1-devel \
  openssl-devel \
  curl \
  wget \
  file \
  libappindicator-gtk3-devel \
  librsvg2-devel
```

### Linux (Arch)

```bash
sudo pacman -S --needed \
  webkit2gtk-4.1 \
  base-devel \
  curl \
  wget \
  file \
  openssl \
  appmenu-gtk-module \
  gtk3 \
  libappindicator-gtk3 \
  librsvg
```

### macOS

On macOS, you need to install Xcode Command Line Tools:

```bash
xcode-select --install
```

### Windows

On Windows, you need to install:

1. Microsoft Visual Studio C++ Build Tools
2. WebView2 (usually pre-installed on Windows 10/11)

Visit: https://visualstudio.microsoft.com/downloads/

## Rust Installation

Install Rust using rustup:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

After installation, restart your terminal or run:

```bash
source $HOME/.cargo/env
```

## Node.js and bun

Install Node.js (v20 or later recommended):
- Download from https://nodejs.org/

Install bun:

```bash
npm install -g bun
```

## Building the Application

Once all dependencies are installed:

1. Install project dependencies:
   ```bash
   cd packages/ore
   bun install
   ```

2. Build the frontend:
   ```bash
   bun run build
   ```

3. Build the complete Tauri application:
   ```bash
   bun run tauri:build
   ```

4. For development with hot reload:
   ```bash
   bun run tauri:dev
   ```

## Troubleshooting

### Missing System Libraries

If you get errors about missing libraries, make sure you've installed all the system dependencies listed above for your operating system.

### Rust Compilation Errors

If you encounter Rust compilation errors:

1. Ensure Rust is up to date:
   ```bash
   rustup update
   ```

2. Clean the build cache:
   ```bash
   cd src-tauri
   cargo clean
   cd ..
   ```

3. Try building again

### WebView2 Errors (Windows)

If you get WebView2 errors on Windows:

1. Download and install the WebView2 Runtime:
   https://developer.microsoft.com/en-us/microsoft-edge/webview2/

2. Reboot your system

### Permission Errors

On Linux/macOS, if you encounter permission errors:

1. Ensure you have write permissions to the project directory
2. Don't run npm/bun with sudo unless absolutely necessary

## CI/CD Considerations

When building in CI/CD environments:

1. Install system dependencies as part of the CI setup
2. Cache Cargo and npm dependencies for faster builds
3. Use cross-compilation for targeting multiple platforms
4. Consider using Docker images with pre-installed dependencies

## Docker Build (Optional)

For containerized builds on Linux:

```dockerfile
FROM rust:1.75

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    libwebkit2gtk-4.1-dev \\
    build-essential \\
    curl \\
    wget \\
    file \\
    libxdo-dev \\
    libssl-dev \\
    libayatana-appindicator3-dev \\
    librsvg2-dev \\
    libgtk-3-dev

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
RUN apt-get install -y nodejs

# Install bun
RUN npm install -g bun

WORKDIR /app
```

## Platform-Specific Builds

To build for a specific platform:

```bash
# Build for current platform
bun run tauri:build

# The built application will be in:
# - Linux: src-tauri/target/release/bundle/
# - macOS: src-tauri/target/release/bundle/macos/
# - Windows: src-tauri/target/release/bundle/msi/
```

## References

- [Tauri Prerequisites Guide](https://tauri.app/start/prerequisites/)
- [Rust Installation](https://www.rust-lang.org/tools/install)
- [Node.js Downloads](https://nodejs.org/)
- [bun Installation](https://bun.io/installation)
