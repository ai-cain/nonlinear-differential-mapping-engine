# Frontend

The frontend is the interactive visualization shell for the nonlinear mapping engine.

## Responsibilities

- choose the active preset map
- tune map coefficients and sampling density
- move the analysis point by sliders or direct clicking
- render the domain grid and transformed image side by side
- overlay nonlinear and linearized neighborhoods
- show determinant, rank, singular values, and Jacobian entries

## Interaction Model

- the left plot represents the original sampled domain
- the right plot represents the mapped image
- clicking the left plot updates the local analysis point
- control changes trigger a fresh snapshot request through the backend

## Key Frontend Files

- `src/App.tsx`: WebSocket orchestration and canvas rendering
- `src/components/ControlsPanel.tsx`: preset and analysis controls
- `src/lib/mappingLabMath.ts`: preset metadata and formatting helpers
- `src/types.ts`: shared frontend snapshot types
