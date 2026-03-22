"""
Kalman Filter Implementation for IoT Sensor Fusion

Based on:
- Aalto Basics of Sensor Fusion (Särkkä, 2020)
- UC Berkeley Kalman Filter Tutorial

Use Cases:
- Temperature sensor smoothing
- Sensor drift correction
- Multi-sensor fusion with known uncertainty

Author: IoT Data Science Experiments
Date: 2025-12-16
"""

import numpy as np
from typing import Tuple, Optional
from dataclasses import dataclass


@dataclass
class KalmanFilterState:
    """
    State representation for a Kalman filter

    Attributes:
        x: State estimate (mean)
        P: State covariance (uncertainty)
        F: State transition matrix
        H: Observation matrix
        Q: Process noise covariance
        R: Measurement noise covariance
    """

    x: np.ndarray  # State estimate
    P: np.ndarray  # State covariance
    F: np.ndarray  # State transition
    H: np.ndarray  # Observation matrix
    Q: np.ndarray  # Process noise
    R: np.ndarray  # Measurement noise


class KalmanFilter:
    """
    Linear Kalman Filter for sensor fusion

    The Kalman filter recursively estimates the state of a linear dynamic system
    from a series of noisy measurements.

    State equation:  x_k = F @ x_{k-1} + w_k    (w_k ~ N(0, Q))
    Measurement:     z_k = H @ x_k + v_k        (v_k ~ N(0, R))

    Example:
        # 1D position tracking with velocity
        kf = KalmanFilter(dim_x=2, dim_z=1)
        kf.F = np.array([[1, dt], [0, 1]])  # Position-velocity model
        kf.H = np.array([[1, 0]])            # Measure position only
        kf.R = np.array([[sensor_noise**2]]) # Measurement noise
        kf.Q = Q_discrete_white_noise(2, dt, var)  # Process noise

        for measurement in measurements:
            kf.predict()
            kf.update(measurement)
            print(f"Estimated position: {kf.x[0]}")
    """

    def __init__(self, dim_x: int, dim_z: int):
        """
        Initialize Kalman filter

        Args:
            dim_x: Dimension of state vector
            dim_z: Dimension of measurement vector
        """
        self.dim_x = dim_x
        self.dim_z = dim_z

        # State estimate
        self.x = np.zeros((dim_x, 1))  # State vector
        self.P = np.eye(dim_x)  # State covariance

        # System matrices (to be set by user)
        self.F = np.eye(dim_x)  # State transition
        self.H = np.zeros((dim_z, dim_x))  # Observation matrix
        self.Q = np.eye(dim_x)  # Process noise
        self.R = np.eye(dim_z)  # Measurement noise

        # Identity matrix (cached for efficiency)
        self._I = np.eye(dim_x)

    def predict(self) -> None:
        """
        Predict step: Project state ahead

        Updates:
            x = F @ x
            P = F @ P @ F.T + Q
        """
        self.x = self.F @ self.x
        self.P = self.F @ self.P @ self.F.T + self.Q

    def update(self, z: np.ndarray) -> None:
        """
        Update step: Incorporate measurement

        Args:
            z: Measurement vector (dim_z, 1) or (dim_z,)

        Updates:
            y = z - H @ x           (innovation)
            S = H @ P @ H.T + R     (innovation covariance)
            K = P @ H.T @ inv(S)    (Kalman gain)
            x = x + K @ y
            P = (I - K @ H) @ P
        """
        z = np.atleast_2d(z).reshape((-1, 1))

        # Innovation
        y = z - self.H @ self.x

        # Innovation covariance
        S = self.H @ self.P @ self.H.T + self.R

        # Kalman gain
        K = self.P @ self.H.T @ np.linalg.inv(S)

        # Update state
        self.x = self.x + K @ y

        # Update covariance (Joseph form for numerical stability)
        I_KH = self._I - K @ self.H
        self.P = I_KH @ self.P @ I_KH.T + K @ self.R @ K.T

    def get_state(self) -> Tuple[np.ndarray, np.ndarray]:
        """
        Get current state estimate and covariance

        Returns:
            (x, P): State estimate and covariance
        """
        return self.x.copy(), self.P.copy()


def Q_discrete_white_noise(
    dim: int, dt: float = 1.0, var: float = 1.0, block_size: int = 1
) -> np.ndarray:
    """
    Generate discrete white noise matrix Q

    For a constant acceleration model in 1D:
        Q = var * [[dt^4/4, dt^3/2],
                   [dt^3/2, dt^2  ]]

    Args:
        dim: Dimension of state (2 for pos+vel, 3 for pos+vel+acc)
        dt: Time step
        var: Process noise variance
        block_size: Number of blocks (1 for scalar, >1 for multi-dimensional)

    Returns:
        Q matrix (dim*block_size, dim*block_size)
    """
    if dim == 2:
        Q = np.array([[dt**4 / 4, dt**3 / 2], [dt**3 / 2, dt**2]]) * var
    elif dim == 3:
        Q = (
            np.array(
                [
                    [dt**4 / 4, dt**3 / 2, dt**2 / 2],
                    [dt**3 / 2, dt**2, dt],
                    [dt**2 / 2, dt, 1],
                ]
            )
            * var
        )
    else:
        raise ValueError(f"dim must be 2 or 3, got {dim}")

    if block_size == 1:
        return Q
    else:
        # Block diagonal for multi-dimensional tracking
        return np.kron(np.eye(block_size), Q)


# Example usage functions


def smooth_temperature_sensor(
    measurements: np.ndarray,
    dt: float = 1.0,
    process_var: float = 0.01,
    measurement_var: float = 0.1,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Smooth noisy temperature sensor readings using Kalman filter

    Assumes constant temperature model:
        x_k = x_{k-1} + w_k    (small random walk)

    Args:
        measurements: Array of noisy temperature readings
        dt: Time between measurements
        process_var: Process noise variance (how much temperature can change)
        measurement_var: Measurement noise variance (sensor accuracy)

    Returns:
        (smoothed, uncertainties): Filtered estimates and standard deviations
    """
    kf = KalmanFilter(dim_x=1, dim_z=1)

    # State transition (constant model)
    kf.F = np.array([[1.0]])

    # Observation matrix (direct measurement)
    kf.H = np.array([[1.0]])

    # Process noise (how much can temperature change?)
    kf.Q = np.array([[process_var]])

    # Measurement noise (sensor accuracy)
    kf.R = np.array([[measurement_var]])

    # Initialize with first measurement
    kf.x = np.array([[measurements[0]]])
    kf.P = np.array([[measurement_var]])

    # Storage
    smoothed = np.zeros(len(measurements))
    uncertainties = np.zeros(len(measurements))

    smoothed[0] = kf.x[0, 0]
    uncertainties[0] = np.sqrt(kf.P[0, 0])

    # Filter
    for i in range(1, len(measurements)):
        kf.predict()
        kf.update(measurements[i])

        smoothed[i] = kf.x[0, 0]
        uncertainties[i] = np.sqrt(kf.P[0, 0])

    return smoothed, uncertainties


def fuse_two_sensors(
    sensor1: np.ndarray, sensor2: np.ndarray, var1: float, var2: float
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Fuse two sensors measuring the same quantity with known uncertainties

    Uses Kalman filter to optimally combine measurements based on relative
    accuracy (sensors with lower variance get higher weight).

    Args:
        sensor1: First sensor readings
        sensor2: Second sensor readings
        var1: Variance of sensor 1
        var2: Variance of sensor 2

    Returns:
        (fused, uncertainties): Optimal fusion and combined uncertainties
    """
    assert len(sensor1) == len(sensor2), "Sensors must have same length"

    kf = KalmanFilter(dim_x=1, dim_z=2)

    # State transition (constant)
    kf.F = np.array([[1.0]])

    # Both sensors measure the same state
    kf.H = np.array([[1.0], [1.0]])

    # Process noise (assume state is constant)
    kf.Q = np.array([[0.01]])

    # Measurement noise (sensor characteristics)
    kf.R = np.array([[var1, 0], [0, var2]])

    # Initialize
    kf.x = np.array([[(sensor1[0] + sensor2[0]) / 2]])
    kf.P = np.array([[min(var1, var2)]])

    # Storage
    fused = np.zeros(len(sensor1))
    uncertainties = np.zeros(len(sensor1))

    fused[0] = kf.x[0, 0]
    uncertainties[0] = np.sqrt(kf.P[0, 0])

    # Filter
    for i in range(1, len(sensor1)):
        kf.predict()
        z = np.array([[sensor1[i]], [sensor2[i]]])
        kf.update(z)

        fused[i] = kf.x[0, 0]
        uncertainties[i] = np.sqrt(kf.P[0, 0])

    return fused, uncertainties


if __name__ == "__main__":
    """Example: Smooth noisy temperature data"""

    # Simulate noisy temperature sensor
    np.random.seed(42)
    true_temp = 25.0  # Celsius
    n_samples = 100
    measurements = true_temp + np.random.randn(n_samples) * 0.5

    # Apply Kalman filter
    smoothed, uncertainties = smooth_temperature_sensor(
        measurements, process_var=0.01, measurement_var=0.25
    )

    print("Kalman Filter Temperature Smoothing")
    print("=" * 50)
    print(f"True temperature: {true_temp:.2f}°C")
    print(f"Raw measurement mean: {np.mean(measurements):.2f}°C")
    print(f"Raw measurement std: {np.std(measurements):.2f}°C")
    print(f"Filtered estimate: {smoothed[-1]:.2f}°C")
    print(f"Final uncertainty: {uncertainties[-1]:.2f}°C")

    # Demonstrate sensor fusion
    print("\n" + "=" * 50)
    print("Two-Sensor Fusion Example")
    print("=" * 50)

    sensor1 = true_temp + np.random.randn(n_samples) * 0.8  # Less accurate
    sensor2 = true_temp + np.random.randn(n_samples) * 0.3  # More accurate

    fused, fused_unc = fuse_two_sensors(sensor1, sensor2, var1=0.64, var2=0.09)

    print(f"Sensor 1 mean: {np.mean(sensor1):.2f}°C (std: {np.std(sensor1):.2f})")
    print(f"Sensor 2 mean: {np.mean(sensor2):.2f}°C (std: {np.std(sensor2):.2f})")
    print(f"Fused estimate: {fused[-1]:.2f}°C")
    print(f"Fused uncertainty: {fused_unc[-1]:.2f}°C")
    print(
        f"Improvement: {(np.std(sensor1) - fused_unc[-1]) / np.std(sensor1) * 100:.1f}% reduction in uncertainty"
    )
