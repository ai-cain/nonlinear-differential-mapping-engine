# Development Guide

## Local Workflow

### Build the engine

```bash
cmake -S engine_cpp -B engine_cpp/build
cmake --build engine_cpp/build --config Release
```

### Start the backend

```bash
cd backend_node
pnpm install
pnpm start
```

### Start the frontend

```bash
cd frontend_web
pnpm install
pnpm dev
```

## Where To Edit

- frontend rendering and controls: `frontend_web/`
- WebSocket bridge and process management: `backend_node/server.js`
- numerical model and command handling: `engine_cpp/src/`
- project docs: `docs/`

## Suggested Extension Path

1. Add a new preset map in `engine_cpp/src/differential_map_system.cpp`.
2. Mirror its UI metadata in `frontend_web/src/lib/mappingLabMath.ts`.
3. Adjust frontend labels or parameter ranges if needed.
4. Rebuild the engine and verify the frontend snapshot renders correctly.
