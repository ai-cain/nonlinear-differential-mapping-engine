import express from 'express';
import { spawn } from 'child_process';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());

const port = Number(process.env.PORT) || 3002;
const clients = new Set();

const DEFAULT_MAP_ID = 'quadratic_map';
const DEFAULT_PARAMETER_A = 0;
const DEFAULT_PARAMETER_B = 0;
const DEFAULT_GRID_COLUMNS = 17;
const DEFAULT_GRID_ROWS = 17;
const DEFAULT_DOMAIN_EXTENT = 2;
const DEFAULT_SELECTED_X = 0.85;
const DEFAULT_SELECTED_Y = 0.45;
const DEFAULT_NEIGHBORHOOD_RADIUS = 0.3;

const allowedMapIds = new Set([
  'linear_shear',
  'anisotropic_scaling',
  'quadratic_map',
  'cubic_distortion',
  'singular_fold',
]);

const resolveEnginePath = () => {
  const extension = process.platform === 'win32' ? '.exe' : '';
  const candidates = [
    path.resolve(
      __dirname,
      `../engine_cpp/build/Release/nonlinear_differential_mapping_cli${extension}`,
    ),
    path.resolve(__dirname, `../engine_cpp/build/nonlinear_differential_mapping_cli${extension}`),
    path.resolve(
      __dirname,
      `../engine_cpp/build/Debug/nonlinear_differential_mapping_cli${extension}`,
    ),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
};

const broadcast = (payload) => {
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
};

const enginePath = resolveEnginePath();
let engineProcess = null;
let engineUnavailableReason = '';

const sendBackendError = (message, ws = null) => {
  const payload = JSON.stringify({ type: 'error', message });

  if (ws) {
    ws.send(payload);
    return;
  }

  broadcast(payload);
};

const startEngine = () => {
  if (!fs.existsSync(enginePath)) {
    engineUnavailableReason = `Engine executable not found at ${enginePath}`;
    console.error(engineUnavailableReason);
    return;
  }

  engineProcess = spawn(enginePath, ['--stdio-server'], {
    cwd: path.resolve(__dirname, '..'),
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const stdoutReader = readline.createInterface({ input: engineProcess.stdout });
  stdoutReader.on('line', (line) => {
    const payload = line.trim();
    if (payload) {
      broadcast(payload);
    }
  });

  engineProcess.stderr.on('data', (chunk) => {
    const text = chunk.toString().trim();
    if (text) {
      console.error(`[engine] ${text}`);
    }
  });

  engineProcess.on('error', (error) => {
    engineUnavailableReason = `Failed to start engine: ${error.message}`;
    console.error(engineUnavailableReason);
    sendBackendError(engineUnavailableReason);
  });

  engineProcess.on('exit', (code, signal) => {
    const reason = `Engine process exited (${signal ?? code ?? 'unknown'}).`;
    engineUnavailableReason = reason;
    engineProcess = null;
    console.error(reason);
    sendBackendError(reason);
  });
};

const sendEngineCommand = (command, ws = null) => {
  if (engineUnavailableReason) {
    sendBackendError(engineUnavailableReason, ws);
    return;
  }

  if (!engineProcess || engineProcess.killed || !engineProcess.stdin.writable) {
    sendBackendError('Engine process is not available.', ws);
    return;
  }

  engineProcess.stdin.write(`${command}\n`);
};

const sanitizeNumber = (value, fallback) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const normalizeConfig = (raw) => {
  const domainExtent = clamp(
    sanitizeNumber(raw.domainExtent, DEFAULT_DOMAIN_EXTENT),
    0.75,
    4.5,
  );
  const gridColumns = Math.round(
    clamp(sanitizeNumber(raw.gridColumns, DEFAULT_GRID_COLUMNS), 7, 33),
  );
  const gridRows = Math.round(clamp(sanitizeNumber(raw.gridRows, DEFAULT_GRID_ROWS), 7, 33));
  const parameterA = clamp(sanitizeNumber(raw.parameterA, DEFAULT_PARAMETER_A), -2.5, 2.5);
  const parameterB = clamp(sanitizeNumber(raw.parameterB, DEFAULT_PARAMETER_B), -2.5, 2.5);
  const selectedX = clamp(
    sanitizeNumber(raw.selectedX, DEFAULT_SELECTED_X),
    -domainExtent,
    domainExtent,
  );
  const selectedY = clamp(
    sanitizeNumber(raw.selectedY, DEFAULT_SELECTED_Y),
    -domainExtent,
    domainExtent,
  );
  const neighborhoodRadius = clamp(
    sanitizeNumber(raw.neighborhoodRadius, DEFAULT_NEIGHBORHOOD_RADIUS),
    0.05,
    Math.max(0.12, domainExtent * 0.75),
  );
  const mapId = allowedMapIds.has(raw.mapId) ? raw.mapId : DEFAULT_MAP_ID;

  return {
    mapId,
    parameterA,
    parameterB,
    gridColumns,
    gridRows,
    domainExtent,
    selectedX,
    selectedY,
    neighborhoodRadius,
  };
};

const server = app.listen(port);

server.on('listening', () => {
  console.log(`Nonlinear Differential Mapping backend listening on port ${port}`);
  console.log(`C++ Engine Path: ${enginePath}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Stop the other backend or set PORT.`);
    return;
  }

  console.error('HTTP server failed:', error.message);
});

startEngine();

const wss = new WebSocketServer({ server });

wss.on('error', (error) => {
  console.error('WebSocket server failed:', error.message);
});

wss.on('connection', (ws) => {
  clients.add(ws);

  if (engineUnavailableReason) {
    sendBackendError(engineUnavailableReason, ws);
  } else {
    ws.send(JSON.stringify({ type: 'ready' }));
    sendEngineCommand('REQUEST_STATE', ws);
  }

  ws.on('message', (message) => {
    try {
      const payload = JSON.parse(message);

      if (payload.type === 'configure') {
        const config = normalizeConfig(payload.data ?? {});
        sendEngineCommand(
          [
            'CONFIG',
            config.mapId,
            config.parameterA,
            config.parameterB,
            config.gridColumns,
            config.gridRows,
            config.domainExtent,
            config.selectedX,
            config.selectedY,
            config.neighborhoodRadius,
          ].join('\t'),
          ws,
        );
        return;
      }

      if (payload.type === 'reset') {
        sendEngineCommand('RESET', ws);
        return;
      }

      if (payload.type === 'request_state') {
        sendEngineCommand('REQUEST_STATE', ws);
        return;
      }

      sendBackendError('Unknown message type.', ws);
    } catch {
      sendBackendError('Invalid message format. Send JSON.', ws);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
  });
});

const shutdownEngine = () => {
  if (!engineProcess || engineProcess.killed) {
    return;
  }

  engineProcess.kill();
};

process.on('SIGINT', () => {
  shutdownEngine();
  process.exit(0);
});

process.on('SIGTERM', () => {
  shutdownEngine();
  process.exit(0);
});
