use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct FridaScript {
    pub name: String,
    pub description: String,
    pub script: String,
}

/// Get pre-built Frida scripts for common reverse engineering tasks
pub fn get_frida_scripts() -> Vec<FridaScript> {
    vec![
        FridaScript {
            name: "Hook All Functions".to_string(),
            description: "Hooks all JavaScript functions and logs their calls".to_string(),
            script: r#"
// Frida script to hook all functions in target application
(function() {
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
})();
"#.to_string(),
        },
        FridaScript {
            name: "Monitor File System Access".to_string(),
            description: "Monitors file system operations in target application (Node.js fs module)".to_string(),
            script: r#"
// Frida script to monitor file system operations in Electron/Node.js
// This hooks the Node.js fs module methods instead of native functions

// Hook fs.readFile
if (typeof require !== 'undefined') {
    try {
        var fs = require('fs');
        if (fs && fs.readFile) {
            var originalReadFile = fs.readFile;
            fs.readFile = function(path, options, callback) {
                console.log("[FS] Reading file:", path);
                if (typeof options === 'function') {
                    callback = options;
                    options = undefined;
                }
                return originalReadFile.call(this, path, options, function(err, data) {
                    if (err) {
                        console.log("[FS] Failed to read:", path, "Error:", err.message);
                    } else {
                        console.log("[FS] Successfully read:", path, "Size:", data.length);
                    }
                    if (callback) callback(err, data);
                });
            };
        }
        
        // Hook fs.writeFile
        if (fs && fs.writeFile) {
            var originalWriteFile = fs.writeFile;
            fs.writeFile = function(path, data, options, callback) {
                console.log("[FS] Writing file:", path, "Size:", data.length);
                if (typeof options === 'function') {
                    callback = options;
                    options = undefined;
                }
                return originalWriteFile.call(this, path, data, options, function(err) {
                    if (err) {
                        console.log("[FS] Failed to write:", path, "Error:", err.message);
                    } else {
                        console.log("[FS] Successfully wrote:", path);
                    }
                    if (callback) callback(err);
                });
            };
        }
        
        console.log("[*] File system monitoring enabled");
    } catch(e) {
        console.log("[!] Failed to hook fs module:", e.message);
    }
} else {
    console.log("[!] require() not available, cannot hook fs module");
}
"#.to_string(),
        },
        FridaScript {
            name: "Trace Plugin API".to_string(),
            description: "Traces plugin API calls in target application".to_string(),
            script: r#"
// Frida script to trace plugin API (Electron app)
(function() {
    console.log("[*] Tracing Plugin API...");
    
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
})();
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
    // Sanitize the target function name to prevent script injection
    // Only allow alphanumeric characters, underscores, and dollar signs (valid JS identifiers)
    let sanitized = target_function
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '_' || *c == '$')
        .collect::<String>();
    
    if sanitized.is_empty() {
        return "// Error: Invalid function name provided".to_string();
    }
    
    format!(
        r#"
// Custom Frida script for function: {}
// Note: This script attempts to hook the function by name
// For minified code, you may need to use function addresses instead

// Try to find and hook the function in the global scope
if (typeof {} !== 'undefined') {{
    console.log("[*] Found function: {}");
    var original_{} = {};
    {} = function() {{
        console.log("[CALL] {} called with " + arguments.length + " argument(s)");
        for (var i = 0; i < arguments.length; i++) {{
            console.log("    arg" + i + ":", arguments[i]);
        }}
        var result = original_{}.apply(this, arguments);
        console.log("[RETURN] {} returned:", result);
        return result;
    }};
}} else {{
    console.log("[!] Function {} not found in global scope");
    console.log("[!] The function may be in a closure or require a different approach");
}}
"#,
        sanitized, sanitized, sanitized, sanitized, sanitized, sanitized, sanitized, sanitized, sanitized, sanitized
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

2. For desktop applications, you'll need frida-server running:
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

1. Find the target process:
   ```bash
   frida-ps | grep -i <process-name>
   ```

2. Run a Frida script:
   ```bash
   frida -p <pid> -l script.js
   ```

3. Or attach by name:
   ```bash
   frida <ProcessName> -l script.js
   ```

## Notes

- Target applications may be built with Electron, so you're hooking JavaScript/Node.js code
- Some Frida features require root/admin privileges
- For production analysis, consider using frida-trace for automatic function discovery:
  ```bash
  frida-trace -p <pid> -i "open*"
  ```

## Electron-specific Tips

- Electron applications provide standard Node.js APIs
- Access to Chromium DevTools APIs
- Can use both JavaScript and native code hooking
- Consider using Electron's IPC monitoring for plugin communication

"#.to_string()
}
