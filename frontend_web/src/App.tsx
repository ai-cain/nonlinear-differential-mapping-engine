import { startTransition, useEffect, useEffectEvent, useRef, useState } from 'react';
import ControlsPanel from './components/ControlsPanel';
import {
  DEFAULT_GRID_COLUMNS,
  DEFAULT_GRID_ROWS,
  DEFAULT_MAP_ID,
  clamp,
  formatPoint,
  formatScalar,
  getMapPreset,
} from './lib/mappingLabMath';
import type { MappingSnapshot, Point2 } from './types';
import './index.css';

const backendWebSocketUrl =
  import.meta.env.VITE_BACKEND_WS_URL?.trim() || 'ws://localhost:3002';

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 720;

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface PlotRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Projection {
  project: (point: Point2) => Point2;
  unproject: (screenPoint: Point2) => Point2;
}

const getPlotRects = (width: number, height: number) => {
  const outerPadding = 42;
  const gutter = 26;
  const plotWidth = (width - outerPadding * 2 - gutter) / 2;
  const plotHeight = height - outerPadding * 2;

  return {
    domain: {
      x: outerPadding,
      y: outerPadding,
      width: plotWidth,
      height: plotHeight,
    },
    image: {
      x: outerPadding + plotWidth + gutter,
      y: outerPadding,
      width: plotWidth,
      height: plotHeight,
    },
  };
};

const expandBounds = (bounds: Bounds, paddingFactor: number): Bounds => {
  const width = Math.max(bounds.maxX - bounds.minX, 1e-6);
  const height = Math.max(bounds.maxY - bounds.minY, 1e-6);
  const horizontalPadding = width * paddingFactor;
  const verticalPadding = height * paddingFactor;

  return {
    minX: bounds.minX - horizontalPadding,
    maxX: bounds.maxX + horizontalPadding,
    minY: bounds.minY - verticalPadding,
    maxY: bounds.maxY + verticalPadding,
  };
};

const createProjection = (bounds: Bounds, rect: PlotRect): Projection => {
  const expanded = expandBounds(bounds, 0.12);
  const width = Math.max(expanded.maxX - expanded.minX, 1e-6);
  const height = Math.max(expanded.maxY - expanded.minY, 1e-6);
  const scale = Math.min(rect.width / width, rect.height / height);
  const offsetX = rect.x + (rect.width - width * scale) * 0.5;
  const offsetY = rect.y + (rect.height - height * scale) * 0.5;

  return {
    project: ([x, y]) =>
      [
        offsetX + (x - expanded.minX) * scale,
        offsetY + (expanded.maxY - y) * scale,
      ] as Point2,
    unproject: ([x, y]) =>
      [
        expanded.minX + (x - offsetX) / scale,
        expanded.maxY - (y - offsetY) / scale,
      ] as Point2,
  };
};

const pointInRect = (point: Point2, rect: PlotRect) =>
  point[0] >= rect.x &&
  point[0] <= rect.x + rect.width &&
  point[1] >= rect.y &&
  point[1] <= rect.y + rect.height;

const getBoundsFromPoints = (points: Point2[], fallback: Bounds): Bounds => {
  if (points.length === 0) {
    return fallback;
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxY)
  ) {
    return fallback;
  }

  if (Math.abs(maxX - minX) < 1e-6) {
    minX -= 1;
    maxX += 1;
  }

  if (Math.abs(maxY - minY) < 1e-6) {
    minY -= 1;
    maxY += 1;
  }

  return { minX, maxX, minY, maxY };
};

const drawPanel = (
  context: CanvasRenderingContext2D,
  rect: PlotRect,
  title: string,
  subtitle: string,
) => {
  context.save();
  context.fillStyle = 'rgba(255, 255, 255, 0.72)';
  context.strokeStyle = 'rgba(31, 37, 50, 0.12)';
  context.lineWidth = 1.5;
  context.beginPath();
  context.roundRect(rect.x, rect.y, rect.width, rect.height, 26);
  context.fill();
  context.stroke();

  context.fillStyle = '#1f2532';
  context.font = '700 20px Aptos, Segoe UI, sans-serif';
  context.fillText(title, rect.x + 20, rect.y + 28);

  context.fillStyle = '#66707c';
  context.font = '13px Aptos, Segoe UI, sans-serif';
  context.fillText(subtitle, rect.x + 20, rect.y + 48);
  context.restore();
};

const drawAxes = (
  context: CanvasRenderingContext2D,
  bounds: Bounds,
  projection: Projection,
  rect: PlotRect,
) => {
  context.save();
  context.strokeStyle = 'rgba(31, 37, 50, 0.14)';
  context.lineWidth = 1;

  if (bounds.minX <= 0 && bounds.maxX >= 0) {
    const [x1, y1] = projection.project([0, bounds.minY]);
    const [x2, y2] = projection.project([0, bounds.maxY]);
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.stroke();
  }

  if (bounds.minY <= 0 && bounds.maxY >= 0) {
    const [x1, y1] = projection.project([bounds.minX, 0]);
    const [x2, y2] = projection.project([bounds.maxX, 0]);
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.stroke();
  }

  context.strokeStyle = 'rgba(31, 37, 50, 0.08)';
  context.strokeRect(rect.x + 18, rect.y + 64, rect.width - 36, rect.height - 84);
  context.restore();
};

const drawMesh = (
  context: CanvasRenderingContext2D,
  points: Point2[],
  columns: number,
  rows: number,
  projection: Projection,
  strokeStyle: string,
  lineWidth: number,
) => {
  context.save();
  context.strokeStyle = strokeStyle;
  context.lineWidth = lineWidth;

  for (let row = 0; row < rows; row += 1) {
    context.beginPath();

    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column;
      const [x, y] = projection.project(points[index]);

      if (column === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }

    context.stroke();
  }

  for (let column = 0; column < columns; column += 1) {
    context.beginPath();

    for (let row = 0; row < rows; row += 1) {
      const index = row * columns + column;
      const [x, y] = projection.project(points[index]);

      if (row === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }

    context.stroke();
  }

  context.restore();
};

const drawPolyline = (
  context: CanvasRenderingContext2D,
  points: Point2[],
  projection: Projection,
  strokeStyle: string,
  lineWidth: number,
  dashed = false,
) => {
  if (points.length === 0) {
    return;
  }

  context.save();
  context.strokeStyle = strokeStyle;
  context.lineWidth = lineWidth;
  context.setLineDash(dashed ? [10, 8] : []);
  context.beginPath();

  points.forEach((point, index) => {
    const [x, y] = projection.project(point);
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });

  context.stroke();
  context.restore();
};

const drawPoint = (
  context: CanvasRenderingContext2D,
  point: Point2,
  projection: Projection,
  fillStyle: string,
  strokeStyle: string,
) => {
  const [x, y] = projection.project(point);
  context.save();
  context.beginPath();
  context.arc(x, y, 6, 0, Math.PI * 2);
  context.fillStyle = fillStyle;
  context.strokeStyle = strokeStyle;
  context.lineWidth = 2;
  context.fill();
  context.stroke();
  context.restore();
};

const drawScene = (canvas: HTMLCanvasElement, snapshot: MappingSnapshot | null) => {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#f9f5ef');
  gradient.addColorStop(1, '#efe8dd');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  if (!snapshot) {
    context.fillStyle = '#1f2532';
    context.font = '700 28px Aptos, Segoe UI, sans-serif';
    context.fillText('Awaiting mapping snapshot...', 64, 120);
    context.fillStyle = '#66707c';
    context.font = '18px Aptos, Segoe UI, sans-serif';
    context.fillText('The frontend is waiting for the native engine to answer.', 64, 158);
    return;
  }

  const plotRects = getPlotRects(canvas.width, canvas.height);
  const domainBounds = {
    minX: snapshot.domain_min_x,
    maxX: snapshot.domain_max_x,
    minY: snapshot.domain_min_y,
    maxY: snapshot.domain_max_y,
  };
  const mappedBounds = getBoundsFromPoints(
    [
      ...snapshot.mapped_points,
      ...snapshot.mapped_neighborhood,
      ...snapshot.linearized_neighborhood,
      snapshot.mapped_point,
    ],
    {
      minX: -snapshot.domain_extent,
      maxX: snapshot.domain_extent,
      minY: -snapshot.domain_extent,
      maxY: snapshot.domain_extent,
    },
  );

  const domainProjection = createProjection(domainBounds, plotRects.domain);
  const imageProjection = createProjection(mappedBounds, plotRects.image);

  drawPanel(context, plotRects.domain, 'Domain sample', 'Click here to move x0');
  drawPanel(context, plotRects.image, 'Mapped image', 'Full map vs local linearization');

  drawAxes(context, domainBounds, domainProjection, plotRects.domain);
  drawAxes(context, mappedBounds, imageProjection, plotRects.image);

  drawMesh(
    context,
    snapshot.domain_points,
    snapshot.grid_columns,
    snapshot.grid_rows,
    domainProjection,
    'rgba(74, 83, 96, 0.46)',
    1.1,
  );
  drawMesh(
    context,
    snapshot.mapped_points,
    snapshot.grid_columns,
    snapshot.grid_rows,
    imageProjection,
    'rgba(36, 95, 93, 0.72)',
    1.4,
  );

  drawPolyline(
    context,
    snapshot.domain_neighborhood,
    domainProjection,
    'rgba(202, 135, 41, 0.9)',
    2.4,
  );
  drawPolyline(
    context,
    snapshot.mapped_neighborhood,
    imageProjection,
    'rgba(202, 135, 41, 0.92)',
    2.8,
  );
  drawPolyline(
    context,
    snapshot.linearized_neighborhood,
    imageProjection,
    'rgba(36, 95, 93, 0.92)',
    2.3,
    true,
  );

  drawPoint(context, snapshot.selected_point, domainProjection, '#fff8ec', '#ca8729');
  drawPoint(context, snapshot.mapped_point, imageProjection, '#f4fffd', '#245f5d');
};

function App() {
  const initialPreset = getMapPreset(DEFAULT_MAP_ID);

  const [mapId, setMapId] = useState(DEFAULT_MAP_ID);
  const [parameterA, setParameterA] = useState(initialPreset.parameterA.defaultValue);
  const [parameterB, setParameterB] = useState(initialPreset.parameterB.defaultValue);
  const [gridColumns, setGridColumns] = useState(DEFAULT_GRID_COLUMNS);
  const [gridRows, setGridRows] = useState(DEFAULT_GRID_ROWS);
  const [domainExtent, setDomainExtent] = useState(initialPreset.defaultExtent);
  const [selectedPoint, setSelectedPoint] = useState<Point2>(initialPreset.defaultPoint);
  const [neighborhoodRadius, setNeighborhoodRadius] = useState(initialPreset.defaultNeighborhood);

  const [snapshot, setSnapshot] = useState<MappingSnapshot | null>(null);
  const [error, setError] = useState('');
  const [isSocketReady, setIsSocketReady] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const lastConfigKeyRef = useRef('');

  const sendSocketMessage = useEffectEvent((payload: unknown) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      return;
    }

    wsRef.current.send(JSON.stringify(payload));
  });

  useEffect(() => {
    const socket = new WebSocket(backendWebSocketUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      lastConfigKeyRef.current = '';
      setIsSocketReady(true);
      setError('');
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'error' || message.error) {
          setError(message.message ?? message.error ?? 'Engine error.');
          return;
        }

        if (message.type === 'state') {
          startTransition(() => {
            setSnapshot(message.data as MappingSnapshot);
          });
          setError('');
        }
      } catch {
        setError('Invalid output from engine.');
      }
    };

    socket.onclose = () => {
      lastConfigKeyRef.current = '';
      setIsSocketReady(false);
    };

    return () => {
      lastConfigKeyRef.current = '';
      setIsSocketReady(false);
      socket.close();
    };
  }, []);

  useEffect(() => {
    if (!isSocketReady) {
      return;
    }

    const nextPoint: Point2 = [
      clamp(selectedPoint[0], -domainExtent, domainExtent),
      clamp(selectedPoint[1], -domainExtent, domainExtent),
    ];
    const nextNeighborhoodRadius = clamp(
      neighborhoodRadius,
      0.05,
      Math.max(0.12, domainExtent * 0.75),
    );
    const configKey = JSON.stringify({
      mapId,
      parameterA,
      parameterB,
      gridColumns,
      gridRows,
      domainExtent,
      selectedPoint: nextPoint,
      neighborhoodRadius: nextNeighborhoodRadius,
    });

    if (lastConfigKeyRef.current === configKey) {
      return;
    }

    lastConfigKeyRef.current = configKey;

    sendSocketMessage({
      type: 'configure',
      data: {
        mapId,
        parameterA,
        parameterB,
        gridColumns,
        gridRows,
        domainExtent,
        selectedX: nextPoint[0],
        selectedY: nextPoint[1],
        neighborhoodRadius: nextNeighborhoodRadius,
      },
    });
  }, [
    domainExtent,
    gridColumns,
    gridRows,
    isSocketReady,
    mapId,
    neighborhoodRadius,
    parameterA,
    parameterB,
    selectedPoint,
    sendSocketMessage,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    drawScene(canvas, snapshot);
  }, [snapshot]);

  const applyPresetDefaults = (nextMapId: typeof mapId) => {
    const preset = getMapPreset(nextMapId);
    setMapId(nextMapId);
    setParameterA(preset.parameterA.defaultValue);
    setParameterB(preset.parameterB.defaultValue);
    setGridColumns(DEFAULT_GRID_COLUMNS);
    setGridRows(DEFAULT_GRID_ROWS);
    setDomainExtent(preset.defaultExtent);
    setSelectedPoint(preset.defaultPoint);
    setNeighborhoodRadius(preset.defaultNeighborhood);
  };

  const handleSelectedPointChange = (axis: 'x' | 'y', value: number) => {
    setSelectedPoint((currentPoint) => {
      const nextPoint: Point2 = [...currentPoint] as Point2;
      const index = axis === 'x' ? 0 : 1;
      nextPoint[index] = clamp(value, -domainExtent, domainExtent);
      return nextPoint;
    });
  };

  const handleDomainExtentChange = (value: number) => {
    const nextExtent = value;
    setDomainExtent(nextExtent);
    setSelectedPoint((currentPoint) => [
      clamp(currentPoint[0], -nextExtent, nextExtent),
      clamp(currentPoint[1], -nextExtent, nextExtent),
    ]);
    setNeighborhoodRadius((currentRadius) =>
      clamp(currentRadius, 0.05, Math.max(0.12, nextExtent * 0.75)),
    );
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const bounds = canvas.getBoundingClientRect();
    const pointer: Point2 = [
      ((event.clientX - bounds.left) / bounds.width) * canvas.width,
      ((event.clientY - bounds.top) / bounds.height) * canvas.height,
    ];
    const plotRects = getPlotRects(canvas.width, canvas.height);

    if (!pointInRect(pointer, plotRects.domain)) {
      return;
    }

    const projection = createProjection(
      {
        minX: -domainExtent,
        maxX: domainExtent,
        minY: -domainExtent,
        maxY: domainExtent,
      },
      plotRects.domain,
    );
    const [nextX, nextY] = projection.unproject(pointer);
    setSelectedPoint([
      clamp(nextX, -domainExtent, domainExtent),
      clamp(nextY, -domainExtent, domainExtent),
    ]);
  };

  const activePreset = getMapPreset(mapId);
  const stageStatusLabel = !isSocketReady
    ? 'Engine offline'
    : snapshot
      ? 'Analysis ready'
      : 'Awaiting engine state';
  const metricCards = [
    {
      label: 'Map',
      value: snapshot?.map_name ?? activePreset.name,
    },
    {
      label: 'Grid',
      value: `${gridColumns} x ${gridRows}`,
    },
    {
      label: 'Point',
      value: formatPoint(selectedPoint),
    },
    {
      label: 'Rank',
      value: snapshot ? `${snapshot.rank}` : '--',
    },
  ];

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Native C++ Differential Analysis</span>
          <h1>Nonlinear Differential Mapping Engine</h1>
          <p>
            Interactive study of nonlinear maps, Jacobians, and local linearization through a
            native C++ engine, Node bridge, and React visualization layer.
          </p>
        </div>

        <div className="hero-metrics">
          {metricCards.map((metric) => (
            <article key={metric.label} className="metric-card">
              <span className="metric-label">{metric.label}</span>
              <strong>{metric.value}</strong>
            </article>
          ))}
        </div>
      </header>

      <main className="workspace">
        <section className="stage-panel card">
          <div className="stage-header">
            <div>
              <span className="section-eyebrow">Live Geometry</span>
              <h2>Domain and transformed image</h2>
              <p className="canvas-caption">
                The left panel shows the sampled domain. The right panel compares the nonlinear
                image of a neighborhood with its Jacobian-based linear approximation.
              </p>
            </div>

            <div className="stage-badges">
              <span className={`status-pill ${!isSocketReady ? 'warning' : 'success'}`}>
                {stageStatusLabel}
              </span>
              <span
                className={`status-pill ${snapshot?.regularity === 'singular' ? 'warning' : 'active'}`}
              >
                {snapshot ? snapshot.regularity : 'Waiting'}
              </span>
            </div>
          </div>

          <div className="canvas-frame">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              onClick={handleCanvasClick}
            />
          </div>

          <div className="legend-row">
            <span className="legend-pill">
              <span className="legend-swatch domain"></span>
              Domain grid
            </span>
            <span className="legend-pill">
              <span className="legend-swatch mapped"></span>
              Transformed grid
            </span>
            <span className="legend-pill">
              <span className="legend-swatch nonlinear"></span>
              Nonlinear neighborhood
            </span>
            <span className="legend-pill">
              <span className="legend-swatch linearized"></span>
              Linearized neighborhood
            </span>
          </div>

          <div className="status-grid">
            <article className="mini-stat">
              <span>Formula</span>
              <strong>{snapshot?.formula ?? activePreset.formula}</strong>
            </article>
            <article className="mini-stat">
              <span>Determinant</span>
              <strong>{snapshot ? formatScalar(snapshot.determinant) : '--'}</strong>
            </article>
            <article className="mini-stat">
              <span>Singular value 1</span>
              <strong>{snapshot ? formatScalar(snapshot.singular_values[0]) : '--'}</strong>
            </article>
            <article className="mini-stat">
              <span>Singular value 2</span>
              <strong>{snapshot ? formatScalar(snapshot.singular_values[1]) : '--'}</strong>
            </article>
            <article className="mini-stat">
              <span>Jacobian</span>
              <strong>
                {snapshot
                  ? `[${formatScalar(snapshot.jacobian[0][0])}, ${formatScalar(snapshot.jacobian[0][1])}] [${formatScalar(snapshot.jacobian[1][0])}, ${formatScalar(snapshot.jacobian[1][1])}]`
                  : '--'}
              </strong>
            </article>
            <article className="mini-stat">
              <span>Mapped point</span>
              <strong>{snapshot ? formatPoint(snapshot.mapped_point) : '--'}</strong>
            </article>
          </div>
        </section>

        <ControlsPanel
          isSocketReady={isSocketReady}
          mapId={mapId}
          parameterA={parameterA}
          parameterB={parameterB}
          gridColumns={gridColumns}
          gridRows={gridRows}
          domainExtent={domainExtent}
          selectedPoint={selectedPoint}
          neighborhoodRadius={neighborhoodRadius}
          error={error}
          onMapChange={applyPresetDefaults}
          onParameterAChange={setParameterA}
          onParameterBChange={setParameterB}
          onGridColumnsChange={setGridColumns}
          onGridRowsChange={setGridRows}
          onDomainExtentChange={handleDomainExtentChange}
          onSelectedPointChange={handleSelectedPointChange}
          onNeighborhoodRadiusChange={setNeighborhoodRadius}
          onResetPreset={() => applyPresetDefaults(mapId)}
          onCenterPoint={() => setSelectedPoint([0, 0])}
        />
      </main>
    </div>
  );
}

export default App;
