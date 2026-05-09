import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {DB_PATH, deleteUploadRef, ensurePrototypeStorage} from './prototype-storage.mjs';
import {SCHEMA_VERSION} from './prototype-contract.mjs';

ensurePrototypeStorage();

export const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    schema_version TEXT NOT NULL,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    client TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS floors (
    id TEXT PRIMARY KEY,
    schema_version TEXT NOT NULL,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    level TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(project_id, level)
  );

  CREATE TABLE IF NOT EXISTS drawing_versions (
    id TEXT PRIMARY KEY,
    schema_version TEXT NOT NULL,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    floor_id TEXT NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    version TEXT NOT NULL,
    source_file_name TEXT NOT NULL,
    source_file_type TEXT NOT NULL DEFAULT '',
    source_file_size INTEGER NOT NULL DEFAULT 0,
    source_file_ref TEXT NOT NULL,
    width_mm REAL NOT NULL DEFAULT 0,
    height_mm REAL NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(project_id, floor_id, version)
  );

  CREATE TABLE IF NOT EXISTS markers (
    id TEXT PRIMARY KEY,
    schema_version TEXT NOT NULL,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    floor_id TEXT NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    drawing_version_id TEXT NOT NULL REFERENCES drawing_versions(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'NOTE',
    discipline TEXT NOT NULL DEFAULT 'Coordination',
    x_percent REAL NOT NULL DEFAULT 0,
    y_percent REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    note TEXT NOT NULL DEFAULT '',
    mounting_height TEXT NOT NULL DEFAULT '',
    circuit_or_pipe_note TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL DEFAULT '',
    updated_by TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    schema_version TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    before_data TEXT,
    after_data TEXT,
    actor TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_floors_project_id ON floors(project_id);
  CREATE INDEX IF NOT EXISTS idx_drawing_versions_project_id ON drawing_versions(project_id);
  CREATE INDEX IF NOT EXISTS idx_drawing_versions_floor_id ON drawing_versions(floor_id);
  CREATE INDEX IF NOT EXISTS idx_markers_project_id ON markers(project_id);
  CREATE INDEX IF NOT EXISTS idx_markers_floor_id ON markers(floor_id);
  CREATE INDEX IF NOT EXISTS idx_markers_drawing_version_id ON markers(drawing_version_id);
  CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON audit_events(entity_type, entity_id);
  CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at);
`);

function timestamp() {
  return new Date().toISOString();
}

function shortCode(prefix) {
  return `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function excelLabel(index) {
  let value = index;
  let label = '';
  while (value >= 0) {
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26) - 1;
  }
  return label;
}

function nextDrawingVersionLabel(existingVersions, preferredVersion = 'A') {
  const taken = new Set(
    existingVersions
      .map((item) => String(item.version || '').trim().toUpperCase())
      .filter(Boolean),
  );
  const preferred = String(preferredVersion || 'A').trim().toUpperCase() || 'A';
  if (!taken.has(preferred)) {
    return preferred;
  }

  for (let index = 0; index < 5000; index += 1) {
    const candidate = excelLabel(index);
    if (!taken.has(candidate)) {
      return candidate;
    }
  }

  throw new Error('Unable to allocate drawing version label');
}

function asJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function firstDefined(input, ...keys) {
  for (const key of keys) {
    if (input && input[key] !== undefined && input[key] !== null) {
      return input[key];
    }
  }
  return undefined;
}

function toProjectApi(rowValue) {
  if (!rowValue) return null;
  return {
    schemaVersion: SCHEMA_VERSION,
    id: rowValue.id,
    name: rowValue.name,
    code: rowValue.code,
    client: rowValue.client,
    location: rowValue.location,
    status: rowValue.status,
    created_at: rowValue.created_at,
    updated_at: rowValue.updated_at,
  };
}

function toFloorApi(rowValue) {
  if (!rowValue) return null;
  return {
    schemaVersion: SCHEMA_VERSION,
    id: rowValue.id,
    project_id: rowValue.project_id,
    level: rowValue.level,
    name: rowValue.name,
    sort_order: rowValue.sort_order,
    created_at: rowValue.created_at,
    updated_at: rowValue.updated_at,
  };
}

function toDrawingVersionApi(rowValue) {
  if (!rowValue) return null;
  return {
    schemaVersion: SCHEMA_VERSION,
    id: rowValue.id,
    project_id: rowValue.project_id,
    floor_id: rowValue.floor_id,
    version: rowValue.version,
    source_file_name: rowValue.source_file_name,
    source_file_type: rowValue.source_file_type,
    source_file_size: rowValue.source_file_size,
    source_file_ref: rowValue.source_file_ref,
    width_mm: rowValue.width_mm,
    height_mm: rowValue.height_mm,
    created_by: rowValue.created_by,
    created_at: rowValue.created_at,
    updated_at: rowValue.updated_at,
  };
}

function toMarkerApi(rowValue) {
  if (!rowValue) return null;
  return {
    schemaVersion: SCHEMA_VERSION,
    id: rowValue.id,
    project_id: rowValue.project_id,
    floor_id: rowValue.floor_id,
    drawing_version_id: rowValue.drawing_version_id,
    label: rowValue.label,
    type: rowValue.type,
    discipline: rowValue.discipline,
    x_percent: rowValue.x_percent,
    y_percent: rowValue.y_percent,
    status: rowValue.status,
    note: rowValue.note,
    mounting_height: rowValue.mounting_height,
    circuit_or_pipe_note: rowValue.circuit_or_pipe_note,
    created_by: rowValue.created_by,
    updated_by: rowValue.updated_by,
    created_at: rowValue.created_at,
    updated_at: rowValue.updated_at,
  };
}

function toAuditEventApi(rowValue) {
  if (!rowValue) return null;
  return {
    schemaVersion: SCHEMA_VERSION,
    id: rowValue.id,
    entity_type: rowValue.entity_type,
    entity_id: rowValue.entity_id,
    action: rowValue.action,
    before_data: rowValue.before_data,
    after_data: rowValue.after_data,
    actor: rowValue.actor,
    created_at: rowValue.created_at,
  };
}

function row(stmt, ...params) {
  return stmt.get(...params) || null;
}

function rows(stmt, ...params) {
  return stmt.all(...params);
}

function insertAuditEvent({entityType, entityId, action, beforeData, afterData, actor}) {
  db.prepare(`
    INSERT INTO audit_events (
      id, schema_version, entity_type, entity_id, action, before_data, after_data, actor, created_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `).run(
    randomUUID(),
    SCHEMA_VERSION,
    entityType,
    entityId,
    action,
    beforeData == null ? null : JSON.stringify(beforeData),
    afterData == null ? null : JSON.stringify(afterData),
    actor || '',
    timestamp(),
  );
}

function normalizeProject(input = {}) {
  const name = String(firstDefined(input, 'name') || '').trim();
  if (!name) throw new Error('Project name is required');
  return {
    id: String(firstDefined(input, 'id') || randomUUID()),
    schemaVersion: SCHEMA_VERSION,
    name,
    code: String(firstDefined(input, 'code') || shortCode('PROJ')).trim() || shortCode('PROJ'),
    client: String(firstDefined(input, 'client') || '').trim(),
    location: String(firstDefined(input, 'location') || '').trim(),
    status: String(firstDefined(input, 'status') || 'active').trim() || 'active',
  };
}

function normalizeFloor(input = {}) {
  const projectId = String(firstDefined(input, 'projectId', 'project_id') || '').trim();
  const level = String(firstDefined(input, 'level') || '').trim();
  if (!projectId) throw new Error('projectId is required');
  if (!level) throw new Error('Floor level is required');
  return {
    id: String(firstDefined(input, 'id') || randomUUID()),
    schemaVersion: SCHEMA_VERSION,
    projectId,
    level,
    name: String(firstDefined(input, 'name') || level).trim(),
    sortOrder: Number.isFinite(Number(firstDefined(input, 'sortOrder', 'sort_order'))) ? Number(firstDefined(input, 'sortOrder', 'sort_order')) : 0,
  };
}

function normalizeDrawingVersion(input = {}) {
  const projectId = String(firstDefined(input, 'projectId', 'project_id') || '').trim();
  const floorId = String(firstDefined(input, 'floorId', 'floor_id') || '').trim();
  const version = String(firstDefined(input, 'version') || '').trim();
  const sourceFileName = String(firstDefined(input, 'sourceFileName', 'source_file_name') || '').trim();
  const sourceFileRef = String(firstDefined(input, 'sourceFileRef', 'source_file_ref') || '').trim();
  if (!projectId) throw new Error('projectId is required');
  if (!floorId) throw new Error('floorId is required');
  if (!version) throw new Error('version is required');
  if (!sourceFileName) throw new Error('sourceFileName is required');
  if (!sourceFileRef) throw new Error('sourceFileRef is required');
  return {
    id: String(firstDefined(input, 'id') || randomUUID()),
    schemaVersion: SCHEMA_VERSION,
    projectId,
    floorId,
    version,
    sourceFileName,
    sourceFileType: String(firstDefined(input, 'sourceFileType', 'source_file_type') || '').trim(),
    sourceFileSize: Number.isFinite(Number(firstDefined(input, 'sourceFileSize', 'source_file_size'))) ? Number(firstDefined(input, 'sourceFileSize', 'source_file_size')) : 0,
    sourceFileRef,
    widthMm: Number.isFinite(Number(firstDefined(input, 'widthMm', 'width_mm'))) ? Number(firstDefined(input, 'widthMm', 'width_mm')) : 0,
    heightMm: Number.isFinite(Number(firstDefined(input, 'heightMm', 'height_mm'))) ? Number(firstDefined(input, 'heightMm', 'height_mm')) : 0,
    createdBy: String(firstDefined(input, 'createdBy', 'created_by') || '').trim(),
  };
}

function normalizeMarker(input = {}) {
  const projectId = String(firstDefined(input, 'projectId', 'project_id') || '').trim();
  const floorId = String(firstDefined(input, 'floorId', 'floor_id') || '').trim();
  const drawingVersionId = String(firstDefined(input, 'drawingVersionId', 'drawing_version_id') || '').trim();
  if (!projectId) throw new Error('projectId is required');
  if (!floorId) throw new Error('floorId is required');
  if (!drawingVersionId) throw new Error('drawingVersionId is required');
  return {
    id: String(firstDefined(input, 'id') || randomUUID()),
    schemaVersion: SCHEMA_VERSION,
    projectId,
    floorId,
    drawingVersionId,
    label: String(firstDefined(input, 'label') || shortCode('MK')).trim(),
    type: String(firstDefined(input, 'type') || 'NOTE').trim() || 'NOTE',
    discipline: String(firstDefined(input, 'discipline') || 'Coordination').trim() || 'Coordination',
    xPercent: Number.isFinite(Number(firstDefined(input, 'xPercent', 'x_percent'))) ? Number(firstDefined(input, 'xPercent', 'x_percent')) : 0,
    yPercent: Number.isFinite(Number(firstDefined(input, 'yPercent', 'y_percent'))) ? Number(firstDefined(input, 'yPercent', 'y_percent')) : 0,
    status: String(firstDefined(input, 'status') || 'DRAFT').trim() || 'DRAFT',
    note: String(firstDefined(input, 'note') || '').trim(),
    mountingHeight: String(firstDefined(input, 'mountingHeight', 'mounting_height') || '').trim(),
    circuitOrPipeNote: String(firstDefined(input, 'circuitOrPipeNote', 'circuit_or_pipe_note') || '').trim(),
    createdBy: String(firstDefined(input, 'createdBy', 'created_by') || '').trim(),
    updatedBy: String(firstDefined(input, 'updatedBy', 'updated_by') || '').trim(),
  };
}

export function listProjects() {
  return rows(db.prepare(`SELECT * FROM projects ORDER BY created_at ASC`)).map(toProjectApi);
}

export function getProject(projectId) {
  return toProjectApi(row(db.prepare(`SELECT * FROM projects WHERE id = ?`), projectId));
}

export function listFloors(projectId = null) {
  if (projectId) {
    return rows(db.prepare(`SELECT * FROM floors WHERE project_id = ? ORDER BY sort_order ASC, created_at ASC`), projectId).map(toFloorApi);
  }
  return rows(db.prepare(`SELECT * FROM floors ORDER BY sort_order ASC, created_at ASC`)).map(toFloorApi);
}

export function listDrawingVersions(projectId = null, floorId = null) {
  if (projectId && floorId) {
    return rows(
      db.prepare(`SELECT * FROM drawing_versions WHERE project_id = ? AND floor_id = ? ORDER BY created_at ASC`),
      projectId,
      floorId,
    ).map(toDrawingVersionApi);
  }
  if (projectId) {
    return rows(
      db.prepare(`SELECT * FROM drawing_versions WHERE project_id = ? ORDER BY created_at ASC`),
      projectId,
    ).map(toDrawingVersionApi);
  }
  return rows(db.prepare(`SELECT * FROM drawing_versions ORDER BY created_at ASC`)).map(toDrawingVersionApi);
}

export function listMarkers({projectId = null, floorId = null, drawingVersionId = null} = {}) {
  const clauses = [];
  const params = [];
  if (projectId) {
    clauses.push('project_id = ?');
    params.push(projectId);
  }
  if (floorId) {
    clauses.push('floor_id = ?');
    params.push(floorId);
  }
  if (drawingVersionId) {
    clauses.push('drawing_version_id = ?');
    params.push(drawingVersionId);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return rows(db.prepare(`SELECT * FROM markers ${where} ORDER BY created_at ASC`), ...params).map(toMarkerApi);
}

export function listAuditEvents(limit = 100) {
  const safeLimit = Math.max(1, Math.min(1000, Number(limit) || 100));
  return rows(
    db.prepare(`SELECT * FROM audit_events ORDER BY created_at DESC LIMIT ?`),
    safeLimit,
  ).map(toAuditEventApi);
}

export function upsertProject(input, actor = 'system') {
  const payload = normalizeProject(input);
  const existing = getProject(payload.id);
  const createdAt = existing?.created_at || timestamp();
  const updatedAt = timestamp();

  db.prepare(`
    INSERT INTO projects (
      id, schema_version, name, code, client, location, status, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      schema_version = excluded.schema_version,
      name = excluded.name,
      code = excluded.code,
      client = excluded.client,
      location = excluded.location,
      status = excluded.status,
      updated_at = excluded.updated_at
  `).run(
    payload.id,
    payload.schemaVersion,
    payload.name,
    payload.code,
    payload.client,
    payload.location,
    payload.status,
    createdAt,
    updatedAt,
  );

  const saved = getProject(payload.id);
  insertAuditEvent({
    entityType: 'project',
    entityId: payload.id,
    action: existing ? 'update' : 'create',
    beforeData: existing,
    afterData: saved,
    actor,
  });
  return saved;
}

export function upsertFloor(input, actor = 'system') {
  const payload = normalizeFloor(input);
  const existing = listFloors().find((item) => item.id === payload.id);
  const createdAt = existing?.created_at || timestamp();
  const updatedAt = timestamp();

  db.prepare(`
    INSERT INTO floors (
      id, schema_version, project_id, level, name, sort_order, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      schema_version = excluded.schema_version,
      project_id = excluded.project_id,
      level = excluded.level,
      name = excluded.name,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at
  `).run(
    payload.id,
    payload.schemaVersion,
    payload.projectId,
    payload.level,
    payload.name,
    payload.sortOrder,
    createdAt,
    updatedAt,
  );

  const saved = listFloors().find((item) => item.id === payload.id);
  insertAuditEvent({
    entityType: 'floor',
    entityId: payload.id,
    action: existing ? 'update' : 'create',
    beforeData: existing,
    afterData: saved,
    actor,
  });
  return saved;
}

export function upsertDrawingVersion(input, actor = 'system') {
  const payload = normalizeDrawingVersion(input);
  const existing = listDrawingVersions().find((item) => item.id === payload.id);
  const versionsForFloor = listDrawingVersions(payload.projectId, payload.floorId);
  const existingByVersion = versionsForFloor.find(
    (item) => String(item.version || '').trim().toUpperCase() === payload.version.trim().toUpperCase(),
  );
  if (existingByVersion && existingByVersion.id !== payload.id) {
    payload.version = nextDrawingVersionLabel(versionsForFloor, payload.version);
  }
  const createdAt = existing?.created_at || timestamp();
  const updatedAt = timestamp();

  db.prepare(`
    INSERT INTO drawing_versions (
      id, schema_version, project_id, floor_id, version, source_file_name, source_file_type,
      source_file_size, source_file_ref, width_mm, height_mm, created_by, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      schema_version = excluded.schema_version,
      project_id = excluded.project_id,
      floor_id = excluded.floor_id,
      version = excluded.version,
      source_file_name = excluded.source_file_name,
      source_file_type = excluded.source_file_type,
      source_file_size = excluded.source_file_size,
      source_file_ref = excluded.source_file_ref,
      width_mm = excluded.width_mm,
      height_mm = excluded.height_mm,
      created_by = excluded.created_by,
      updated_at = excluded.updated_at
  `).run(
    payload.id,
    payload.schemaVersion,
    payload.projectId,
    payload.floorId,
    payload.version,
    payload.sourceFileName,
    payload.sourceFileType,
    payload.sourceFileSize,
    payload.sourceFileRef,
    payload.widthMm,
    payload.heightMm,
    payload.createdBy,
    createdAt,
    updatedAt,
  );

  const saved = listDrawingVersions().find((item) => item.id === payload.id);
  insertAuditEvent({
    entityType: 'drawing_version',
    entityId: payload.id,
    action: existing ? 'update' : 'create',
    beforeData: existing,
    afterData: saved,
    actor,
  });
  return saved;
}

export function upsertMarker(input, actor = 'system') {
  const payload = normalizeMarker(input);
  const existing = listMarkers().find((item) => item.id === payload.id);
  const createdAt = existing?.created_at || timestamp();
  const updatedAt = timestamp();

  db.prepare(`
    INSERT INTO markers (
      id, schema_version, project_id, floor_id, drawing_version_id, label, type, discipline,
      x_percent, y_percent, status, note, mounting_height, circuit_or_pipe_note,
      created_by, updated_by, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      schema_version = excluded.schema_version,
      project_id = excluded.project_id,
      floor_id = excluded.floor_id,
      drawing_version_id = excluded.drawing_version_id,
      label = excluded.label,
      type = excluded.type,
      discipline = excluded.discipline,
      x_percent = excluded.x_percent,
      y_percent = excluded.y_percent,
      status = excluded.status,
      note = excluded.note,
      mounting_height = excluded.mounting_height,
      circuit_or_pipe_note = excluded.circuit_or_pipe_note,
      created_by = excluded.created_by,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at
  `).run(
    payload.id,
    payload.schemaVersion,
    payload.projectId,
    payload.floorId,
    payload.drawingVersionId,
    payload.label,
    payload.type,
    payload.discipline,
    payload.xPercent,
    payload.yPercent,
    payload.status,
    payload.note,
    payload.mountingHeight,
    payload.circuitOrPipeNote,
    payload.createdBy,
    payload.updatedBy,
    createdAt,
    updatedAt,
  );

  const saved = listMarkers().find((item) => item.id === payload.id);
  insertAuditEvent({
    entityType: 'marker',
    entityId: payload.id,
    action: existing ? 'update' : 'create',
    beforeData: existing,
    afterData: saved,
    actor,
  });
  return saved;
}

export function updateMarker(markerId, patch, actor = 'system') {
  const existing = listMarkers().find((item) => item.id === markerId);
  if (!existing) {
    throw new Error('Marker not found');
  }
  return upsertMarker(
    {
      ...existing,
      ...patch,
      id: markerId,
      createdBy: firstDefined(existing, 'createdBy', 'created_by'),
      updatedBy: firstDefined(patch, 'updatedBy', 'updated_by') || actor,
    },
    actor,
  );
}

export function deleteMarker(markerId, actor = 'system') {
  const existing = listMarkers().find((item) => item.id === markerId);
  if (!existing) {
    return null;
  }
  db.prepare(`DELETE FROM markers WHERE id = ?`).run(markerId);
  insertAuditEvent({
    entityType: 'marker',
    entityId: markerId,
    action: 'delete',
    beforeData: existing,
    afterData: null,
    actor,
  });
  return existing;
}

export async function deleteDrawingVersion(drawingVersionId, actor = 'system') {
  const existing = listDrawingVersions().find((item) => item.id === drawingVersionId);
  if (!existing) {
    return null;
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`DELETE FROM drawing_versions WHERE id = ?`).run(drawingVersionId);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  try {
    await deleteUploadRef(existing.source_file_ref);
  } catch {
    // Ignore missing upload files. Database deletion already succeeded.
  }

  insertAuditEvent({
    entityType: 'drawing_version',
    entityId: drawingVersionId,
    action: 'delete',
    beforeData: existing,
    afterData: null,
    actor,
  });
  return existing;
}

export function getProjectBundle(projectId) {
  const project = getProject(projectId);
  if (!project) return null;
  const floors = listFloors(projectId);
  const drawingVersions = listDrawingVersions(projectId);
  const markers = listMarkers({projectId});
  return {project, floors, drawingVersions, markers};
}

export function exportSnapshot() {
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: timestamp(),
    projects: listProjects(),
    floors: listFloors(),
    drawingVersions: listDrawingVersions(),
    markers: listMarkers(),
    auditEvents: listAuditEvents(200),
  };
}

export function importSnapshot(snapshot, actor = 'import') {
  if (!snapshot || snapshot.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`Unsupported schema version: ${snapshot?.schemaVersion || 'missing'}`);
  }

  const projects = Array.isArray(snapshot.projects) ? snapshot.projects : [];
  const floors = Array.isArray(snapshot.floors) ? snapshot.floors : [];
  const drawingVersions = Array.isArray(snapshot.drawingVersions) ? snapshot.drawingVersions : [];
  const markers = Array.isArray(snapshot.markers) ? snapshot.markers : [];

  db.exec('BEGIN IMMEDIATE');
  try {
    for (const item of projects) {
      upsertProject(item, actor);
    }
    for (const item of floors) {
      upsertFloor(item, actor);
    }
    for (const item of drawingVersions) {
      upsertDrawingVersion(item, actor);
    }
    for (const item of markers) {
      upsertMarker(item, actor);
    }
    db.exec('COMMIT');
    return {
      imported: {
        projects: projects.length,
        floors: floors.length,
        drawingVersions: drawingVersions.length,
        markers: markers.length,
      },
    };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function getCounts() {
  return {
    projects: row(db.prepare(`SELECT COUNT(*) AS count FROM projects`))?.count || 0,
    floors: row(db.prepare(`SELECT COUNT(*) AS count FROM floors`))?.count || 0,
    drawingVersions: row(db.prepare(`SELECT COUNT(*) AS count FROM drawing_versions`))?.count || 0,
    markers: row(db.prepare(`SELECT COUNT(*) AS count FROM markers`))?.count || 0,
    auditEvents: row(db.prepare(`SELECT COUNT(*) AS count FROM audit_events`))?.count || 0,
  };
}
