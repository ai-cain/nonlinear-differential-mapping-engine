export type MapId =
  | 'linear_shear'
  | 'anisotropic_scaling'
  | 'quadratic_map'
  | 'cubic_distortion'
  | 'singular_fold';

export type Regularity = 'regular' | 'singular';
export type Point2 = [number, number];
export type Matrix2 = [Point2, Point2];

export interface MappingSnapshot {
  revision: number;
  map_id: MapId;
  map_name: string;
  formula: string;
  parameter_a: number;
  parameter_b: number;
  grid_columns: number;
  grid_rows: number;
  domain_extent: number;
  domain_min_x: number;
  domain_max_x: number;
  domain_min_y: number;
  domain_max_y: number;
  selected_point: Point2;
  mapped_point: Point2;
  neighborhood_radius: number;
  jacobian: Matrix2;
  determinant: number;
  rank: number;
  singular_values: Point2;
  regularity: Regularity;
  domain_points: Point2[];
  mapped_points: Point2[];
  domain_neighborhood: Point2[];
  mapped_neighborhood: Point2[];
  linearized_neighborhood: Point2[];
}
