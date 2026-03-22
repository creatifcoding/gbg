# TMNL Security Considerations

This document catalogs known security concerns, attack surfaces, and mitigations relevant to TMNL's runtime environment.

---

## Table of Contents

1. [Mesa/DRI Device Probing](#mesadri-device-probing)
2. [WSLg Interop Attack Surface](#wslg-interop-attack-surface)
3. [Tauri/WebKitGTK Considerations](#tauriwebkitgtk-considerations)
4. [Recommendations](#recommendations)

---

## Mesa/DRI Device Probing

### Overview

Mesa (the open-source OpenGL/Vulkan implementation) unconditionally probes GPU device nodes on startup:

```
/dev/dri/card0
/dev/dri/renderD128
/dev/dxg (WSL-specific)
```

This behavior occurs even when GPU acceleration isn't required, exposing several attack vectors.

### Observed Behavior

```
libEGL warning: failed to get driver name for fd -1
libEGL warning: MESA-LOADER: failed to retrieve device info
MESA: error: ZINK: failed to choose pdev
libEGL warning: egl: failed to create dri2 screen
```

These messages indicate Mesa probing for devices, failing, then falling back to software rendering. The probing itself is the concern.

### Attack Vectors

#### 1. Symlink Race (TOCTOU)

**Severity:** Medium
**Type:** Local Privilege Escalation / Information Disclosure

An attacker with write access to `/dev` (or ability to influence device creation timing) can:

1. Create symlink: `/dev/dri/card0` → `/etc/shadow`
2. Mesa opens the symlink with its process privileges
3. If Mesa runs with elevated permissions (setuid, capabilities), attacker gains read access to target file

**Preconditions:**
- Attacker has local access
- Mesa runs with elevated privileges (rare but possible in legacy setups)
- Race window exists during device enumeration

#### 2. Malicious Device Node Injection

**Severity:** High
**Type:** Code Execution / Kernel Exploitation

A crafted device node responding to DRM ioctls can:

1. Return malformed responses triggering parser vulnerabilities in Mesa
2. Exploit kernel DRM subsystem bugs via unexpected ioctl sequences
3. Cause memory corruption in userspace Mesa libraries

**Preconditions:**
- Attacker can create device nodes (requires `CAP_MKNOD` or compromised `/dev`)
- Vulnerable Mesa/kernel version

**Related CVEs:**
| CVE | Description | Affected |
|-----|-------------|----------|
| CVE-2022-21123 | Intel MMIO Stale Data — GPU memory not cleared | Intel i915 |
| CVE-2023-1829 | Linux DRM use-after-free | Kernel < 6.2 |
| CVE-2022-1016 | Linux DRM info leak | Kernel < 5.17 |

#### 3. Information Disclosure via Probe Timing

**Severity:** Low
**Type:** Fingerprinting

Device probe order and timing reveals:
- GPU presence and model
- Driver version
- Whether running in WSL vs native Linux
- Virtualization layer characteristics

**Use case:** Targeted attacks based on environment fingerprinting.

#### 4. Container/Namespace Escape

**Severity:** Medium-High
**Type:** Isolation Bypass

In containerized environments where `/dev` isn't properly isolated:

1. Container probes host's `/dev/dri/*` devices
2. DRM ioctls may leak host GPU state
3. Shared memory regions could expose host application data

**Preconditions:**
- Container has access to host `/dev` (misconfiguration)
- DRM device namespace not properly isolated

---

## WSLg Interop Attack Surface

### Overview

WSLg introduces `/dev/dxg` — a virtual device bridging Linux userspace to Windows GPU drivers via DirectX 12.

### Architecture

```
Linux Userspace (Mesa/WebKitGTK)
         ↓
    /dev/dxg (virtual device)
         ↓
    dxgkrnl (WSL2 kernel module)
         ↓
    Hyper-V VMBus
         ↓
    Windows dxgkrnl.sys
         ↓
    Windows GPU Driver (NVIDIA/AMD/Intel)
```

### Attack Vectors

#### 1. Malformed DXG Ioctls

**Severity:** High
**Type:** Cross-OS Kernel Exploitation

The `/dev/dxg` device accepts ioctls that are marshaled to Windows kernel:

```c
// Linux side
ioctl(dxg_fd, DXG_IOCTL_*, &payload);

// Crosses VM boundary to Windows dxgkrnl.sys
```

Malformed payloads could:
- Trigger parsing bugs in Windows kernel
- Cause denial of service (BSOD)
- Potentially achieve code execution in Windows kernel context

**This is a Linux→Windows kernel attack vector.**

#### 2. Shared GPU Memory Corruption

**Severity:** Medium
**Type:** Data Integrity / Information Disclosure

WSLg shares GPU memory regions between Linux and Windows contexts:

- Improper synchronization could corrupt Windows application GPU state
- Memory not cleared between contexts could leak Windows application data to Linux
- Texture/buffer contents from Windows apps potentially readable

#### 3. Credential/Sensitive Data Leakage

**Severity:** Medium
**Type:** Information Disclosure

GPU memory often contains:
- Rendered UI elements (passwords visible on screen)
- Texture data from other applications
- Compute shader intermediate results

If GPU memory isolation between WSL and Windows contexts is imperfect, Linux processes could potentially read Windows application GPU memory.

### Known WSLg Security Issues

| Issue | Description | Status |
|-------|-------------|--------|
| GPU memory isolation | Memory not always cleared between contexts | Partially addressed |
| VMBus attack surface | Additional IPC channel for exploitation | Ongoing research |
| WDDM driver bugs | Windows GPU driver bugs exploitable from Linux | Driver-dependent |

---

## Tauri/WebKitGTK Considerations

### WebKitGTK Attack Surface

Tauri uses WebKitGTK for rendering, which:

1. **Inherits Mesa probing behavior** — All GPU concerns above apply
2. **JavaScript engine (JSC)** — Standard browser engine attack surface
3. **IPC with Rust backend** — Custom protocol handlers

### Tauri-Specific Concerns

#### 1. IPC Command Injection

Custom Tauri commands exposed to frontend:

```rust
#[tauri::command]
fn dangerous_command(path: String) -> Result<String, String> {
    std::fs::read_to_string(path) // Path traversal!
}
```

**Mitigation:** Validate all IPC inputs; use allowlists.

#### 2. CSP Configuration

Default Tauri CSP may be too permissive:

```json
"security": {
  "csp": "default-src 'self'; script-src 'self'"
}
```

**Mitigation:** Audit `tauri.conf.json` CSP settings.

#### 3. Capability Permissions

Tauri's capability system in `src-tauri/capabilities/`:

```json
{
  "permissions": [
    "core:window:allow-start-dragging",
    "shell:allow-open"  // Potentially dangerous
  ]
}
```

**Mitigation:** Principle of least privilege; audit capability grants.

---

## Recommendations

### Development Environment

| Control | Implementation | Priority |
|---------|----------------|----------|
| Suppress Mesa debug output | `export MESA_DEBUG=silent` | Low |
| Increase inotify limits | `sysctl fs.inotify.max_user_watches=524288` | Medium |
| Isolate dev containers | Don't mount host `/dev/dri` unnecessarily | Medium |

### Production Deployment

| Control | Implementation | Priority |
|---------|----------------|----------|
| Disable GPU if unused | Compile Mesa with `--disable-glx` or use CPU-only image | High |
| Explicit device allowlist | Don't rely on auto-probing; configure explicit paths | High |
| Seccomp filtering | Block DRM ioctls if GPU not required | Medium |
| Container isolation | Empty `/dev/dri` mount; drop `CAP_SYS_RAWIO` | High |
| CSP hardening | Strict Content-Security-Policy in Tauri config | High |
| IPC input validation | Validate all Tauri command parameters | Critical |

### WSL-Specific

| Control | Implementation | Priority |
|---------|----------------|----------|
| Monitor `/dev/dxg` access | Audit which processes access the device | Medium |
| Isolate sensitive work | Don't process secrets in WSL if GPU memory isolation is concern | Context-dependent |
| Keep WSL updated | Microsoft patches WSLg vulnerabilities regularly | High |

### Monitoring

```bash
# Monitor DRI device access
sudo auditctl -w /dev/dri -p rwxa -k dri_access
sudo auditctl -w /dev/dxg -p rwxa -k dxg_access

# Review logs
ausearch -k dri_access
ausearch -k dxg_access
```

---

## References

### CVE Databases
- [NIST NVD — Mesa](https://nvd.nist.gov/vuln/search/results?query=mesa)
- [NIST NVD — Linux DRM](https://nvd.nist.gov/vuln/search/results?query=linux+drm)

### Technical Documentation
- [Mesa Security Policy](https://docs.mesa3d.org/security.html)
- [WSLg Architecture](https://github.com/microsoft/wslg/blob/main/docs/WSLg-Architecture.md)
- [Tauri Security](https://tauri.app/v1/guides/security/)
- [Linux DRM Subsystem](https://www.kernel.org/doc/html/latest/gpu/drm-internals.html)

### Research
- [GPU Memory Attacks (BlackHat)](https://www.blackhat.com/docs/us-14/materials/us-14-Karvandi-GPU-Assisted-Malware.pdf)
- [WSL Attack Surface (DEF CON)](https://media.defcon.org/DEF%20CON%2027/)

---

## Changelog

| Date | Author | Description |
|------|--------|-------------|
| 2025-12-05 | Val | Initial document — Mesa probing, WSLg attack surface |

---

*This document should be reviewed quarterly and updated when new vulnerabilities are disclosed or architectural changes occur.*
