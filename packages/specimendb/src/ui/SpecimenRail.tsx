/**
 * SpecimenRail — Workbench `/rail` route.
 * Mechanical translation of docs/variant/9263d787-0811-440f-8822-f31ee93b56a8.html.
 * Look lock: docs/variant/variant-02.png. Phase 0: one page, no extraction.
 * WorkingPanel is Assay `/assay`, not the other Workbench pane.
 *
 * @module @tmnl/specimendb/ui
 */

import './ImportedWorkbench.css';
import type { CatalogSurface } from './catalog-stx.js';

export type SpecimenRailProps = {
  readonly catalog?: CatalogSurface;
};

export function SpecimenRail(_props: SpecimenRailProps = {}) {
  return (
    <div className="imported-workbench" data-testid="specimen-rail">
    <div
      className="h-screen w-screen overflow-hidden flex font-sans text-sm selection:bg-charcoal-200 selection:text-gray-200"
      vid="12"
    >


    
    <aside className="w-[420px] flex-shrink-0 flex flex-col bg-void border-r border-charcoal-300 relative z-20" vid="13">
        
        <header className="h-12 border-b border-charcoal-300 flex items-center justify-between px-4 bg-void shrink-0" vid="14">
            <div className="flex items-center gap-2" vid="15">
                <i className="ph ph-database text-textdim" vid="16"></i>
                <span className="font-mono text-[10px] uppercase tracking-widest text-textmuted" vid="17">SpecimenDB // Core</span>
            </div>
            <div className="flex gap-2" vid="18">
                <button className="text-textdim hover:text-textmain transition-colors" vid="19"><i className="ph ph-faders text-lg" vid="20"></i></button>
            </div>
        </header>

        
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3" vid="21">
            
            
            <div className="bg-charcoal-500 border border-charcoal-300 p-3 flex flex-col gap-3 hover:border-charcoal-100 transition-colors cursor-pointer group" vid="22">
                <div className="flex justify-between items-start" vid="23">
                    <div className="font-mono text-sm text-textmain font-medium" vid="24">SP-9942-X</div>
                    <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-emerald-950/30 border border-emerald-900/50" vid="25">
                        <div className="w-1.5 h-1.5 bg-emerald-500" vid="26"></div>
                        <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-400" vid="27">Working</span>
                    </div>
                </div>
                
                <div className="w-full h-40 bg-void border border-charcoal-200 relative overflow-hidden flex items-center justify-center" vid="28">
                    <div className="absolute inset-0 bg-gradient-to-b from-charcoal-500 to-void opacity-50" vid="29"></div>
                    <i className="ph ph-aperture text-charcoal-200 text-4xl z-10" vid="30"></i>
                    <div className="absolute bottom-2 left-2 font-mono text-[9px] text-textdim z-10" vid="31">OPTICAL_SCAN</div>
                </div>
                <div className="text-xs text-textmain leading-snug tracking-tight" vid="32">Pangolin scale articulation model</div>
                <div className="flex flex-col gap-2 mt-1" vid="33">
                    <div className="flex items-center gap-1.5 text-textmuted" vid="34">
                        <i className="ph ph-crosshair text-xs" vid="35"></i>
                        <span className="font-mono text-[10px]" vid="36">unknown</span>
                    </div>
                    <div className="flex gap-2" vid="37">
                        <span className="font-mono text-[9px] text-textdim" vid="38">[biomech]</span>
                        <span className="font-mono text-[9px] text-textdim" vid="39">[armor]</span>
                        <span className="font-mono text-[9px] text-textdim" vid="40">[kinematics]</span>
                    </div>
                </div>
            </div>

            
            <div className="bg-charcoal-500 border border-charcoal-300 p-3 flex flex-col gap-3 hover:border-charcoal-100 transition-colors cursor-pointer group" vid="41">
                <div className="flex justify-between items-start" vid="42">
                    <div className="font-mono text-sm text-textmain font-medium" vid="43">SP-9943-Y</div>
                    <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-amber-950/30 border border-amber-900/50" vid="44">
                        <div className="w-1.5 h-1.5 bg-amber-500" vid="45"></div>
                        <span className="font-mono text-[9px] uppercase tracking-wider text-amber-400" vid="46">Raw</span>
                    </div>
                </div>
                <div className="w-full h-40 bg-void border border-charcoal-200 relative overflow-hidden flex items-center justify-center" vid="47">
                    <div className="absolute inset-0 bg-gradient-to-b from-charcoal-500 to-void opacity-50" vid="48"></div>
                    <i className="ph ph-drop text-charcoal-200 text-4xl z-10" vid="49"></i>
                    <div className="absolute bottom-2 left-2 font-mono text-[9px] text-textdim z-10" vid="50">FIELD_SAMPLE</div>
                </div>
                <div className="text-xs text-textmain leading-snug tracking-tight" vid="51">Cephalopod chromatophore isolation</div>
                <div className="flex flex-col gap-2 mt-1" vid="52">
                    <div className="flex items-center gap-1.5 text-textmuted" vid="53">
                        <i className="ph ph-crosshair text-xs" vid="54"></i>
                        <span className="font-mono text-[10px]" vid="55">14.5995, 120.9842</span>
                    </div>
                    <div className="flex gap-2" vid="56">
                        <span className="font-mono text-[9px] text-textdim" vid="57">[optics]</span>
                        <span className="font-mono text-[9px] text-textdim" vid="58">[tissue]</span>
                        <span className="font-mono text-[9px] text-textdim" vid="59">[fluid-dyn]</span>
                    </div>
                </div>
            </div>

            
            <div className="bg-charcoal-500 border border-charcoal-300 p-3 flex flex-col gap-3 hover:border-charcoal-100 transition-colors cursor-pointer group" vid="60">
                <div className="flex justify-between items-start" vid="61">
                    <div className="font-mono text-sm text-textmain font-medium" vid="62">SP-9940-A</div>
                    <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-cyan-950/30 border border-cyan-900/50" vid="63">
                        <div className="w-1.5 h-1.5 bg-cyan-500" vid="64"></div>
                        <span className="font-mono text-[9px] uppercase tracking-wider text-cyan-400" vid="65">Filed</span>
                    </div>
                </div>
                <div className="w-full h-40 bg-void border border-charcoal-200 relative overflow-hidden flex items-center justify-center" vid="66">
                    <div className="absolute inset-0 bg-gradient-to-b from-charcoal-500 to-void opacity-50" vid="67"></div>
                    <i className="ph ph-leaf text-charcoal-200 text-4xl z-10" vid="68"></i>
                    <div className="absolute bottom-2 left-2 font-mono text-[9px] text-textdim z-10" vid="69">SEM_CAST</div>
                </div>
                <div className="text-xs text-textmain leading-snug tracking-tight" vid="70">Lotus leaf micro-texture casts</div>
                <div className="flex flex-col gap-2 mt-1" vid="71">
                    <div className="flex items-center gap-1.5 text-textmuted" vid="72">
                        <i className="ph ph-crosshair text-xs" vid="73"></i>
                        <span className="font-mono text-[10px]" vid="74">unknown</span>
                    </div>
                    <div className="flex gap-2" vid="75">
                        <span className="font-mono text-[9px] text-textdim" vid="76">[hydrophobic]</span>
                        <span className="font-mono text-[9px] text-textdim" vid="77">[surface]</span>
                        <span className="font-mono text-[9px] text-textdim" vid="78">[SEM]</span>
                    </div>
                </div>
            </div>

            
            <div className="bg-charcoal-500 border border-charcoal-300 p-3 flex flex-col gap-3 hover:border-charcoal-100 transition-colors cursor-pointer group" vid="79">
                <div className="flex justify-between items-start" vid="80">
                    <div className="font-mono text-sm text-textmain font-medium" vid="81">SP-9938-D</div>
                    <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-rose-950/30 border border-rose-900/50" vid="82">
                        <div className="w-1.5 h-1.5 bg-rose-500" vid="83"></div>
                        <span className="font-mono text-[9px] uppercase tracking-wider text-rose-400" vid="84">Dead</span>
                    </div>
                </div>
                <div className="w-full h-40 bg-void border border-charcoal-200 relative overflow-hidden flex items-center justify-center" vid="85">
                    <div className="absolute inset-0 bg-gradient-to-b from-charcoal-500 to-void opacity-50" vid="86"></div>
                    <i className="ph ph-warning-octagon text-charcoal-200 text-4xl z-10" vid="87"></i>
                    <div className="absolute bottom-2 left-2 font-mono text-[9px] text-textdim z-10" vid="88">FAILED_ASSET</div>
                </div>
                <div className="text-xs text-textmain leading-snug tracking-tight" vid="89">Moth eye nano-pillar degradation</div>
                <div className="flex flex-col gap-2 mt-1" vid="90">
                    <div className="flex items-center gap-1.5 text-textmuted" vid="91">
                        <i className="ph ph-crosshair text-xs" vid="92"></i>
                        <span className="font-mono text-[10px]" vid="93">-15.322, 45.112</span>
                    </div>
                    <div className="flex gap-2" vid="94">
                        <span className="font-mono text-[9px] text-textdim" vid="95">[photonic]</span>
                        <span className="font-mono text-[9px] text-textdim" vid="96">[decay]</span>
                        <span className="font-mono text-[9px] text-textdim" vid="97">[failure-an]</span>
                    </div>
                </div>
            </div>
            
            
            <div className="bg-charcoal-500 border border-charcoal-300 p-3 flex flex-col gap-3 hover:border-charcoal-100 transition-colors cursor-pointer group" vid="98">
                <div className="flex justify-between items-start" vid="99">
                    <div className="font-mono text-sm text-textmain font-medium" vid="100">SP-9945-Z</div>
                    <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-emerald-950/30 border border-emerald-900/50" vid="101">
                        <div className="w-1.5 h-1.5 bg-emerald-500" vid="102"></div>
                        <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-400" vid="103">Working</span>
                    </div>
                </div>
                <div className="w-full h-40 bg-void border border-charcoal-200 relative overflow-hidden flex items-center justify-center" vid="104">
                    <div className="absolute inset-0 bg-gradient-to-b from-charcoal-500 to-void opacity-50" vid="105"></div>
                    <i className="ph ph-paw-prints text-charcoal-200 text-4xl z-10" vid="106"></i>
                    <div className="absolute bottom-2 left-2 font-mono text-[9px] text-textdim z-10" vid="107">STRESS_TEST</div>
                </div>
                <div className="text-xs text-textmain leading-snug tracking-tight" vid="108">Gecko seta adhesion stress test</div>
                <div className="flex flex-col gap-2 mt-1" vid="109">
                    <div className="flex items-center gap-1.5 text-textmuted" vid="110">
                        <i className="ph ph-crosshair text-xs" vid="111"></i>
                        <span className="font-mono text-[10px]" vid="112">unknown</span>
                    </div>
                    <div className="flex gap-2" vid="113">
                        <span className="font-mono text-[9px] text-textdim" vid="114">[vdw-force]</span>
                        <span className="font-mono text-[9px] text-textdim" vid="115">[tensile]</span>
                        <span className="font-mono text-[9px] text-textdim" vid="116">[adhesion]</span>
                    </div>
                </div>
            </div>

            
            <div className="bg-charcoal-500 border border-charcoal-300 p-3 flex flex-col gap-3 hover:border-charcoal-100 transition-colors cursor-pointer group" vid="117">
                <div className="flex justify-between items-start" vid="118">
                    <div className="font-mono text-sm text-textmain font-medium" vid="119">SP-9946-W</div>
                    <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-amber-950/30 border border-amber-900/50" vid="120">
                        <div className="w-1.5 h-1.5 bg-amber-500" vid="121"></div>
                        <span className="font-mono text-[9px] uppercase tracking-wider text-amber-400" vid="122">Raw</span>
                    </div>
                </div>
                <div className="w-full h-40 bg-void border border-charcoal-200 relative overflow-hidden flex items-center justify-center" vid="123">
                    <div className="absolute inset-0 bg-gradient-to-b from-charcoal-500 to-void opacity-50" vid="124"></div>
                    <i className="ph ph-bird text-charcoal-200 text-4xl z-10" vid="125"></i>
                    <div className="absolute bottom-2 left-2 font-mono text-[9px] text-textdim z-10" vid="126">HYDRO_SIM</div>
                </div>
                <div className="text-xs text-textmain leading-snug tracking-tight" vid="127">Kingfisher beak penetration hydrodynamics</div>
                <div className="flex flex-col gap-2 mt-1" vid="128">
                    <div className="flex items-center gap-1.5 text-textmuted" vid="129">
                        <i className="ph ph-crosshair text-xs" vid="130"></i>
                        <span className="font-mono text-[10px]" vid="131">51.5074, -0.1278</span>
                    </div>
                    <div className="flex gap-2" vid="132">
                        <span className="font-mono text-[9px] text-textdim" vid="133">[fluidic]</span>
                        <span className="font-mono text-[9px] text-textdim" vid="134">[impact]</span>
                        <span className="font-mono text-[9px] text-textdim" vid="135">[morphology]</span>
                    </div>
                </div>
            </div>
        </div>
    </aside>

    
    <main className="flex-1 flex flex-col bg-charcoal-600 relative z-10 min-w-0" vid="136">
        
        
        <div className="h-32 border-b border-charcoal-300 p-4 shrink-0 bg-void relative z-20" vid="137">
            <div className="w-full h-full border border-dashed border-charcoal-200 bg-charcoal-600 hover:bg-charcoal-500 hover:border-textdim transition-all cursor-crosshair flex flex-col items-center justify-center gap-2 group corner-brackets" vid="138">
                <i className="ph ph-scan text-textdim text-2xl group-hover:text-cyan-500 transition-colors" vid="139"></i>
                <span className="font-mono text-[11px] text-textdim uppercase tracking-[0.2em] group-hover:text-cyan-400 transition-colors" vid="140">Initiate Intake Sequence // Drop Telemetry Data</span>
            </div>
        </div>

        
        <div className="flex-1 flex min-h-0" vid="141">
            
            
            <div className="flex-1 border-r border-charcoal-300 p-6 flex flex-col relative overflow-hidden bg-void" vid="142">
                
                <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" vid="143"></div>

                
                <header className="flex justify-between items-start mb-6 z-10" vid="144">
                    <div vid="145">
                        <h1 className="font-mono text-3xl text-textmain tracking-tight" vid="146">SP-9942-X</h1>
                        <p className="font-sans text-textmuted mt-1 tracking-tight text-sm" vid="147">Pangolin scale articulation model</p>
                    </div>
                    <div className="flex gap-3" vid="148">
                        <button className="px-4 py-1.5 bg-void border border-charcoal-200 text-textmuted hover:text-textmain hover:border-charcoal-100 font-mono text-[11px] uppercase tracking-widest transition-colors" vid="149">Export DB</button>
                        <button className="px-4 py-1.5 bg-void border border-emerald-900/50 text-emerald-500 hover:bg-emerald-950/20 hover:border-emerald-700 font-mono text-[11px] uppercase tracking-widest transition-colors" vid="150">Run Sim</button>
                    </div>
                </header>

                
                <div className="flex-1 border border-charcoal-300 bg-void relative flex items-center justify-center overflow-hidden z-10 corner-brackets" vid="151">
                    
                    
                    <div className="absolute top-3 left-3 font-mono text-[10px] text-textdim" vid="152">VIEWPORT_XZ</div>
                    <div className="absolute top-3 right-3 font-mono text-[10px] text-textdim" vid="153">MAG: 400x</div>
                    <div className="absolute bottom-3 left-3 font-mono text-[10px] text-textdim flex items-center gap-2" vid="154">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" vid="155"></div>
                        ACTIVE_RENDER
                    </div>
                    <div className="absolute bottom-3 right-3 font-mono text-[10px] text-textdim" vid="156">R: 0.992</div>

                    
                    <div className="relative w-[400px] h-[400px] flex items-center justify-center" vid="157">
                        
                        <div className="absolute inset-0 border border-dashed border-charcoal-200 rounded-full animate-[spin_60s_linear_infinite] opacity-50" vid="158"></div>
                        
                        <div className="absolute inset-8 border border-charcoal-300 rounded-full flex items-center justify-center" vid="159">
                            <svg width="240" height="240" viewBox="0 0 100 100" className="text-charcoal-200 fill-none stroke-current opacity-80" strokeWidth="0.5" vid="160">
                                <path d="M50 10 L90 30 L90 70 L50 90 L10 70 L10 30 Z" strokeDasharray="2 2" className="animate-[spin_40s_linear_infinite_reverse] origin-center" vid="161"></path>
                                <path d="M50 20 L80 35 L80 65 L50 80 L20 65 L20 35 Z" vid="162"></path>
                                <path d="M50 30 L70 40 L70 60 L50 70 L30 60 L30 40 Z" strokeDasharray="1 3" vid="163"></path>
                                <circle cx="50" cy="50" r="10" className="stroke-emerald-900" vid="164"></circle>
                                <line x1="50" y1="10" x2="50" y2="90" strokeOpacity="0.5" vid="165"></line>
                                <line x1="10" y1="30" x2="90" y2="70" strokeOpacity="0.5" vid="166"></line>
                                <line x1="10" y1="70" x2="90" y2="30" strokeOpacity="0.5" vid="167"></line>
                            </svg>
                        </div>
                        
                        <div className="w-1 h-1 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] z-20" vid="168"></div>
                    </div>
                </div>
            </div>

            
            <div className="w-[340px] shrink-0 bg-void flex flex-col z-20" vid="169">
                <div className="h-10 border-b border-charcoal-300 flex items-center px-4 shrink-0 bg-charcoal-600" vid="170">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-textmuted" vid="171">Properties Log</span>
                </div>
                
                <div className="flex-1 p-5 space-y-8 overflow-y-auto custom-scrollbar" vid="172">
                    
                    
                    <div className="space-y-3" vid="173">
                        <div className="flex items-center justify-between border-b border-charcoal-300 pb-1.5" vid="174">
                            <span className="font-mono text-[10px] uppercase tracking-widest text-textdim" vid="175">Classification</span>
                            <i className="ph ph-dna text-textdim" vid="176"></i>
                        </div>
                        <div className="space-y-1.5 font-mono text-xs" vid="177">
                            <div className="flex justify-between" vid="178">
                                <span className="text-textmuted" vid="179">Phylum</span>
                                <span className="text-textmain" vid="180">Chordata</span>
                            </div>
                            <div className="flex justify-between" vid="181">
                                <span className="text-textmuted" vid="182">Class</span>
                                <span className="text-textmain" vid="183">Mammalia</span>
                            </div>
                            <div className="flex justify-between" vid="184">
                                <span className="text-textmuted" vid="185">Order</span>
                                <span className="text-textmain" vid="186">Pholidota</span>
                            </div>
                            <div className="flex justify-between" vid="187">
                                <span className="text-textmuted" vid="188">Family</span>
                                <span className="text-textmain" vid="189">Manidae</span>
                            </div>
                        </div>
                    </div>

                    
                    <div className="space-y-3" vid="190">
                        <div className="flex items-center justify-between border-b border-charcoal-300 pb-1.5" vid="191">
                            <span className="font-mono text-[10px] uppercase tracking-widest text-textdim" vid="192">Structural Metrics</span>
                            <i className="ph ph-hexagon text-textdim" vid="193"></i>
                        </div>
                        <div className="space-y-1.5 font-mono text-xs" vid="194">
                            <div className="flex justify-between" vid="195">
                                <span className="text-textmuted" vid="196">Tensile_Str</span>
                                <span className="text-textmain" vid="197">120.4 MPa</span>
                            </div>
                            <div className="flex justify-between" vid="198">
                                <span className="text-textmuted" vid="199">Density</span>
                                <span className="text-textmain" vid="200">1.33 g/cm³</span>
                            </div>
                            <div className="flex justify-between" vid="201">
                                <span className="text-textmuted" vid="202">Hardness_HV</span>
                                <span className="text-textmain" vid="203">450</span>
                            </div>
                            <div className="flex justify-between" vid="204">
                                <span className="text-textmuted" vid="205">Overlap_Idx</span>
                                <span className="text-textmain" vid="206">0.85</span>
                            </div>
                        </div>
                        <div className="mt-2 p-2 bg-charcoal-500 border border-charcoal-300 font-mono text-[10px] text-emerald-400 flex items-start gap-2" vid="207">
                            <i className="ph ph-check-circle mt-0.5" vid="208"></i>
                            <span vid="209">Metrics within standard operational parameters for armor analogs.</span>
                        </div>
                    </div>

                    
                    <div className="space-y-3" vid="210">
                        <div className="flex items-center justify-between border-b border-charcoal-300 pb-1.5" vid="211">
                            <span className="font-mono text-[10px] uppercase tracking-widest text-textdim" vid="212">Observation Log</span>
                            <i className="ph ph-terminal-window text-textdim" vid="213"></i>
                        </div>
                        <div className="font-sans text-xs text-textmuted leading-relaxed tracking-tight space-y-3" vid="214">
                            <p vid="215">
                                Scales demonstrate highly ordered overlapping keratin matrices. Structural flexibility is perfectly maintained during defensive curling posturing while resisting lateral puncture vectors.
                            </p>
                            <p vid="216">
                                Analysis of scale edges suggests a self-sharpening mechanism under constant abrasion, highly relevant for dynamic excavation tools.
                            </p>
                        </div>
                        <div className="font-mono text-[10px] text-textdim border-t border-charcoal-300 pt-2 flex justify-between" vid="217">
                            <span vid="218">LAST_UPDATED</span>
                            <span vid="219">2024-10-24 14:32</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </main>


    </div>
    </div>
  );
}
