# Research: Muse 2 EEG-to-OSC pipelines

## Summary
The best-supported current path is **MuseLSL2 or muselsl for acquisition, then `muse-osc` for OSC export**. If you want a more self-contained script, **DrBrule/EEGStreamer** is the clearest direct Muse 2 → OSC package I found. The older Mind Monitor-based scripts still work as lightweight bridges, but they are clearly legacy.

## Findings
1. **`muselsl` + `muse-osc` is the most explicit cross-platform pipeline** — `muselsl` supports **macOS, Linux, and Windows** and is documented for Muse 2; `muse-osc` then reads the LSL stream and forwards OSC. Install: `pipx install muselsl` (or `pip install -r requirements.txt && pip install muselsl` for `muse-osc`). Run: `muselsl stream` then `python -m muse-osc`. OSC addresses: `/muse/eeg`, `/muse/eeg/tp9`, `/muse/eeg/af7`, `/muse/eeg/af8`, `/muse/eeg/tp10`, `/muse/eeg/aux`, plus `/muse/elements/{delta|theta|alpha|beta}_absolute`; default OSC target is `localhost:4545`. [muselsl README](https://github.com/alexandrebarachant/muse-lsl) · [muse-osc README](https://github.com/operatorequals/muse-osc)
2. **`DrBrule/EEGStreamer` is the closest self-contained Muse 2 → OSC script** — it advertises a one-command path: `python __muse_monitor.py__ --EZ --osc` (project script name in `pyproject.toml`: `musemonitor`). The Muse OSC output in code uses `/eeg` and `/prc` on port **9807**; the package also ships a receiver mode for those paths. Dependencies show Python **3.7+** and `muselsl==2.2.2`; install/dev setup is `pip install -e .` (or `pip install -e .'[dev]'`). Platform support is not explicitly matrixed, but the docs lean on `muselsl` plus BLED112/macOS/Linux setup notes. [README](https://github.com/DrBrule/EEGStreamer) · [pyproject](https://raw.githubusercontent.com/DrBrule/EEGStreamer/main/pyproject.toml) · [muse monitor code](https://raw.githubusercontent.com/DrBrule/EEGStreamer/main/src/eegstreamer/__muse_monitor__.py) · [OSC output code](https://raw.githubusercontent.com/DrBrule/EEGStreamer/main/src/eegstreamer/outputs.py)
3. **`lched/muse_tools` is a compact LSL→OSC bridge for Muse 2** — the repo says it works with Muse 2 and its `muse_to_osc.py` reads all available LSL streams, then emits OSC. Raw stream addresses are `/muse/{stream.type().lower()}`; EEG FFT/features are `/muse/eeg_fft` and `/muse/features/{alpha|beta|theta|delta|gamma}_{absolute|relative}`. Run: `python muse_to_osc.py` (optional `--aux`). Maintenance looks light: last push was 2023-08. [README](https://github.com/lched/muse_tools) · [code](https://raw.githubusercontent.com/lched/muse_tools/main/muse_to_osc.py)
4. **`naxocaballero/muse2-neuromore` is a legacy Mind Monitor OSC splitter** — it requires Mind Monitor/Muse Monitor to send OSC to a local Python receiver, then forwards to Neuromore. Run one of two scripts: `python muse_average.py` (average-only OSC stream) or `python muse_absolute.py` (all-values OSC stream). It forwards EEG electrodes to `/muse/eeg/tp9`, `/muse/eeg/af7`, `/muse/eeg/af8`, `/muse/eeg/tp10`, `/muse/eeg/fpz`, and band powers to `/muse/elements/{alpha|beta|delta|theta|gamma}_absolute[...]`. Last push was 2019, so this is functional but clearly stale. [README](https://github.com/naxocaballero/muse2-neuromore) · [absolute script](https://raw.githubusercontent.com/naxocaballero/muse2-neuromore/master/muse_absolute.py) · [average script](https://raw.githubusercontent.com/naxocaballero/muse2-neuromore/master/muse_average.py)
5. **`DominiqueMakowski/MuseLSL2` is the best maintained acquisition fork to pair with OSC bridges** — it is a light reimplementation of `muse-lsl` with fixes, installable via `pip install https://github.com/DominiqueMakowski/MuseLSL2/zipball/main`, and run with `MuseLSL2 find` then `MuseLSL2 stream --address ...`. It does **not** itself output OSC, but `muse-osc` explicitly lists it as a supported connector, and its maintenance is much fresher (last push 2025-10 in repo metadata). [MuseLSL2 README](https://github.com/DominiqueMakowski/MuseLSL2) · [muse-osc README](https://github.com/operatorequals/muse-osc)

## Sources
- Kept: `muselsl` / `muse-lsl` — canonical Muse 2 acquisition docs and platform support. https://github.com/alexandrebarachant/muse-lsl
- Kept: `muse-osc` — explicit LSL→OSC bridge and Mind Monitor-like OSC paths. https://github.com/operatorequals/muse-osc
- Kept: `EEGStreamer` — direct Muse 2→OSC path with concrete code and run command. https://github.com/DrBrule/EEGStreamer
- Kept: `muse_tools` — concise LSL→OSC bridge with feature paths. https://github.com/lched/muse_tools
- Kept: `muse2-neuromore` — legacy OSC splitter with exact forward paths. https://github.com/naxocaballero/muse2-neuromore
- Kept: `MuseLSL2` — maintained acquisition fork suitable for the first stage of the pipeline. https://github.com/DominiqueMakowski/MuseLSL2
- Dropped: `majorcob/musedirect` — OSC **consumer** for Muse Direct, not a Muse 2→OSC streamer. https://github.com/majorcob/musedirect
- Dropped: `krpouncy/PyMuse` — Mind Monitor OSC **receiver** for app-side consumption, not a forwarding pipeline. https://github.com/krpouncy/PyMuse
- Dropped: `rizaru22/muse-pythonOSC` — analysis/receiver-oriented repo; no clear OSC export pipeline. https://github.com/rizaru22/muse-pythonOSC
- Dropped: `BlueMuse` — LSL GUI only; useful as acquisition layer, but not an OSC streamer. https://github.com/kowalej/BlueMuse

## Gaps
- Several repos do not document a clean OS matrix; I only marked platform support when the source said it outright.
- `muse-osc`, `muse_tools`, and `muse2-neuromore` are all small enough that long-term maintenance is uncertain even when last push dates are recent.
- I did not find an actively maintained, direct Muse 2→OSC app that completely replaces both acquisition and OSC export without a bridge step.

## Recommended first path
Use **MuseLSL2 (or muselsl)** to acquire Muse 2 data, then **`muse-osc`** to emit OSC. It’s the most explicit, cross-platform, and source-documented route, with OSC paths that line up with Mind Monitor-style consumers.
