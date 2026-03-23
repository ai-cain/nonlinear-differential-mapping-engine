# Backend

The Node.js backend is a transport layer between the browser and the native engine.

## Responsibilities

- host the WebSocket server
- validate and clamp incoming configuration values
- start the native engine process
- forward commands over `stdin`
- relay engine snapshots back to all connected clients

## Supported Browser Messages

- `configure`
- `reset`
- `request_state`

## Normalized Configuration Fields

- `mapId`
- `parameterA`
- `parameterB`
- `gridColumns`
- `gridRows`
- `domainExtent`
- `selectedX`
- `selectedY`
- `neighborhoodRadius`

## Native Process

The backend starts `nonlinear_differential_mapping_cli --stdio-server` and communicates with it over `stdin/stdout`.

This layer deliberately avoids any Jacobian or map evaluation logic so the numerical model remains centralized in C++.
