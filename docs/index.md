# Nonlinear Differential Mapping Engine

Interactive laboratory for exploring nonlinear maps `R^2 -> R^2`, Jacobians, and local linearization.

## Layers

- `engine_cpp/`: evaluates maps, estimates Jacobians, and emits authoritative state
- `backend_node/`: manages the native process and forwards WebSocket messages
- `frontend_web/`: renders the sampled domain, mapped image, and local analysis overlays

## Current Capabilities

- preset nonlinear maps
- grid deformation sampling
- interactive point selection
- local Jacobian inspection
- determinant, rank, and singular values
- nonlinear versus linearized neighborhood overlays
