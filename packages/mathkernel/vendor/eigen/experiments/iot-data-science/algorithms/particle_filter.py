"""
Particle Filter Implementation for IoT Sensor Fusion

Based on:
- Texas A&M Particle Filter for Robust Monitoring
- CMU Decentralized Sensor Fusion with Distributed Particle Filters

Use Cases:
- Non-linear sensor fusion
- Multi-modal distributions
- Robustness to outliers

Author: IoT Data Science Experiments
Date: 2025-12-16
"""

import numpy as np
from typing import Callable, Tuple, Optional
from dataclasses import dataclass


@dataclass
class ParticleFilterConfig:
    """Configuration for particle filter"""

    n_particles: int = 1000
    resample_threshold: float = 0.5  # Effective sample size threshold


class ParticleFilter:
    """
    Sequential Monte Carlo (Particle Filter) for non-linear state estimation

    Unlike Kalman filters, particle filters can handle:
    - Non-linear dynamics
    - Non-Gaussian noise
    - Multi-modal distributions

    Algorithm:
        1. Prediction: Move particles according to motion model
        2. Update: Weight particles by likelihood of measurement
        3. Resample: Replace low-weight particles with high-weight ones

    Example:
        # Define motion and measurement models
        def motion_model(x, dt):
            return x + np.random.randn() * 0.1

        def measurement_model(x):
            return x + np.random.randn() * 0.5

        def likelihood(x, z):
            return scipy.stats.norm(x, 0.5).pdf(z)

        pf = ParticleFilter(n_particles=1000)
        pf.initialize(mean=0, std=1)

        for measurement in measurements:
            pf.predict(motion_model, dt=0.1)
            pf.update(likelihood, measurement)
            estimate = pf.estimate()
    """

    def __init__(self, config: Optional[ParticleFilterConfig] = None):
        """
        Initialize particle filter

        Args:
            config: Particle filter configuration
        """
        self.config = config or ParticleFilterConfig()
        self.n_particles = self.config.n_particles

        # Particles (state samples)
        self.particles = None

        # Weights (importance weights)
        self.weights = None

    def initialize(self, mean: float = 0.0, std: float = 1.0, dim: int = 1) -> None:
        """
        Initialize particles from Gaussian distribution

        Args:
            mean: Initial mean
            std: Initial standard deviation
            dim: State dimension
        """
        if dim == 1:
            self.particles = np.random.randn(self.n_particles) * std + mean
        else:
            self.particles = np.random.randn(self.n_particles, dim) * std + mean

        self.weights = np.ones(self.n_particles) / self.n_particles

    def predict(
        self, motion_fn: Callable[[np.ndarray, dict], np.ndarray], **motion_kwargs
    ) -> None:
        """
        Prediction step: Move particles according to motion model

        Args:
            motion_fn: Function that takes particle state and returns new state
                       Signature: motion_fn(particles, **kwargs) -> new_particles
            **motion_kwargs: Additional arguments for motion function (e.g., dt)
        """
        self.particles = motion_fn(self.particles, **motion_kwargs)

    def update(
        self,
        likelihood_fn: Callable[[np.ndarray, float], np.ndarray],
        measurement: float,
    ) -> None:
        """
        Update step: Weight particles by measurement likelihood

        Args:
            likelihood_fn: Function that computes p(z|x) for each particle
                          Signature: likelihood_fn(particles, measurement) -> weights
            measurement: Observed measurement
        """
        # Compute likelihood for each particle
        likelihoods = likelihood_fn(self.particles, measurement)

        # Update weights
        self.weights *= likelihoods

        # Normalize
        self.weights += 1.0e-300  # Avoid division by zero
        self.weights /= np.sum(self.weights)

        # Resample if needed
        if self._neff() < self.config.resample_threshold * self.n_particles:
            self._resample()

    def estimate(self) -> Tuple[float, float]:
        """
        Estimate state from particles

        Returns:
            (mean, std): Weighted mean and standard deviation
        """
        mean = np.average(self.particles, weights=self.weights, axis=0)
        variance = np.average(
            (self.particles - mean) ** 2, weights=self.weights, axis=0
        )
        std = np.sqrt(variance)

        return mean, std

    def _neff(self) -> float:
        """
        Compute effective sample size

        Returns:
            N_eff = 1 / sum(weights^2)
        """
        return 1.0 / np.sum(self.weights**2)

    def _resample(self) -> None:
        """
        Resample particles (systematic resampling)

        Replaces low-weight particles with copies of high-weight particles
        """
        # Cumulative sum of weights
        cumsum = np.cumsum(self.weights)
        cumsum[-1] = 1.0  # Ensure it sums to 1

        # Systematic resampling
        positions = (
            np.arange(self.n_particles) + np.random.random()
        ) / self.n_particles

        indices = np.searchsorted(cumsum, positions)

        # Resample particles
        self.particles = self.particles[indices]

        # Reset weights
        self.weights = np.ones(self.n_particles) / self.n_particles


# Helper functions for common models


def gaussian_likelihood(x: np.ndarray, z: float, std: float = 1.0) -> np.ndarray:
    """
    Gaussian measurement likelihood

    Args:
        x: Particle states
        z: Measurement
        std: Measurement noise standard deviation

    Returns:
        Likelihoods p(z|x) for each particle
    """
    return np.exp(-0.5 * ((x - z) / std) ** 2) / (std * np.sqrt(2 * np.pi))


def constant_velocity_motion(
    particles: np.ndarray, dt: float = 1.0, process_std: float = 0.1
) -> np.ndarray:
    """
    Constant velocity motion model with process noise

    For 1D tracking: x_k = x_{k-1} + noise

    Args:
        particles: Current particle states
        dt: Time step
        process_std: Process noise standard deviation

    Returns:
        New particle states
    """
    noise = np.random.randn(len(particles)) * process_std * np.sqrt(dt)
    return particles + noise


def multi_sensor_likelihood(
    particles: np.ndarray, measurements: np.ndarray, sensor_stds: np.ndarray
) -> np.ndarray:
    """
    Likelihood for multiple sensors measuring the same quantity

    Assumes conditional independence: p(z1,z2|x) = p(z1|x) * p(z2|x)

    Args:
        particles: Particle states
        measurements: Array of measurements from different sensors
        sensor_stds: Array of sensor noise standard deviations

    Returns:
        Combined likelihood for each particle
    """
    likelihood = np.ones(len(particles))

    for z, std in zip(measurements, sensor_stds):
        likelihood *= gaussian_likelihood(particles, z, std)

    return likelihood


# Example usage


def track_with_particle_filter(
    measurements: np.ndarray,
    measurement_std: float = 0.5,
    process_std: float = 0.1,
    n_particles: int = 1000,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Track a signal using particle filter

    Args:
        measurements: Noisy measurements
        measurement_std: Measurement noise std
        process_std: Process noise std
        n_particles: Number of particles

    Returns:
        (estimates, uncertainties): Filtered estimates and standard deviations
    """
    config = ParticleFilterConfig(n_particles=n_particles)
    pf = ParticleFilter(config)

    # Initialize from first measurement
    pf.initialize(mean=measurements[0], std=measurement_std)

    estimates = np.zeros(len(measurements))
    uncertainties = np.zeros(len(measurements))

    estimates[0], uncertainties[0] = pf.estimate()

    for i in range(1, len(measurements)):
        # Predict
        pf.predict(constant_velocity_motion, dt=1.0, process_std=process_std)

        # Update
        pf.update(
            lambda x, z: gaussian_likelihood(x, z, measurement_std), measurements[i]
        )

        # Estimate
        estimates[i], uncertainties[i] = pf.estimate()

    return estimates, uncertainties


if __name__ == "__main__":
    """Example: Track noisy signal with particle filter"""

    np.random.seed(42)

    # Generate synthetic data
    true_signal = 25.0
    n_samples = 100
    measurements = true_signal + np.random.randn(n_samples) * 0.5

    # Apply particle filter
    estimates, uncertainties = track_with_particle_filter(
        measurements, measurement_std=0.5, process_std=0.1, n_particles=1000
    )

    print("Particle Filter Tracking")
    print("=" * 50)
    print(f"True signal: {true_signal:.2f}")
    print(f"Raw measurement mean: {np.mean(measurements):.2f}")
    print(f"Raw measurement std: {np.std(measurements):.2f}")
    print(f"Filtered estimate: {estimates[-1]:.2f}")
    print(f"Final uncertainty: {uncertainties[-1]:.2f}")

    # Multi-sensor fusion example
    print("\n" + "=" * 50)
    print("Multi-Sensor Particle Filter Fusion")
    print("=" * 50)

    # Two sensors with different accuracies
    sensor1 = true_signal + np.random.randn(n_samples) * 0.8
    sensor2 = true_signal + np.random.randn(n_samples) * 0.3

    pf = ParticleFilter(ParticleFilterConfig(n_particles=1000))
    pf.initialize(mean=true_signal, std=1.0)

    multi_estimates = []

    for i in range(n_samples):
        pf.predict(constant_velocity_motion, dt=1.0, process_std=0.05)

        # Fuse both sensors
        measurements_i = np.array([sensor1[i], sensor2[i]])
        sensor_stds = np.array([0.8, 0.3])

        pf.update(
            lambda x, z: multi_sensor_likelihood(x, z, sensor_stds), measurements_i
        )

        mean, _ = pf.estimate()
        multi_estimates.append(mean)

    print(f"Sensor 1 mean: {np.mean(sensor1):.2f} (std: {np.std(sensor1):.2f})")
    print(f"Sensor 2 mean: {np.mean(sensor2):.2f} (std: {np.std(sensor2):.2f})")
    print(f"Particle filter fusion: {multi_estimates[-1]:.2f}")
