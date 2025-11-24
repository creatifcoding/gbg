import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

interface AssetInfo {
  path: string;
  file_name: string;
  extension?: string;
  size: number;
  file_type: string;
}

interface AnalysisResult {
  assets: AssetInfo[];
  total_files: number;
  total_size: number;
  directory: string;
}

interface FridaScript {
  name: string;
  description: string;
  script: string;
}

function App() {
  const [obsidianPath, setObsidianPath] = useState("");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<AssetInfo | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [functions, setFunctions] = useState<string[]>([]);
  const [fridaScripts, setFridaScripts] = useState<FridaScript[]>([]);
  const [selectedScript, setSelectedScript] = useState<FridaScript | null>(null);
  const [fridaInstructions, setFridaInstructions] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"analyze" | "frida">("analyze");

  async function analyzeDirectory() {
    if (!obsidianPath.trim()) {
      setError("Please enter an Obsidian directory path");
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      const result: AnalysisResult = await invoke("analyze_obsidian_directory", {
        path: obsidianPath,
      });
      setAnalysisResult(result);
      setError("");
    } catch (e) {
      setError(`Failed to analyze directory: ${e}`);
      setAnalysisResult(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadFile(asset: AssetInfo) {
    setSelectedFile(asset);
    setLoading(true);
    setError("");
    
    try {
      const content: string = await invoke("read_file", {
        path: asset.path,
        maxSize: 1024 * 1024, // 1MB limit
      });
      setFileContent(content);
      
      // Extract functions if it's a JS/TS file
      if (asset.extension === "js" || asset.extension === "ts" || 
          asset.extension === "jsx" || asset.extension === "tsx") {
        const funcs: string[] = await invoke("extract_functions_from_code", {
          code: content,
        });
        setFunctions(funcs);
      } else {
        setFunctions([]);
      }
      
      setError("");
    } catch (e) {
      setError(`Failed to load file: ${e}`);
      setFileContent("");
      setFunctions([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadFridaScripts() {
    try {
      const scripts: FridaScript[] = await invoke("get_frida_script_templates");
      setFridaScripts(scripts);
      
      const instructions: string = await invoke("get_frida_usage_instructions");
      setFridaInstructions(instructions);
    } catch (e) {
      setError(`Failed to load Frida scripts: ${e}`);
    }
  }

  async function generateCustomScript(functionName: string) {
    try {
      const script: string = await invoke("generate_frida_script", {
        targetFunction: functionName,
      });
      setSelectedScript({
        name: `Custom: ${functionName}`,
        description: `Custom script for function ${functionName}`,
        script,
      });
    } catch (e) {
      setError(`Failed to generate script: ${e}`);
    }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  return (
    <div className="app">
      <header>
        <h1>🔍 Obsidian Reverse Engineer</h1>
        <p>Analyze Obsidian assets and generate Frida instrumentation scripts</p>
      </header>

      <div className="tabs">
        <button
          className={activeTab === "analyze" ? "active" : ""}
          onClick={() => setActiveTab("analyze")}
        >
          📂 Asset Analysis
        </button>
        <button
          className={activeTab === "frida" ? "active" : ""}
          onClick={() => {
            setActiveTab("frida");
            if (fridaScripts.length === 0) loadFridaScripts();
          }}
        >
          🎯 Frida Scripts
        </button>
      </div>

      {error && (
        <div className="error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {activeTab === "analyze" && (
        <div className="tab-content">
          <div className="input-section">
            <input
              type="text"
              value={obsidianPath}
              onChange={(e) => setObsidianPath(e.target.value)}
              placeholder="Enter Obsidian directory path (e.g., /Applications/Obsidian.app or C:\Program Files\Obsidian)"
              className="path-input"
            />
            <button onClick={analyzeDirectory} disabled={loading}>
              {loading ? "Analyzing..." : "Analyze Directory"}
            </button>
          </div>

          {analysisResult && (
            <div className="results">
              <div className="summary">
                <h2>Analysis Summary</h2>
                <p><strong>Directory:</strong> {analysisResult.directory}</p>
                <p><strong>Total Files:</strong> {analysisResult.total_files}</p>
                <p><strong>Total Size:</strong> {formatSize(analysisResult.total_size)}</p>
              </div>

              <div className="content-panes">
                <div className="file-list">
                  <h3>Files ({analysisResult.assets.length})</h3>
                  <div className="file-items">
                    {analysisResult.assets.map((asset, idx) => (
                      <div
                        key={idx}
                        className={`file-item ${selectedFile?.path === asset.path ? "selected" : ""}`}
                        onClick={() => loadFile(asset)}
                      >
                        <div className="file-name">{asset.file_name}</div>
                        <div className="file-meta">
                          <span className="file-type">{asset.file_type}</span>
                          <span className="file-size">{formatSize(asset.size)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedFile && (
                  <div className="file-details">
                    <h3>File Details</h3>
                    <div className="file-info">
                      <p><strong>Path:</strong> {selectedFile.path}</p>
                      <p><strong>Type:</strong> {selectedFile.file_type}</p>
                      <p><strong>Size:</strong> {formatSize(selectedFile.size)}</p>
                    </div>

                    {functions.length > 0 && (
                      <div className="functions">
                        <h4>Detected Functions ({functions.length})</h4>
                        <div className="function-list">
                          {functions.map((fn, idx) => (
                            <div key={idx} className="function-item">
                              <span>{fn}</span>
                              <button
                                onClick={() => generateCustomScript(fn)}
                                className="small-btn"
                              >
                                Generate Frida Script
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {fileContent && (
                      <div className="file-content">
                        <h4>Content</h4>
                        <pre>{fileContent.substring(0, 5000)}</pre>
                        {fileContent.length > 5000 && (
                          <p className="truncated">Content truncated (showing first 5000 characters)</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "frida" && (
        <div className="tab-content">
          <div className="frida-section">
            <div className="frida-list">
              <h2>Frida Script Templates</h2>
              {fridaScripts.map((script, idx) => (
                <div
                  key={idx}
                  className={`frida-item ${selectedScript?.name === script.name ? "selected" : ""}`}
                  onClick={() => setSelectedScript(script)}
                >
                  <h4>{script.name}</h4>
                  <p>{script.description}</p>
                </div>
              ))}
            </div>

            {selectedScript && (
              <div className="frida-details">
                <h3>{selectedScript.name}</h3>
                <p>{selectedScript.description}</p>
                <button onClick={() => copyToClipboard(selectedScript.script)}>
                  📋 Copy to Clipboard
                </button>
                <pre className="script-content">{selectedScript.script}</pre>
              </div>
            )}
          </div>

          <div className="frida-instructions">
            <h2>Frida Usage Instructions</h2>
            <pre>{fridaInstructions}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
