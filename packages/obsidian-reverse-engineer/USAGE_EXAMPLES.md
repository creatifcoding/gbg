# Usage Examples

This document provides practical examples of using the Obsidian Reverse Engineer tool.

## Example 1: Analyzing Obsidian Installation

### Step 1: Launch the Application

```bash
cd packages/obsidian-reverse-engineer
pnpm run tauri:dev
```

### Step 2: Enter Obsidian Path

Depending on your OS, enter one of the following paths:

**macOS:**
```
/Applications/Obsidian.app
```

**Windows:**
```
C:\Program Files\Obsidian
```

**Linux:**
```
/opt/Obsidian
```

### Step 3: Browse Results

After clicking "Analyze Directory", you'll see:
- Total file count and directory size
- List of all files categorized by type
- Click any file to view its contents
- For JavaScript/TypeScript files, see extracted function names

## Example 2: Extracting Functions from Obsidian Code

### Scenario: You want to find all functions in Obsidian's main application file

1. Navigate to the Assets Analysis tab
2. Enter the path to Obsidian's resources (usually inside the app bundle)
3. Find and click on a file like `app.js` or similar
4. Review the "Detected Functions" section
5. Click "Generate Frida Script" for any function you want to hook

### Example Output:

```
Detected Functions (125):
- initializeApp
- loadPlugins
- openVault
- createNote
- renderMarkdown
- saveFile
...
```

## Example 3: Using Frida Scripts

### Hooking All JavaScript Functions

1. Go to the "Frida Scripts" tab
2. Click on "Hook All Functions"
3. Click "Copy to Clipboard"
4. Save the script to a file: `hook_all.js`
5. Find Obsidian's process ID:
   ```bash
   frida-ps | grep -i obsidian
   ```
6. Run Frida:
   ```bash
   frida -p 12345 -l hook_all.js
   ```

### Example Console Output:

```
[*] Starting function hooking...
[CALL] openVault called with args: ["/Users/john/Documents/MyVault"]
[RETURN] openVault returned: true
[CALL] loadPlugins called with args: []
[*] Hooked 342 properties
```

## Example 4: Monitoring File System Access

### Track What Files Obsidian Accesses

1. Select "Monitor File System Access" from Frida Scripts
2. Copy the script
3. Run with Frida:
   ```bash
   frida Obsidian -l fs_monitor.js
   ```

### Example Output:

```
[FS] Opening file: /Users/john/Documents/MyVault/.obsidian/workspace
[FS] Successfully opened: /Users/john/Documents/MyVault/.obsidian/workspace
[FS] Read 4096 bytes from fd:12
[FS] Opening file: /Users/john/Documents/MyVault/daily-note.md
[FS] Successfully opened: /Users/john/Documents/MyVault/daily-note.md
```

## Example 5: Tracing Plugin API Calls

### Monitor Plugin Loading and API Usage

1. Select "Trace Plugin API" script
2. Copy and save to `plugin_trace.js`
3. Run Frida:
   ```bash
   frida -l plugin_trace.js -f /path/to/Obsidian
   ```

### Example Output:

```
[*] Tracing Obsidian Plugin API...
[*] Found App class, hooking methods...
[PLUGIN] Plugin loaded: obsidian-git
[APP] vault called
[APP] workspace called
[PLUGIN] Plugin loaded: dataview
```

## Example 6: Extracting API Endpoints

### Discover What APIs Obsidian Communicates With

1. Use "Extract API Endpoints" script
2. Run with Frida while using Obsidian
3. Perform actions that trigger network requests

### Example Output:

```
[API] fetch https://api.obsidian.md/v1/sync/check
[API] Response status: 200
[API] XHR GET https://plugin-repo.obsidian.md/plugins.json
[API] fetch https://updates.obsidian.md/latest
[API] Response status: 200
```

## Example 7: Custom Function Hook

### Hook a Specific Function

1. Find a function in the Assets Analysis (e.g., `saveFile`)
2. Click "Generate Frida Script"
3. The custom script will appear in Frida Scripts
4. Copy and use with Frida

### Generated Script Example:

```javascript
// Custom Frida script for function: saveFile
Interceptor.attach(Module.findExportByName(null, "saveFile"), {
    onEnter: function(args) {
        console.log("[*] saveFile called");
        console.log("    arg0: " + args[0]);
        console.log("    arg1: " + args[1]);
        console.log("    arg2: " + args[2]);
    },
    onLeave: function(retval) {
        console.log("[*] saveFile returned: " + retval);
    }
});
```

## Example 8: Memory Dump

### Dump Memory Regions for Analysis

1. Select "Memory Dump" script
2. Run with Frida
3. Analyze the output for interesting memory regions

### Example Output:

```
[MODULE] Obsidian @ 0x100000000
  [EXPORT] _ZN8Obsidian4App4initEv @ 0x100123456
  [EXPORT] _ZN8Obsidian6Plugin4loadEv @ 0x100234567
[MEMORY] 0x100000000 - 0x100400000 (size: 4194304)
[MEMORY] 0x7fff00000000 - 0x7fff10000000 (size: 268435456)
```

## Tips and Best Practices

### 1. Start with Non-Invasive Scripts
- Begin with monitoring scripts (file access, API calls)
- Avoid modifying behavior until you understand the code flow

### 2. Use Function Discovery
- Use the asset analyzer to find functions before writing custom hooks
- This helps you target the right functions

### 3. Filter Output
- Frida can produce a lot of output
- Use grep or log filtering to focus on relevant information:
  ```bash
  frida -l script.js Obsidian 2>&1 | grep "CALL"
  ```

### 4. Save Logs
- Capture Frida output to files for later analysis:
  ```bash
  frida -l script.js Obsidian > frida_log.txt 2>&1
  ```

### 5. Incremental Hooking
- Don't hook everything at once
- Start with specific functions and expand as needed

### 6. Use Detach Mode
- For production analysis, use `-D` flag to spawn and detach:
  ```bash
  frida -D -l script.js Obsidian
  ```

## Troubleshooting

### Issue: "Unable to attach to process"
**Solution:** Run Frida with elevated privileges (sudo on Linux/Mac)

### Issue: "Function not found"
**Solution:** The function might be minified. Analyze the built JavaScript to find the actual name.

### Issue: Too much output
**Solution:** Modify scripts to filter specific functions or use grep

### Issue: Obsidian crashes
**Solution:** Your hook might be interfering with critical code. Remove hooks one by one to identify the culprit.

## Advanced Usage

### Combining Multiple Scripts

You can combine multiple monitoring approaches in one script:

```javascript
// Combined monitoring script
Java.perform(function() {
    // Hook plugins
    if (typeof Plugin !== 'undefined') {
        var originalLoad = Plugin.prototype.onload;
        Plugin.prototype.onload = function() {
            console.log("[PLUGIN] " + this.manifest.id);
            return originalLoad.apply(this, arguments);
        };
    }
    
    // Monitor API calls
    var originalFetch = window.fetch;
    window.fetch = function(url) {
        console.log("[API] " + url);
        return originalFetch.apply(this, arguments);
    };
    
    // Hook file operations
    Interceptor.attach(Module.findExportByName(null, "open"), {
        onEnter: function(args) {
            console.log("[FS] " + Memory.readUtf8String(args[0]));
        }
    });
});
```

Save this as `combined_monitor.js` and run:
```bash
frida -l combined_monitor.js Obsidian
```

## Further Reading

- [Frida Documentation](https://frida.re/docs/)
- [Obsidian Plugin API](https://docs.obsidian.md/Plugins/)
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)
- [JavaScript Reverse Engineering](https://github.com/topics/javascript-reverse-engineering)
