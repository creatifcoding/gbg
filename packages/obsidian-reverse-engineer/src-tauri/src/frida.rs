use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct FridaScript {
    pub name: String,
    pub description: String,
    pub script: String,
}

/// Get pre-built Frida scripts for common Obsidian reverse engineering tasks
pub fn get_frida_scripts() -> Vec<FridaScript> {
    vec![
        FridaScript {
            name: "Hook All Functions".to_string(),
            description: "Hooks all JavaScript functions and logs their calls".to_string(),
            script: r#"
// Frida script to hook all functions in Obsidian
Java.perform(function() {
    console.log("[*] Starting function hooking...");
    
    // Get all global functions
    var functions = Object.getOwnPropertyNames(window);
    
    functions.forEach(function(name) {
        try {
            if (typeof window[name] === 'function') {
                var originalFn = window[name];
                window[name] = function() {
                    console.log("[CALL] " + name + " called with args:", arguments);
                    var result = originalFn.apply(this, arguments);
                    console.log("[RETURN] " + name + " returned:", result);
                    return result;
                };
            }
        } catch(e) {
            // Skip errors for properties that can't be redefined
        }
    });
    
    console.log("[*] Hooked " + functions.length + " properties");
});
"#.to_string(),
        },
        FridaScript {
            name: "Monitor File System Access".to_string(),
            description: "Monitors file system operations in Obsidian".to_string(),
            script: r#"
// Frida script to monitor file system operations
Interceptor.attach(Module.findExportByName(null, "open"), {
    onEnter: function(args) {
        var path = Memory.readUtf8String(args[0]);
        console.log("[FS] Opening file: " + path);
        this.path = path;
    },
    onLeave: function(retval) {
        if (retval.toInt32() > 0) {
            console.log("[FS] Successfully opened: " + this.path);
        } else {
            console.log("[FS] Failed to open: " + this.path);
        }
    }
});

Interceptor.attach(Module.findExportByName(null, "read"), {
    onEnter: function(args) {
        this.fd = args[0].toInt32();
        this.size = args[2].toInt32();
    },
    onLeave: function(retval) {
        var bytesRead = retval.toInt32();
        if (bytesRead > 0) {
            console.log("[FS] Read " + bytesRead + " bytes from fd:" + this.fd);
        }
    }
});
"#.to_string(),
        },
        FridaScript {
            name: "Trace Plugin API".to_string(),
            description: "Traces Obsidian plugin API calls".to_string(),
            script: r#"
// Frida script to trace Obsidian plugin API
Java.perform(function() {
    console.log("[*] Tracing Obsidian Plugin API...");
    
    // Hook the Plugin class if it exists
    if (typeof Plugin !== 'undefined') {
        var originalLoad = Plugin.prototype.onload;
        Plugin.prototype.onload = function() {
            console.log("[PLUGIN] Plugin loaded:", this.manifest.id);
            return originalLoad.apply(this, arguments);
        };
        
        var originalUnload = Plugin.prototype.onunload;
        Plugin.prototype.onunload = function() {
            console.log("[PLUGIN] Plugin unloaded:", this.manifest.id);
            return originalUnload.apply(this, arguments);
        };
    }
    
    // Hook the App class methods
    if (typeof App !== 'undefined') {
        console.log("[*] Found App class, hooking methods...");
        var appMethods = Object.getOwnPropertyNames(App.prototype);
        appMethods.forEach(function(method) {
            if (typeof App.prototype[method] === 'function') {
                var original = App.prototype[method];
                App.prototype[method] = function() {
                    console.log("[APP] " + method + " called");
                    return original.apply(this, arguments);
                };
            }
        });
    }
});
"#.to_string(),
        },
        FridaScript {
            name: "Extract API Endpoints".to_string(),
            description: "Captures network requests and API endpoints".to_string(),
            script: r#"
// Frida script to extract API endpoints
(function() {
    // Hook XMLHttpRequest
    var originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
        console.log("[API] XHR " + method + " " + url);
        return originalOpen.apply(this, arguments);
    };
    
    // Hook fetch
    var originalFetch = window.fetch;
    window.fetch = function() {
        var url = arguments[0];
        console.log("[API] fetch " + url);
        return originalFetch.apply(this, arguments).then(function(response) {
            console.log("[API] Response status: " + response.status);
            return response;
        });
    };
    
    console.log("[*] API endpoint monitoring enabled");
})();
"#.to_string(),
        },
        FridaScript {
            name: "Memory Dump".to_string(),
            description: "Dumps memory regions for analysis".to_string(),
            script: r#"
// Frida script to dump memory regions
Process.enumerateModules().forEach(function(module) {
    console.log("[MODULE] " + module.name + " @ " + module.base);
    
    module.enumerateExports().forEach(function(exp) {
        if (exp.type === 'function') {
            console.log("  [EXPORT] " + exp.name + " @ " + exp.address);
        }
    });
});

// Dump memory regions
Process.enumerateRanges('r--').forEach(function(range) {
    console.log("[MEMORY] " + range.base + " - " + 
                range.base.add(range.size) + 
                " (size: " + range.size + ")");
});
"#.to_string(),
        },
    ]
}

/// Generate a custom Frida script template
pub fn generate_custom_script(target_function: &str) -> String {
    format!(
        r#"
// Custom Frida script for function: {}
Interceptor.attach(Module.findExportByName(null, "{}"), {{
    onEnter: function(args) {{
        console.log("[*] {} called");
        console.log("    arg0: " + args[0]);
        console.log("    arg1: " + args[1]);
        console.log("    arg2: " + args[2]);
    }},
    onLeave: function(retval) {{
        console.log("[*] {} returned: " + retval);
    }}
}});
"#,
        target_function, target_function, target_function, target_function
    )
}

/// Get Frida installation and usage instructions
pub fn get_frida_instructions() -> String {
    r#"
# Frida Installation and Usage

## Installation

1. Install Frida tools:
   ```bash
   pip install frida-tools
   ```

2. For Obsidian on desktop, you'll need frida-server running:
   ```bash
   # Download frida-server for your platform from:
   # https://github.com/frida/frida/releases
   
   # For Linux:
   ./frida-server &
   
   # For macOS:
   ./frida-server &
   
   # For Windows:
   frida-server.exe
   ```

## Usage

1. Find the Obsidian process:
   ```bash
   frida-ps | grep -i obsidian
   ```

2. Run a Frida script:
   ```bash
   frida -p <pid> -l script.js
   ```

3. Or attach by name:
   ```bash
   frida Obsidian -l script.js
   ```

## Notes

- Obsidian is built with Electron, so you're hooking JavaScript/Node.js code
- Some Frida features require root/admin privileges
- For production analysis, consider using frida-trace for automatic function discovery:
  ```bash
  frida-trace -p <pid> -i "open*"
  ```

## Electron-specific Tips

- Obsidian runs in Electron, so standard Node.js APIs are available
- Access to Chromium DevTools APIs
- Can use both JavaScript and native code hooking
- Consider using Electron's IPC monitoring for plugin communication

"#.to_string()
}
