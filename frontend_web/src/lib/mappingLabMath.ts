import type { MapId, Point2 } from '../types';

export interface ParameterDefinition {
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  description: string;
  hidden?: boolean;
}

export interface MapPresetDefinition {
  id: MapId;
  name: string;
  formula: string;
  description: string;
  parameterA: ParameterDefinition;
  parameterB: ParameterDefinition;
  defaultPoint: Point2;
  defaultExtent: number;
  defaultNeighborhood: number;
}

export const DEFAULT_GRID_COLUMNS = 17;
export const DEFAULT_GRID_ROWS = 17;
export const DEFAULT_MAP_ID: MapId = 'quadratic_map';

const MAP_PRESET_DEFINITIONS: Record<MapId, MapPresetDefinition> = {
  linear_shear: {
    id: 'linear_shear',
    name: 'Linear shear',
    formula: 'f(x, y) = (x + k y, y)',
    description:
      'A clean linear example for seeing how the Jacobian acts as the map itself everywhere.',
    parameterA: {
      label: 'Shear k',
      min: -2,
      max: 2,
      step: 0.05,
      defaultValue: 0.9,
      description: 'Tilts horizontal lines while keeping vertical position unchanged.',
    },
    parameterB: {
      label: 'Unused',
      min: 0,
      max: 0,
      step: 1,
      defaultValue: 0,
      description: '',
      hidden: true,
    },
    defaultPoint: [0.8, 0.35],
    defaultExtent: 2,
    defaultNeighborhood: 0.32,
  },
  anisotropic_scaling: {
    id: 'anisotropic_scaling',
    name: 'Anisotropic scaling',
    formula: 'f(x, y) = (lambda1 x, lambda2 y)',
    description:
      'A diagonal linear map that stretches one axis differently from the other.',
    parameterA: {
      label: 'Lambda 1',
      min: -2,
      max: 2,
      step: 0.05,
      defaultValue: 1.35,
      description: 'Horizontal scaling factor.',
    },
    parameterB: {
      label: 'Lambda 2',
      min: -2,
      max: 2,
      step: 0.05,
      defaultValue: 0.65,
      description: 'Vertical scaling factor.',
    },
    defaultPoint: [0.9, 0.6],
    defaultExtent: 2,
    defaultNeighborhood: 0.28,
  },
  quadratic_map: {
    id: 'quadratic_map',
    name: 'Quadratic map',
    formula: 'f(x, y) = (x^2 - y^2, 2xy)',
    description:
      'The classic complex squaring map. Great for observing directional stretching and folding.',
    parameterA: {
      label: 'Unused',
      min: 0,
      max: 0,
      step: 1,
      defaultValue: 0,
      description: '',
      hidden: true,
    },
    parameterB: {
      label: 'Unused',
      min: 0,
      max: 0,
      step: 1,
      defaultValue: 0,
      description: '',
      hidden: true,
    },
    defaultPoint: [0.85, 0.45],
    defaultExtent: 2,
    defaultNeighborhood: 0.3,
  },
  cubic_distortion: {
    id: 'cubic_distortion',
    name: 'Cubic distortion',
    formula: 'f(x, y) = (x + alpha x^3, y + beta y^3)',
    description:
      'A smooth nonlinear distortion where the derivative changes gradually across the domain.',
    parameterA: {
      label: 'Alpha',
      min: -0.45,
      max: 0.45,
      step: 0.01,
      defaultValue: 0.18,
      description: 'Controls horizontal cubic warping.',
    },
    parameterB: {
      label: 'Beta',
      min: -0.45,
      max: 0.45,
      step: 0.01,
      defaultValue: -0.12,
      description: 'Controls vertical cubic warping.',
    },
    defaultPoint: [1.1, -0.55],
    defaultExtent: 2,
    defaultNeighborhood: 0.34,
  },
  singular_fold: {
    id: 'singular_fold',
    name: 'Singular fold',
    formula: 'f(x, y) = (s x^2, y + t x)',
    description:
      'A rank-dropping example. Move the selected point toward x = 0 to hit a singular Jacobian.',
    parameterA: {
      label: 'Scale s',
      min: -2,
      max: 2,
      step: 0.05,
      defaultValue: 1,
      description: 'Scales the folding strength in the first component.',
    },
    parameterB: {
      label: 'Tilt t',
      min: -2,
      max: 2,
      step: 0.05,
      defaultValue: 0,
      description: 'Adds a linear tilt in the second component.',
    },
    defaultPoint: [0.15, 0.4],
    defaultExtent: 2,
    defaultNeighborhood: 0.3,
  },
};

export const MAP_PRESET_ORDER: MapId[] = [
  'linear_shear',
  'anisotropic_scaling',
  'quadratic_map',
  'cubic_distortion',
  'singular_fold',
];

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const getMapPreset = (mapId: MapId) => MAP_PRESET_DEFINITIONS[mapId];

export const formatPoint = ([x, y]: Point2) => `(${x.toFixed(2)}, ${y.toFixed(2)})`;

export const formatScalar = (value: number) => {
  if (Math.abs(value) >= 100 || Math.abs(value) < 0.01) {
    return value.toExponential(2);
  }

  return value.toFixed(3);
};
