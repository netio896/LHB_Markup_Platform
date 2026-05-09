import {SCHEMA_VERSION} from './prototype-contract.mjs';

export const TOOL_MANIFEST = {
  schemaVersion: SCHEMA_VERSION,
  title: 'LHB Markup Platform Tool Gateway',
  description: 'Local API tools for Hermes and OpenClaw to inspect and edit markup data.',
  tools: [
    {
      name: 'health',
      method: 'GET',
      path: '/api/health',
      role: 'viewer',
      description: 'Get service health and storage counts.',
    },
    {
      name: 'list_projects',
      method: 'GET',
      path: '/api/projects',
      role: 'viewer',
      description: 'List all projects.',
    },
    {
      name: 'get_project_bundle',
      method: 'GET',
      path: '/api/projects/{projectId}',
      role: 'viewer',
      description: 'Load one project with floors, drawing versions, and markers.',
    },
    {
      name: 'list_floors',
      method: 'GET',
      path: '/api/floors?projectId={projectId}',
      role: 'viewer',
      description: 'List floors. Optional project filter.',
    },
    {
      name: 'list_drawing_versions',
      method: 'GET',
      path: '/api/drawing-versions?projectId={projectId}&floorId={floorId}',
      role: 'viewer',
      description: 'List drawing versions. Optional project and floor filters.',
    },
    {
      name: 'list_markers',
      method: 'GET',
      path: '/api/markers?projectId={projectId}&floorId={floorId}&drawingVersionId={drawingVersionId}',
      role: 'viewer',
      description: 'List markers with optional project, floor, and drawing version filters.',
    },
    {
      name: 'list_audit_events',
      method: 'GET',
      path: '/api/audit-events?limit={limit}',
      role: 'viewer',
      description: 'List recent audit trail events.',
    },
    {
      name: 'export_snapshot',
      method: 'GET',
      path: '/api/export.json',
      role: 'editor',
      description: 'Export the full JSON snapshot.',
    },
    {
      name: 'export_pdf',
      method: 'GET',
      path: '/api/export.pdf',
      role: 'editor',
      description: 'Export a summary PDF.',
    },
    {
      name: 'create_project',
      method: 'POST',
      path: '/api/tools/create_project',
      role: 'editor',
      description: 'Create or update a project.',
    },
    {
      name: 'create_floor',
      method: 'POST',
      path: '/api/tools/create_floor',
      role: 'editor',
      description: 'Create or update a floor.',
    },
    {
      name: 'create_drawing_version_from_upload',
      method: 'POST',
      path: '/api/tools/create_drawing_version_from_upload',
      role: 'editor',
      description: 'Store a drawing file and create a drawing version in one step.',
    },
    {
      name: 'delete_drawing_version',
      method: 'POST',
      path: '/api/tools/delete_drawing_version',
      role: 'editor',
      description: 'Delete a drawing version and its linked upload file.',
    },
    {
      name: 'create_marker',
      method: 'POST',
      path: '/api/tools/create_marker',
      role: 'editor',
      description: 'Create a marker.',
    },
    {
      name: 'update_marker',
      method: 'POST',
      path: '/api/tools/update_marker',
      role: 'editor',
      description: 'Update a marker by id.',
    },
    {
      name: 'delete_marker',
      method: 'POST',
      path: '/api/tools/delete_marker',
      role: 'editor',
      description: 'Delete a marker by id.',
    },
    {
      name: 'import_snapshot',
      method: 'POST',
      path: '/api/tools/import_snapshot',
      role: 'editor',
      description: 'Import a full schemaVersion-compatible snapshot.',
    },
  ],
};

export function getToolDefinition(toolName) {
  return TOOL_MANIFEST.tools.find((tool) => tool.name === toolName) || null;
}
