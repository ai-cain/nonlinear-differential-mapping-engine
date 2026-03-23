import type { ReactNode } from 'react';
import type { MapId, Point2 } from '../types';
import { MAP_PRESET_ORDER, getMapPreset } from '../lib/mappingLabMath';

interface ControlsPanelProps {
  isSocketReady: boolean;
  mapId: MapId;
  parameterA: number;
  parameterB: number;
  gridColumns: number;
  gridRows: number;
  domainExtent: number;
  selectedPoint: Point2;
  neighborhoodRadius: number;
  error: string;
  onMapChange: (value: MapId) => void;
  onParameterAChange: (value: number) => void;
  onParameterBChange: (value: number) => void;
  onGridColumnsChange: (value: number) => void;
  onGridRowsChange: (value: number) => void;
  onDomainExtentChange: (value: number) => void;
  onSelectedPointChange: (axis: 'x' | 'y', value: number) => void;
  onNeighborhoodRadiusChange: (value: number) => void;
  onResetPreset: () => void;
  onCenterPoint: () => void;
}

interface SliderFieldProps {
  label: string;
  valueLabel: string;
  value: number;
  min: number;
  max: number;
  step: number;
  inputDecimals?: number;
  onChange: (value: number) => void;
}

interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}

interface PanelSectionProps {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
}

const SliderField = ({
  label,
  valueLabel,
  value,
  min,
  max,
  step,
  inputDecimals = 2,
  onChange,
}: SliderFieldProps) => (
  <div className="slider-field">
    <div className="field-heading">
      <label>{label}</label>
      <span className="field-value">{valueLabel}</span>
    </div>
    <div className="field-controls">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(parseFloat(event.target.value))}
      />
      <input
        className="value-input"
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number(value.toFixed(inputDecimals))}
        onChange={(event) => {
          const nextValue = parseFloat(event.target.value);
          if (!Number.isNaN(nextValue)) {
            onChange(nextValue);
          }
        }}
      />
    </div>
  </div>
);

const SelectField = <T extends string,>({
  label,
  value,
  options,
  onChange,
}: SelectFieldProps<T>) => (
  <div className="select-field">
    <label>{label}</label>
    <select value={value} onChange={(event) => onChange(event.target.value as T)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
);

const PanelSection = ({ eyebrow, title, description, children }: PanelSectionProps) => (
  <section className="panel-section">
    <div className="section-heading">
      <span className="section-eyebrow">{eyebrow}</span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
    </div>
    {children}
  </section>
);

function ControlsPanel({
  isSocketReady,
  mapId,
  parameterA,
  parameterB,
  gridColumns,
  gridRows,
  domainExtent,
  selectedPoint,
  neighborhoodRadius,
  error,
  onMapChange,
  onParameterAChange,
  onParameterBChange,
  onGridColumnsChange,
  onGridRowsChange,
  onDomainExtentChange,
  onSelectedPointChange,
  onNeighborhoodRadiusChange,
  onResetPreset,
  onCenterPoint,
}: ControlsPanelProps) {
  const preset = getMapPreset(mapId);
  const hasVisibleParameters = !preset.parameterA.hidden || !preset.parameterB.hidden;

  return (
    <aside className="controls-panel card">
      <div className="panel-intro">
        <div>
          <span className="section-eyebrow">Controls</span>
          <h2>Mapping setup</h2>
          <p>Choose a map, tune coefficients, and inspect the derivative around a selected point.</p>
        </div>
        <span className={`connection-pill ${isSocketReady ? 'success' : 'warning'}`}>
          {isSocketReady ? 'Engine ready' : 'Engine offline'}
        </span>
      </div>

      <div className="panel-actions">
        <button type="button" onClick={onResetPreset} className="btn-primary">
          Reset preset
        </button>
        <button type="button" onClick={onCenterPoint} className="btn-secondary">
          Center point
        </button>
      </div>

      <div className="panel-scroll">
        <PanelSection
          eyebrow="Preset"
          title="Active map"
          description="Each preset highlights a different local geometric behavior."
        >
          <SelectField
            label="Map preset"
            value={mapId}
            onChange={onMapChange}
            options={MAP_PRESET_ORDER.map((presetId) => {
              const optionPreset = getMapPreset(presetId);
              return { value: presetId, label: optionPreset.name };
            })}
          />
          <div className="formula-card">
            <strong>{preset.formula}</strong>
            <p>{preset.description}</p>
          </div>
        </PanelSection>

        <PanelSection
          eyebrow="Parameters"
          title="Map coefficients"
          description="The Jacobian refreshes immediately as coefficients or the point move."
        >
          {hasVisibleParameters ? (
            <>
              {!preset.parameterA.hidden && (
                <SliderField
                  label={preset.parameterA.label}
                  valueLabel={parameterA.toFixed(2)}
                  value={parameterA}
                  min={preset.parameterA.min}
                  max={preset.parameterA.max}
                  step={preset.parameterA.step}
                  onChange={onParameterAChange}
                />
              )}
              {!preset.parameterB.hidden && (
                <SliderField
                  label={preset.parameterB.label}
                  valueLabel={parameterB.toFixed(2)}
                  value={parameterB}
                  min={preset.parameterB.min}
                  max={preset.parameterB.max}
                  step={preset.parameterB.step}
                  onChange={onParameterBChange}
                />
              )}
            </>
          ) : (
            <div className="model-note">
              This preset has no free coefficients. Move the analysis point to compare different
              local derivatives across the domain.
            </div>
          )}
        </PanelSection>

        <PanelSection
          eyebrow="Sampling"
          title="Domain sampling"
          description="Higher grid densities show the deformation more clearly, but increase payload size."
        >
          <SliderField
            label="Grid columns"
            valueLabel={`${gridColumns} lines`}
            value={gridColumns}
            min={7}
            max={33}
            step={1}
            inputDecimals={0}
            onChange={onGridColumnsChange}
          />
          <SliderField
            label="Grid rows"
            valueLabel={`${gridRows} lines`}
            value={gridRows}
            min={7}
            max={33}
            step={1}
            inputDecimals={0}
            onChange={onGridRowsChange}
          />
          <SliderField
            label="Domain extent"
            valueLabel={`[-${domainExtent.toFixed(2)}, ${domainExtent.toFixed(2)}]`}
            value={domainExtent}
            min={0.75}
            max={4.5}
            step={0.01}
            onChange={onDomainExtentChange}
          />
        </PanelSection>

        <PanelSection
          eyebrow="Analysis"
          title="Local study point"
          description="Click the left plot or use these controls to position the neighborhood."
        >
          <SliderField
            label="Selected x"
            valueLabel={selectedPoint[0].toFixed(2)}
            value={selectedPoint[0]}
            min={-domainExtent}
            max={domainExtent}
            step={0.01}
            onChange={(value) => onSelectedPointChange('x', value)}
          />
          <SliderField
            label="Selected y"
            valueLabel={selectedPoint[1].toFixed(2)}
            value={selectedPoint[1]}
            min={-domainExtent}
            max={domainExtent}
            step={0.01}
            onChange={(value) => onSelectedPointChange('y', value)}
          />
          <SliderField
            label="Neighborhood radius"
            valueLabel={neighborhoodRadius.toFixed(2)}
            value={neighborhoodRadius}
            min={0.05}
            max={Math.max(0.12, domainExtent * 0.75)}
            step={0.01}
            onChange={onNeighborhoodRadiusChange}
          />
          <div className="model-note">
            Left panel: original grid. Right panel: nonlinear image and dashed Jacobian-based
            linearization.
          </div>
        </PanelSection>

        {error && <div className="error full-width">{error}</div>}
      </div>
    </aside>
  );
}

export default ControlsPanel;
