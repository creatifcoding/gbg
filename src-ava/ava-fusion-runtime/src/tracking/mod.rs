//! Tracking and state estimation module.
//!
//! Implements kinematic state estimation for tracked entities:
//!
//! - **ekf**: Extended Kalman Filter with CV, CT, and CTRV motion models
//! - **imm**: Interacting Multiple Model filter wrapping 3 EKF instances
//! - **fusion**: Covariance Intersection for track-to-track fusion
//! - **sprt**: Sequential Probability Ratio Test for track confirmation

pub mod ekf;
pub mod imm;
pub mod fusion;
pub mod sprt;
