"""Command line entrypoint for the FRKNK SDR lab."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Annotated

import typer

from sdr_lab.iq import SyntheticNeedleSpec
from sdr_lab.locator import (
    SketchLocatorConfig,
    artifact_payload,
    build_synthetic_locator_artifacts,
    write_locator_artifacts,
)
from sdr_lab.openhpsdr import make_emulator

app = typer.Typer(help="FRKNK SDR proving ground")

DEFAULT_SKETCH_DEMO_OUTPUT_DIR = Path("reports/sketch-demo")


@app.callback()
def _root() -> None:
    """FRKNK SDR proving ground."""


@app.command("hermes-emulator")
def hermes_emulator(
    host: str = typer.Option("0.0.0.0", help="Address to bind."),
    port: int = typer.Option(1024, help="Metis/OpenHPSDR UDP port."),
    sample_rate_hz: int = typer.Option(48_000, help="Generated IQ sample rate."),
    center_frequency_hz: int = typer.Option(7_100_000, help="Nominal RF center frequency."),
    tone_offset_hz: float = typer.Option(1_200.0, help="Synthetic carrier offset from center."),
    amplitude: float = typer.Option(0.2, help="Synthetic tone amplitude in [-1, 1]."),
    noise: float = typer.Option(0.0, help="Complex Gaussian noise standard deviation."),
    seed: int = typer.Option(7, help="Noise RNG seed."),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Log protocol events."),
) -> None:
    """Run a receive-only fake Hermes-Lite/OpenHPSDR radio for Quisk."""

    emulator = make_emulator(
        host=host,
        port=port,
        sample_rate_hz=sample_rate_hz,
        center_frequency_hz=center_frequency_hz,
        tone_offset_hz=tone_offset_hz,
        amplitude=amplitude,
        noise=noise,
        seed=seed,
        verbose=verbose,
    )
    try:
        emulator.serve_forever()
    except KeyboardInterrupt:
        print("\n[frknk] Hermes emulator stopped")


@app.command()
def smoke() -> None:
    """Run a tiny synthetic IQ → sketch → candidate → suggestion smoke pipeline."""

    artifacts = build_synthetic_locator_artifacts()
    print(json.dumps(artifact_payload(artifacts), indent=2))


@app.command("sketch-demo")
def sketch_demo(
    output_dir: Annotated[
        Path,
        typer.Option(
            "--output-dir",
            "-o",
            help="Directory for JSON and NumPy artifacts.",
        ),
    ] = DEFAULT_SKETCH_DEMO_OUTPUT_DIR,
    center_frequency_hz: float = typer.Option(7_100_000.0, help="Nominal RF center frequency."),
    sample_rate_hz: float = typer.Option(48_000.0, help="Synthetic IQ sample rate."),
    duration_seconds: float = typer.Option(1.0, help="Synthetic IQ duration."),
    tone_offset_hz: float = typer.Option(1_200.0, help="Tone offset from center."),
    snr_db: float = typer.Option(-6.0, help="Tone SNR in dB."),
    seed: int = typer.Option(7, help="Synthetic noise seed."),
    bins_time: int = typer.Option(32, help="Sketch time bins."),
    bins_frequency: int = typer.Option(64, help="Sketch frequency bins."),
) -> None:
    """Write deterministic offline sketch-locator artifacts."""

    artifacts = build_synthetic_locator_artifacts(
        spec=SyntheticNeedleSpec(
            sample_rate_hz=sample_rate_hz,
            duration_seconds=duration_seconds,
            tone_offset_hz=tone_offset_hz,
            snr_db=snr_db,
            seed=seed,
        ),
        config=SketchLocatorConfig(
            center_frequency_hz=center_frequency_hz,
            bins_time=bins_time,
            bins_frequency=bins_frequency,
        ),
    )
    paths = write_locator_artifacts(output_dir, artifacts)
    print(json.dumps({"outputDir": str(output_dir), "paths": paths}, indent=2))


def main() -> None:
    app()


if __name__ == "__main__":
    main()
