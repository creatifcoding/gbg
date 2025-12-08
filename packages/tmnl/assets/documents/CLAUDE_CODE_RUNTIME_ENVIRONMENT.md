# Claude Code Runtime Environment

Reference documentation for the sandboxed execution environment used by Claude Code Remote.

## System

| Property | Value |
|----------|-------|
| **OS** | Ubuntu 24.04.3 LTS (Noble Numbat) |
| **Kernel** | Linux 4.4.0 x86_64 (spoofed date: Jan 10, 2016) |
| **Hostname** | `runsc` (gVisor sandbox) |
| **User** | root (uid=0, gid=0) |

## Hardware / Resources

| Resource | Value |
|----------|-------|
| **CPU** | 16 cores @ 2.6GHz (Intel model 106, Ice Lake) |
| **Features** | AVX-512, SHA-NI, AES-NI (modern server CPU) |
| **Memory** | 13GB total |
| **Disk** | 30GB root filesystem |
| **Swap** | None |

## Container Environment

- **Runtime**: gVisor sandbox (`IS_SANDBOX=yes`, `runsc` hostname)
- **Root FS**: 9p filesystem (Plan 9 protocol for host passthrough)
- **Memory Limit**: 8GB (enforced by process_api)
- **Max Open Files**: 20,000

### Key Environment Variables

```bash
CLAUDECODE=1
CLAUDE_CODE_REMOTE=true
CLAUDE_CODE_ENTRYPOINT=remote
CLAUDE_CODE_VERSION=2.0.50
IS_SANDBOX=yes
```

## Installed Languages/Runtimes

| Runtime | Version | Path |
|---------|---------|------|
| Node.js | v22.21.1 | /opt/node22/bin/node |
| Python | 3.11.14 | /usr/local/bin/python3 |
| Go | 1.24.7 | /usr/local/go/bin/go |
| Rust | 1.91.1 | /root/.cargo/bin/rustc |
| Java | 21 (OpenJDK) | /usr/lib/jvm/java-21-openjdk-amd64 |
| Ruby | available | /usr/local/bin/ruby |
| Bun | available | /root/.bun/bin/bun |

## Filesystem Layout

```
/                           # 9p mount (30GB)
├── /dev                    # tmpfs
├── /dev/shm                # tmpfs (shared memory)
├── /sys                    # sysfs (read-only)
├── /proc                   # procfs
├── /sys/fs/cgroup          # cgroup controllers (cpu, memory, pids, etc.)
└── /container_info.json    # Container metadata (read-only 9p mount)
```

### Supported Filesystems

- tmpfs
- devpts
- devtmpfs
- overlay
- mqueue
- cgroup
- erofs
- fuse
- 9p
- proc
- sysfs

## Networking

- Single virtual interface (`fc98ed4f1a-v` pattern)
- All HTTP/HTTPS traffic routed through JWT-authenticated egress proxy
- Proxy tokens are time-limited (4-hour expiry window)
- `NO_PROXY` excludes: localhost, 127.0.0.1, metadata endpoints, Google APIs

## Process Hierarchy

```
/process_api (PID 1)
└── /bin/sh
    └── /usr/local/bin/environment-manager task-run
        └── claude (Node.js process)
            └── /bin/bash (shell sessions)
```

## Resource Limits

| Limit | Soft | Hard |
|-------|------|------|
| Max CPU time | unlimited | unlimited |
| Max file size | unlimited | unlimited |
| Max open files | 20,000 | 20,000 |
| Max stack size | 8MB | unlimited |
| Max locked memory | 64KB | 64KB |
| Max pending signals | 0 | 0 |

## Key Observations

1. **Sandboxed execution** - Running inside gVisor (Google's container sandbox), providing syscall-level isolation
2. **Egress controlled** - All HTTP/HTTPS traffic routed through a JWT-authenticated proxy with time-limited tokens
3. **Ephemeral** - Containers are created on-demand per session
4. **9p filesystem** - Uses Plan 9 protocol for host filesystem access with overlay capabilities
5. **No swap** - Memory-constrained environment; OOM kills possible under heavy load
6. **cgroup isolation** - Per-container resource accounting for CPU, memory, PIDs

## Nix Compatibility

The Nix package manager can be installed but has limited functionality due to gVisor's `waitpid` syscall restrictions.

### What Works

| Operation | Status | Notes |
|-----------|--------|-------|
| `nix --version` | ✅ | Binary executes |
| `nix flake metadata` | ✅ | Reads flake configuration |
| `nix flake show` | ✅ | Evaluates flake outputs |
| `nix eval` | ✅ | Pure evaluation |

### What Fails

| Operation | Status | Error |
|-----------|--------|-------|
| `nix develop` | ❌ | `cannot get exit status of PID: No child processes` |
| `nix build` | ❌ | Same - crashes during derivation build |
| `nix print-dev-env` | ❌ | Crashes when building dependencies |
| `nix-shell` | ❌ | Same underlying issue |

### Root Cause

gVisor implements a subset of Linux syscalls. The `waitpid` syscall behavior differs from standard Linux - when Nix spawns builder child processes and attempts to wait for them, gVisor returns `ECHILD` (No child processes), causing Nix to crash.

This is a fundamental limitation of the gVisor sandbox that cannot be worked around without changes to the runtime environment.

### Workaround

For development environments, use the pre-installed runtimes (Node.js, Python, Go, Rust, Java, Ruby, Bun) directly instead of Nix-managed toolchains.

## Limitations

- No systemd or init system
- No persistent storage across sessions
- Network egress requires proxy authentication
- Some syscalls may be restricted by gVisor (notably `waitpid` for builder processes)
- No direct hardware access
- Nix builds not supported (evaluation only)
