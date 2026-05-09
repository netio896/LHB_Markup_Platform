export const SCHEMA_VERSION = 'lhb-markup-v1' as const;

export type Role = 'viewer' | 'editor';

export interface Project {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  name: string;
  code: string;
  client: string;
  location: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Floor {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  project_id: string;
  level: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DrawingVersion {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  project_id: string;
  floor_id: string;
  version: string;
  source_file_name: string;
  source_file_type: string;
  source_file_size: number;
  source_file_ref: string;
  width_mm: number;
  height_mm: number;
  created_by: string;
  created_at: string;
}

export interface Marker {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  project_id: string;
  floor_id: string;
  drawing_version_id: string;
  label: string;
  type: string;
  discipline: string;
  x_percent: number;
  y_percent: number;
  status: string;
  note: string;
  mounting_height: string;
  circuit_or_pipe_note: string;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface AuditEvent {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  before_data: string | null;
  after_data: string | null;
  actor: string;
  created_at: string;
}

export interface ImportPayload {
  schemaVersion: typeof SCHEMA_VERSION;
  project: Project;
  floors: Floor[];
  drawingVersions: DrawingVersion[];
  markers: Marker[];
}

