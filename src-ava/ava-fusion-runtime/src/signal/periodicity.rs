//! FFT-based periodicity detection and cross-spectral similarity.
//!
//! Detects periodic patterns in entity behavior by computing power spectral
//! density (periodogram) from time series data. Cross-spectral similarity
//! identifies entities with matching periodic signatures.
//!
//! Two algorithms:
//! - **FFT periodogram**: For uniformly-sampled data (via `realfft` for 2x
//!   speedup on real-valued sensor data).
//! - **Lomb-Scargle periodogram**: For irregularly-sampled data (native
//!   timestamp series). Custom implementation — no pure-Rust crate exists
//!   without a heavy FFTW native dependency.
//!
//! Peak detection uses [`find_peaks`](https://crates.io/crates/find_peaks)
//! (2.5M downloads) with prominence-based filtering — far superior to naive
//! local-max detection in noisy spectra.
//!
//! Reference: Synthesis §3A (Tier3Method::Periodicity).

use find_peaks::PeakFinder;
use realfft::RealFftPlanner;
use std::f64::consts::PI;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/// Configuration for periodicity detection.
#[derive(Debug, Clone)]
pub struct PeriodicityConfig {
    /// Minimum detectable period in milliseconds.
    pub min_period_ms: f64,
    /// Maximum detectable period in milliseconds.
    pub max_period_ms: f64,
    /// Significance threshold: peak prominence must exceed this multiple
    /// of the mean spectral power to be considered significant.
    /// Typical: 3.0-5.0 (SNR ratio).
    pub significance_threshold: f64,
}

impl Default for PeriodicityConfig {
    fn default() -> Self {
        Self {
            min_period_ms: 1_000.0,        // 1 second
            max_period_ms: 3_600_000.0,     // 1 hour
            significance_threshold: 4.0,
        }
    }
}

// ---------------------------------------------------------------------------
// Periodogram result
// ---------------------------------------------------------------------------

/// A single detected periodic peak.
#[derive(Debug, Clone)]
pub struct SpectralPeak {
    /// Period in milliseconds.
    pub period_ms: f64,
    /// Frequency in Hz.
    pub frequency_hz: f64,
    /// Spectral power (magnitude squared).
    pub power: f64,
    /// Signal-to-noise ratio (peak power / mean power).
    pub snr: f64,
}

/// Result of periodogram computation.
#[derive(Debug, Clone)]
pub struct Periodogram {
    /// Frequency bins in Hz.
    pub frequencies: Vec<f64>,
    /// Power spectral density at each frequency bin.
    pub powers: Vec<f64>,
    /// Detected peaks above the significance threshold.
    pub peaks: Vec<SpectralPeak>,
    /// Sampling rate used (Hz).
    pub sample_rate_hz: f64,
}

// ---------------------------------------------------------------------------
// FFT periodogram (uniformly-sampled) — via realfft
// ---------------------------------------------------------------------------

/// Compute the power spectral density via real-valued FFT.
///
/// Uses `realfft` which exploits Hermitian symmetry of real data for ~2x
/// speedup over complex FFT. Input: uniformly-sampled time series values.
///
/// Returns a Periodogram with frequency bins, powers, and detected peaks.
pub fn fft_periodogram(
    values: &[f64],
    sample_rate_hz: f64,
    config: &PeriodicityConfig,
) -> Periodogram {
    let n = values.len();
    if n < 4 {
        return Periodogram {
            frequencies: Vec::new(),
            powers: Vec::new(),
            peaks: Vec::new(),
            sample_rate_hz,
        };
    }

    // Build the real-to-complex FFT plan.
    let mut planner = RealFftPlanner::<f64>::new();
    let r2c = planner.plan_fft_forward(n);

    // Allocate buffers via the planner (correct sizes guaranteed).
    let mut indata = r2c.make_input_vec();
    let mut spectrum = r2c.make_output_vec();

    // Copy values with Hann window applied.
    let n_f = n as f64;
    for (i, sample) in indata.iter_mut().enumerate() {
        let window = 0.5 * (1.0 - (2.0 * PI * i as f64 / n_f).cos());
        *sample = if i < n { values[i] * window } else { 0.0 };
    }

    // Execute real-to-complex FFT.
    r2c.process(&mut indata, &mut spectrum)
        .expect("realfft: buffer size mismatch");

    // Compute one-sided power spectrum from complex output.
    // spectrum has N/2+1 elements (DC through Nyquist).
    let n_positive = spectrum.len() - 1; // skip DC (index 0)
    let freq_resolution = sample_rate_hz / n_f;

    let mut frequencies = Vec::with_capacity(n_positive);
    let mut powers = Vec::with_capacity(n_positive);

    for i in 1..spectrum.len() {
        let freq = i as f64 * freq_resolution;
        let mag_sq = spectrum[i].norm_sqr() / (n_f * n_f);
        // Double the power for one-sided spectrum (except Nyquist).
        let power = if i < spectrum.len() - 1 {
            2.0 * mag_sq
        } else {
            mag_sq
        };

        frequencies.push(freq);
        powers.push(power);
    }

    // Detect peaks using prominence-based find_peaks.
    let peaks = detect_peaks(&frequencies, &powers, config);

    Periodogram {
        frequencies,
        powers,
        peaks,
        sample_rate_hz,
    }
}

// ---------------------------------------------------------------------------
// Lomb-Scargle periodogram (irregularly-sampled)
// ---------------------------------------------------------------------------

/// Compute the Lomb-Scargle periodogram for irregularly-sampled data.
///
/// Input: pairs of (timestamp_ms, value). Does NOT require uniform sampling.
/// Evaluates spectral power at a set of test frequencies between
/// `1/max_period` and `1/min_period`.
///
/// Custom implementation — the only Rust Lomb-Scargle crate
/// (`light-curve-feature`) requires FFTW as a native dependency. This is
/// textbook math that doesn't benefit from external crate wrapping.
pub fn lomb_scargle(
    timestamps_ms: &[f64],
    values: &[f64],
    config: &PeriodicityConfig,
    n_frequencies: usize,
) -> Periodogram {
    let n = timestamps_ms.len();
    if n < 4 || n != values.len() {
        return Periodogram {
            frequencies: Vec::new(),
            powers: Vec::new(),
            peaks: Vec::new(),
            sample_rate_hz: 0.0,
        };
    }

    // Remove mean.
    let mean = values.iter().sum::<f64>() / n as f64;
    let centered: Vec<f64> = values.iter().map(|&v| v - mean).collect();

    // Convert timestamps to seconds.
    let t_sec: Vec<f64> = timestamps_ms.iter().map(|&t| t / 1000.0).collect();

    // Frequency grid: linearly spaced from f_min to f_max.
    let f_min = 1000.0 / config.max_period_ms; // Hz
    let f_max = 1000.0 / config.min_period_ms;  // Hz
    let n_freq = n_frequencies.max(4);
    let df = (f_max - f_min) / (n_freq - 1) as f64;

    let mut frequencies = Vec::with_capacity(n_freq);
    let mut powers = Vec::with_capacity(n_freq);

    // Variance for normalization.
    let variance: f64 = centered.iter().map(|&v| v * v).sum::<f64>() / (n - 1) as f64;
    if variance < 1e-30 {
        // Constant signal — no periodicity.
        return Periodogram {
            frequencies: Vec::new(),
            powers: Vec::new(),
            peaks: Vec::new(),
            sample_rate_hz: 0.0,
        };
    }

    for i in 0..n_freq {
        let freq = f_min + i as f64 * df;
        let omega = 2.0 * PI * freq;

        // Compute tau (time offset for orthogonality).
        let mut sin2_sum = 0.0;
        let mut cos2_sum = 0.0;
        for &t in &t_sec {
            sin2_sum += (2.0 * omega * t).sin();
            cos2_sum += (2.0 * omega * t).cos();
        }
        let tau = sin2_sum.atan2(cos2_sum) / (2.0 * omega);

        // Compute spectral power at this frequency.
        let mut cos_sum = 0.0;
        let mut sin_sum = 0.0;
        let mut cos2 = 0.0;
        let mut sin2 = 0.0;

        for (j, &t) in t_sec.iter().enumerate() {
            let phase = omega * (t - tau);
            let c = phase.cos();
            let s = phase.sin();
            cos_sum += centered[j] * c;
            sin_sum += centered[j] * s;
            cos2 += c * c;
            sin2 += s * s;
        }

        let power = if cos2 > 1e-30 && sin2 > 1e-30 {
            0.5 * ((cos_sum * cos_sum) / cos2 + (sin_sum * sin_sum) / sin2) / variance
        } else {
            0.0
        };

        frequencies.push(freq);
        powers.push(power);
    }

    // Estimate effective sample rate from median inter-arrival time.
    let mut intervals: Vec<f64> = t_sec.windows(2).map(|w| w[1] - w[0]).collect();
    intervals.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let median_dt = intervals[intervals.len() / 2];
    let sample_rate_hz = if median_dt > 1e-10 { 1.0 / median_dt } else { 0.0 };

    let peaks = detect_peaks(&frequencies, &powers, config);

    Periodogram {
        frequencies,
        powers,
        peaks,
        sample_rate_hz,
    }
}

// ---------------------------------------------------------------------------
// Peak detection — via find_peaks (prominence-based)
// ---------------------------------------------------------------------------

/// Detect significant peaks in a power spectrum using prominence filtering.
///
/// Uses `find_peaks` (2.5M downloads) for production-grade prominence-based
/// peak detection. Prominence measures how much a peak stands out from the
/// surrounding baseline — far more robust than naive local-max detection
/// in noisy spectra.
fn detect_peaks(
    frequencies: &[f64],
    powers: &[f64],
    config: &PeriodicityConfig,
) -> Vec<SpectralPeak> {
    if powers.is_empty() {
        return Vec::new();
    }

    let mean_power: f64 = powers.iter().sum::<f64>() / powers.len() as f64;
    if mean_power < 1e-30 {
        return Vec::new();
    }

    // Prominence threshold: peak must stand above its baseline by this amount.
    let min_prominence = config.significance_threshold * mean_power;

    let found = PeakFinder::new(powers)
        .with_min_prominence(min_prominence)
        .find_peaks();

    let mut peaks: Vec<SpectralPeak> = found
        .iter()
        .filter_map(|peak| {
            let idx = peak.position.start;
            if idx >= frequencies.len() {
                return None;
            }
            let freq = frequencies[idx];
            if freq <= 1e-30 {
                return None;
            }
            let period_ms = 1000.0 / freq;
            if period_ms < config.min_period_ms || period_ms > config.max_period_ms {
                return None;
            }
            Some(SpectralPeak {
                period_ms,
                frequency_hz: freq,
                power: powers[idx],
                snr: powers[idx] / mean_power,
            })
        })
        .collect();

    // Sort by power descending.
    peaks.sort_by(|a, b| b.power.partial_cmp(&a.power).unwrap_or(std::cmp::Ordering::Equal));
    peaks
}

// ---------------------------------------------------------------------------
// Cross-spectral similarity
// ---------------------------------------------------------------------------

/// Compute cross-spectral similarity between two periodograms.
///
/// Uses cosine similarity of the power spectra, restricted to the
/// overlapping frequency range. Returns a value in [0.0, 1.0] where
/// 1.0 indicates identical spectral shapes.
///
/// Both periodograms must have the same frequency bins (same length and
/// frequency resolution). If they differ, returns 0.0.
pub fn cross_spectral_similarity(a: &Periodogram, b: &Periodogram) -> f64 {
    if a.powers.len() != b.powers.len() || a.powers.is_empty() {
        return 0.0;
    }

    let mut dot = 0.0;
    let mut norm_a = 0.0;
    let mut norm_b = 0.0;

    for i in 0..a.powers.len() {
        dot += a.powers[i] * b.powers[i];
        norm_a += a.powers[i] * a.powers[i];
        norm_b += b.powers[i] * b.powers[i];
    }

    let denom = norm_a.sqrt() * norm_b.sqrt();
    if denom < 1e-30 {
        return 0.0;
    }

    (dot / denom).clamp(0.0, 1.0)
}

/// Check if two entities share a dominant periodic component.
///
/// Returns true if both periodograms have a significant peak within
/// `tolerance_hz` of each other.
pub fn share_dominant_period(
    a: &Periodogram,
    b: &Periodogram,
    tolerance_hz: f64,
) -> bool {
    if a.peaks.is_empty() || b.peaks.is_empty() {
        return false;
    }

    // Check if the strongest peak of each is within tolerance.
    let a_freq = a.peaks[0].frequency_hz;
    let b_freq = b.peaks[0].frequency_hz;
    (a_freq - b_freq).abs() <= tolerance_hz
}

// ---------------------------------------------------------------------------
// Resample helper (for FFT from irregular timestamps)
// ---------------------------------------------------------------------------

/// Resample irregularly-spaced data to uniform intervals via linear interpolation.
///
/// Produces `n_samples` evenly-spaced values covering the time range
/// `[timestamps[0], timestamps[last]]`.
///
/// Returns `(sample_rate_hz, resampled_values)`.
pub fn resample_uniform(
    timestamps_ms: &[f64],
    values: &[f64],
    n_samples: usize,
) -> Option<(f64, Vec<f64>)> {
    let n = timestamps_ms.len();
    if n < 2 || n != values.len() || n_samples < 2 {
        return None;
    }

    let t_start = timestamps_ms[0];
    let t_end = timestamps_ms[n - 1];
    let span = t_end - t_start;
    if span <= 0.0 {
        return None;
    }

    let dt = span / (n_samples - 1) as f64;
    let sample_rate_hz = 1000.0 / dt; // dt is in ms

    let mut result = Vec::with_capacity(n_samples);
    let mut src_idx = 0;

    for i in 0..n_samples {
        let t = t_start + i as f64 * dt;

        // Advance source index to bracket t.
        while src_idx + 1 < n && timestamps_ms[src_idx + 1] < t {
            src_idx += 1;
        }

        if src_idx + 1 >= n {
            result.push(values[n - 1]);
        } else {
            let t0 = timestamps_ms[src_idx];
            let t1 = timestamps_ms[src_idx + 1];
            let v0 = values[src_idx];
            let v1 = values[src_idx + 1];
            let frac = if (t1 - t0).abs() > 1e-15 {
                (t - t0) / (t1 - t0)
            } else {
                0.0
            };
            result.push(v0 + frac * (v1 - v0));
        }
    }

    Some((sample_rate_hz, result))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn make_sine(freq_hz: f64, sample_rate_hz: f64, n_samples: usize) -> Vec<f64> {
        (0..n_samples)
            .map(|i| (2.0 * PI * freq_hz * i as f64 / sample_rate_hz).sin())
            .collect()
    }

    fn make_sine_timestamps(
        freq_hz: f64,
        n_samples: usize,
        dt_ms: f64,
    ) -> (Vec<f64>, Vec<f64>) {
        let timestamps: Vec<f64> = (0..n_samples).map(|i| i as f64 * dt_ms).collect();
        let values: Vec<f64> = timestamps
            .iter()
            .map(|&t| (2.0 * PI * freq_hz * t / 1000.0).sin())
            .collect();
        (timestamps, values)
    }

    // -- FFT periodogram (realfft) --

    #[test]
    fn fft_detects_single_frequency() {
        // 5 Hz sine wave sampled at 100 Hz for 256 samples.
        let values = make_sine(5.0, 100.0, 256);
        let config = PeriodicityConfig {
            min_period_ms: 10.0,     // 100 Hz max frequency
            max_period_ms: 10_000.0, // 0.1 Hz min frequency
            significance_threshold: 3.0,
        };
        let result = fft_periodogram(&values, 100.0, &config);

        assert!(!result.peaks.is_empty(), "Should detect at least one peak");
        let top_peak = &result.peaks[0];
        // Should be close to 5 Hz (period = 200 ms).
        assert!(
            (top_peak.frequency_hz - 5.0).abs() < 1.0,
            "Peak frequency should be ~5 Hz, got {} Hz",
            top_peak.frequency_hz
        );
        assert!(
            (top_peak.period_ms - 200.0).abs() < 50.0,
            "Peak period should be ~200 ms, got {} ms",
            top_peak.period_ms
        );
        assert!(top_peak.snr > 3.0, "SNR should exceed threshold");
    }

    #[test]
    fn fft_too_few_samples() {
        let values = vec![1.0, 2.0];
        let config = PeriodicityConfig::default();
        let result = fft_periodogram(&values, 100.0, &config);
        assert!(result.peaks.is_empty());
        assert!(result.frequencies.is_empty());
    }

    #[test]
    fn fft_constant_signal_no_peaks() {
        let values = vec![1.0; 128];
        let config = PeriodicityConfig::default();
        let result = fft_periodogram(&values, 100.0, &config);
        assert!(result.peaks.is_empty(), "Constant signal should have no peaks");
    }

    #[test]
    fn fft_two_frequencies() {
        // 3 Hz + 7 Hz, sampled at 100 Hz.
        let n = 512;
        let values: Vec<f64> = (0..n)
            .map(|i| {
                let t = i as f64 / 100.0;
                (2.0 * PI * 3.0 * t).sin() + 0.8 * (2.0 * PI * 7.0 * t).sin()
            })
            .collect();
        let config = PeriodicityConfig {
            min_period_ms: 10.0,
            max_period_ms: 10_000.0,
            significance_threshold: 3.0,
        };
        let result = fft_periodogram(&values, 100.0, &config);
        assert!(
            result.peaks.len() >= 2,
            "Should detect at least 2 peaks, got {}",
            result.peaks.len()
        );
    }

    // -- Lomb-Scargle --

    #[test]
    fn lomb_scargle_detects_frequency() {
        let (timestamps, values) = make_sine_timestamps(2.0, 200, 50.0);
        let config = PeriodicityConfig {
            min_period_ms: 100.0,
            max_period_ms: 5_000.0,
            significance_threshold: 3.0,
        };
        let result = lomb_scargle(&timestamps, &values, &config, 100);

        assert!(!result.peaks.is_empty(), "Should detect the 2 Hz signal");
        let top = &result.peaks[0];
        assert!(
            (top.frequency_hz - 2.0).abs() < 0.5,
            "Should detect ~2 Hz, got {} Hz",
            top.frequency_hz
        );
    }

    #[test]
    fn lomb_scargle_too_few_samples() {
        let result = lomb_scargle(&[0.0, 1.0], &[0.0, 1.0], &PeriodicityConfig::default(), 50);
        assert!(result.frequencies.is_empty());
    }

    #[test]
    fn lomb_scargle_constant_signal() {
        let timestamps: Vec<f64> = (0..100).map(|i| i as f64 * 100.0).collect();
        let values = vec![5.0; 100];
        let config = PeriodicityConfig::default();
        let result = lomb_scargle(&timestamps, &values, &config, 50);
        assert!(result.peaks.is_empty(), "Constant signal has no periodicity");
    }

    #[test]
    fn lomb_scargle_irregular_sampling() {
        // Irregularly-sampled 1 Hz sine.
        let mut timestamps = Vec::new();
        let mut values = Vec::new();
        let mut t = 0.0;
        for _ in 0..200 {
            timestamps.push(t);
            values.push((2.0 * PI * 1.0 * t / 1000.0).sin());
            // Non-uniform spacing: 40-60 ms intervals.
            t += 40.0 + (t * 0.1).sin().abs() * 20.0;
        }
        let config = PeriodicityConfig {
            min_period_ms: 200.0,
            max_period_ms: 5_000.0,
            significance_threshold: 3.0,
        };
        let result = lomb_scargle(&timestamps, &values, &config, 100);
        assert!(!result.peaks.is_empty(), "Should detect 1 Hz even with irregular sampling");
        let top = &result.peaks[0];
        assert!(
            (top.frequency_hz - 1.0).abs() < 0.5,
            "Should detect ~1 Hz, got {} Hz",
            top.frequency_hz
        );
    }

    // -- Cross-spectral similarity --

    #[test]
    fn identical_spectra_similarity_one() {
        let values = make_sine(5.0, 100.0, 256);
        let config = PeriodicityConfig::default();
        let a = fft_periodogram(&values, 100.0, &config);
        let b = fft_periodogram(&values, 100.0, &config);
        let sim = cross_spectral_similarity(&a, &b);
        assert!(
            (sim - 1.0).abs() < 1e-10,
            "Identical spectra should have similarity 1.0, got {}",
            sim
        );
    }

    #[test]
    fn different_spectra_low_similarity() {
        let a_vals = make_sine(3.0, 100.0, 256);
        let b_vals = make_sine(15.0, 100.0, 256);
        let config = PeriodicityConfig::default();
        let a = fft_periodogram(&a_vals, 100.0, &config);
        let b = fft_periodogram(&b_vals, 100.0, &config);
        let sim = cross_spectral_similarity(&a, &b);
        assert!(
            sim < 0.5,
            "Different frequencies should have low similarity, got {}",
            sim
        );
    }

    #[test]
    fn empty_periodograms_similarity_zero() {
        let a = Periodogram {
            frequencies: Vec::new(),
            powers: Vec::new(),
            peaks: Vec::new(),
            sample_rate_hz: 100.0,
        };
        let b = a.clone();
        assert!((cross_spectral_similarity(&a, &b) - 0.0).abs() < 1e-10);
    }

    #[test]
    fn mismatched_lengths_similarity_zero() {
        let config = PeriodicityConfig::default();
        let a = fft_periodogram(&make_sine(5.0, 100.0, 128), 100.0, &config);
        let b = fft_periodogram(&make_sine(5.0, 100.0, 256), 100.0, &config);
        assert!((cross_spectral_similarity(&a, &b) - 0.0).abs() < 1e-10);
    }

    // -- Share dominant period --

    #[test]
    fn share_dominant_period_same_freq() {
        let config = PeriodicityConfig {
            min_period_ms: 10.0,
            max_period_ms: 10_000.0,
            significance_threshold: 3.0,
        };
        let a = fft_periodogram(&make_sine(5.0, 100.0, 256), 100.0, &config);
        let b = fft_periodogram(&make_sine(5.0, 100.0, 256), 100.0, &config);
        assert!(share_dominant_period(&a, &b, 1.0));
    }

    #[test]
    fn share_dominant_period_different_freq() {
        let config = PeriodicityConfig {
            min_period_ms: 10.0,
            max_period_ms: 10_000.0,
            significance_threshold: 3.0,
        };
        let a = fft_periodogram(&make_sine(5.0, 100.0, 256), 100.0, &config);
        let b = fft_periodogram(&make_sine(15.0, 100.0, 256), 100.0, &config);
        assert!(!share_dominant_period(&a, &b, 1.0));
    }

    #[test]
    fn share_dominant_period_no_peaks() {
        let a = Periodogram {
            frequencies: Vec::new(),
            powers: Vec::new(),
            peaks: Vec::new(),
            sample_rate_hz: 100.0,
        };
        let b = a.clone();
        assert!(!share_dominant_period(&a, &b, 1.0));
    }

    // -- Resample --

    #[test]
    fn resample_basic() {
        let timestamps = vec![0.0, 100.0, 200.0, 300.0, 400.0];
        let values = vec![0.0, 1.0, 0.0, -1.0, 0.0];
        let result = resample_uniform(&timestamps, &values, 5);
        assert!(result.is_some());
        let (rate, resampled) = result.unwrap();
        assert_eq!(resampled.len(), 5);
        assert!((rate - 10.0).abs() < 1e-6, "Sample rate should be 10 Hz");
    }

    #[test]
    fn resample_too_few() {
        assert!(resample_uniform(&[0.0], &[1.0], 10).is_none());
    }

    #[test]
    fn resample_interpolates() {
        let timestamps = vec![0.0, 200.0];
        let values = vec![0.0, 10.0];
        let (_, resampled) = resample_uniform(&timestamps, &values, 5).unwrap();
        // Should linearly interpolate: 0, 2.5, 5, 7.5, 10.
        assert!((resampled[0] - 0.0).abs() < 1e-10);
        assert!((resampled[2] - 5.0).abs() < 1e-10);
        assert!((resampled[4] - 10.0).abs() < 1e-10);
    }
}
