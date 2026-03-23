# Architecture

The project uses a simple three-layer architecture:

1. The frontend captures map selection, coefficients, domain sampling, and the analysis point.
2. The backend validates the payload and forwards it to the native engine.
3. The C++ engine evaluates the map, estimates the Jacobian, and samples the nonlinear and linearized neighborhoods.
4. The backend relays the resulting JSON snapshot to the browser.
5. The frontend renders the domain grid, transformed image, and local overlays.

## Layer Responsibilities

### Frontend

- control surface for presets and coefficients
- interactive point selection
- 2D rendering of the domain and mapped image
- display of Jacobian metrics

### Backend

- WebSocket server
- message normalization
- native process bridge
- engine lifecycle management

### C++ Engine

- authoritative mathematical state
- preset map evaluation
- numerical Jacobian estimation
- JSON snapshot generation

## Data Flow

```text
frontend --WebSocket JSON--> backend --stdin/stdout--> C++ engine
frontend <--WebSocket JSON-- backend <--stdout-------- C++ engine
```

## Command Protocol

Browser messages:

- `configure`
- `reset`
- `request_state`

Engine commands:

- `CONFIG`
- `RESET`
- `REQUEST_STATE`

The backend stays intentionally thin so the mathematical logic remains isolated in the native engine.
