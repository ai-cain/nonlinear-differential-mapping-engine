# C++ Engine

The native engine is the mathematical core of the project.

## Responsibilities

- store the active map configuration
- evaluate preset maps over sampled points
- estimate Jacobians with central finite differences
- compute determinant, rank, and singular values
- sample nonlinear and linearized neighborhoods around the selected point
- emit snapshots as JSON lines

## Main Files

- `src/differential_map_system.hpp/.cpp`
- `src/mapping_engine.hpp/.cpp`
- `src/main.cpp`

## Current Presets

- `linear_shear`
- `anisotropic_scaling`
- `quadratic_map`
- `cubic_distortion`
- `singular_fold`

## Output Snapshot

Each emitted state includes:

- active map metadata
- domain bounds and sampling resolution
- flattened domain grid points
- mapped grid points
- selected point and mapped point
- Jacobian matrix
- determinant
- rank
- singular values
- nonlinear neighborhood sample
- linearized neighborhood sample
