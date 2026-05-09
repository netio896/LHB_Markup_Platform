import fs from 'node:fs';
import path from 'node:path';
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {
  deleteMarker,
  deleteDrawingVersion,
  exportSnapshot,
  getCounts,
  getProjectBundle,
  importSnapshot,
  listAuditEvents,
  listDrawingVersions,
  listFloors,
  listMarkers,
  listProjects,
  updateMarker,
  upsertDrawingVersion,
  upsertFloor,
  upsertMarker,
  upsertProject,
} from './prototype-db.mjs';
import {ROLES, SCHEMA_VERSION} from './prototype-contract.mjs';
import {buildSummaryPdf} from './prototype-pdf.mjs';
import {TOOL_MANIFEST, getToolDefinition} from './prototype-tools.mjs';
import {
  DATA_DIR,
  ensurePrototypeStorage,
  readJsonBody,
  resolveUploadPath,
  storeUploadFromBuffer,
  storeUploadFromRequest,
  UPLOADS_DIR,
} from './prototype-storage.mjs';

ensurePrototypeStorage();

const PORT = Number(process.env.LHB_MARKUP_PORT || 8787);
const HOST = process.env.LHB_MARKUP_HOST || '127.0.0.1';
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-LHB-Role, X-LHB-Actor',
  };
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    ...corsHeaders(),
    ...extraHeaders,
  });
  res.end(body);
}

function sendText(res, statusCode, text, extraHeaders = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    ...corsHeaders(),
    ...extraHeaders,
  });
  res.end(text);
}

function sendPdf(res, pdfBuffer, extraHeaders = {}) {
  res.writeHead(200, {
    'Content-Type': 'application/pdf',
    'Content-Length': pdfBuffer.length,
    ...corsHeaders(),
    ...extraHeaders,
  });
  res.end(pdfBuffer);
}

function parseRole(req) {
  const rawRole = String(req.headers['x-lhb-role'] || '').toLowerCase();
  const role = rawRole === ROLES.EDITOR ? ROLES.EDITOR : ROLES.VIEWER;
  return {
    role,
    actor: String(req.headers['x-lhb-actor'] || 'local-user').trim() || 'local-user',
  };
}

function requireEditor(req, res, principal) {
  if (principal.role !== ROLES.EDITOR) {
    sendJson(res, 403, {error: 'editor role required'});
    return false;
  }
  return true;
}

function requireToolRole(req, res, principal, toolDefinition) {
  if (!toolDefinition) {
    sendJson(res, 404, {error: 'Tool not found'});
    return false;
  }
  if (toolDefinition.role === ROLES.EDITOR && principal.role !== ROLES.EDITOR) {
    sendJson(res, 403, {error: 'editor role required'});
    return false;
  }
  return true;
}

function getBodyError(error) {
  return String(error?.message || error || 'Request failed');
}

async function handleGetUpload(req, res, fileRef, options = {}) {
  try {
    const absolutePath = resolveUploadPath(fileRef);
    await fs.promises.access(absolutePath, fs.constants.R_OK);
    const stat = await fs.promises.stat(absolutePath);
    res.writeHead(200, {
      'Content-Type': options.contentType || 'application/octet-stream',
      'Content-Length': stat.size,
      'Content-Disposition': `inline; filename="${options.fileName || path.basename(absolutePath)}"`,
      ...corsHeaders(),
    });
    createReadStream(absolutePath).pipe(res);
  } catch (error) {
    sendJson(res, 404, {error: 'Upload not found', detail: getBodyError(error)});
  }
}

async function runTool(toolName, body, principal) {
  switch (toolName) {
    case 'health':
      return {
        ok: true,
        schemaVersion: SCHEMA_VERSION,
        role: principal.role,
        counts: getCounts(),
      };
    case 'list_projects':
      return {projects: listProjects()};
    case 'get_project_bundle': {
      const bundle = getProjectBundle(String(body?.projectId || body?.project_id || '').trim());
      if (!bundle) {
        throw new Error('Project not found');
      }
      return bundle;
    }
    case 'list_floors':
      return {floors: listFloors(String(body?.projectId || body?.project_id || '').trim() || null)};
    case 'list_drawing_versions':
      return {
        drawingVersions: listDrawingVersions(
          String(body?.projectId || body?.project_id || '').trim() || null,
          String(body?.floorId || body?.floor_id || '').trim() || null,
        ),
      };
    case 'list_markers':
      return {
        markers: listMarkers({
          projectId: String(body?.projectId || body?.project_id || '').trim() || null,
          floorId: String(body?.floorId || body?.floor_id || '').trim() || null,
          drawingVersionId: String(body?.drawingVersionId || body?.drawing_version_id || '').trim() || null,
        }),
      };
    case 'list_audit_events':
      return {auditEvents: listAuditEvents(body?.limit || 100)};
    case 'export_snapshot':
      return exportSnapshot();
    case 'export_pdf': {
      const snapshot = exportSnapshot();
      return {
        filename: 'lhb-markup-export.pdf',
        contentType: 'application/pdf',
        generatedAt: snapshot.generatedAt,
        pdfBase64: buildSummaryPdf({
          title: 'LHB Markup Platform v1 Export',
          lines: [
            `Schema version: ${snapshot.schemaVersion}`,
            `Generated at: ${snapshot.generatedAt}`,
            `Projects: ${snapshot.projects.length}`,
            `Floors: ${snapshot.floors.length}`,
            `Drawing versions: ${snapshot.drawingVersions.length}`,
            `Markers: ${snapshot.markers.length}`,
            `Audit events: ${snapshot.auditEvents.length}`,
          ],
        }).toString('base64'),
      };
    }
    case 'create_project':
      return {project: upsertProject(body, principal.actor)};
    case 'create_floor':
      return {floor: upsertFloor(body, principal.actor)};
    case 'create_drawing_version_from_upload': {
      const rawBase64 = String(body?.contentBase64 || '').replace(/^data:.*;base64,/, '');
      const fileName = String(body?.sourceFileName || body?.filename || 'upload.bin');
      if (!rawBase64) {
        throw new Error('contentBase64 is required');
      }
      const buffer = Buffer.from(rawBase64, 'base64');
      const upload = await storeUploadFromBuffer(buffer, fileName);
      const drawingVersion = upsertDrawingVersion(
        {
          ...body,
          sourceFileName: fileName,
          sourceFileType: String(body?.sourceFileType || body?.contentType || '').trim(),
          sourceFileSize: buffer.length,
          sourceFileRef: upload.fileRef,
          createdBy: body?.createdBy || principal.actor,
        },
        principal.actor,
      );
      return {upload, drawingVersion};
    }
    case 'delete_drawing_version': {
      const deleted = await deleteDrawingVersion(String(body?.id || body?.drawingVersionId || body?.drawing_version_id || '').trim(), principal.actor);
      if (!deleted) {
        throw new Error('Drawing version not found');
      }
      return {deleted: true, drawingVersion: deleted};
    }
    case 'create_marker':
      return {marker: upsertMarker(body, principal.actor)};
    case 'update_marker':
      return {marker: updateMarker(String(body?.id || body?.markerId || '').trim(), body, principal.actor)};
    case 'delete_marker': {
      const deleted = deleteMarker(String(body?.id || body?.markerId || '').trim(), principal.actor);
      if (!deleted) {
        throw new Error('Marker not found');
      }
      return {deleted: true, marker: deleted};
    }
    case 'import_snapshot':
      return importSnapshot(body, principal.actor);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

async function routeRequest(req, res) {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  const segments = url.pathname.split('/').filter(Boolean);
  const principal = parseRole(req);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  if (url.pathname === '/') {
    sendText(res, 200, 'LHB Markup Platform prototype API');
    return;
  }

  if (url.pathname === '/health' || url.pathname === '/api/health') {
    sendJson(res, 200, {
      ok: true,
      schemaVersion: SCHEMA_VERSION,
      role: principal.role,
      counts: getCounts(),
      storage: {
        dataDir: DATA_DIR,
        uploadsDir: UPLOADS_DIR,
      },
    });
    return;
  }

  if (segments[0] !== 'api') {
    sendJson(res, 404, {error: 'Not found'});
    return;
  }

  if (segments[1] === 'tools' && req.method === 'GET' && segments.length === 2) {
    sendJson(res, 200, TOOL_MANIFEST);
    return;
  }

  if (segments[1] === 'tools' && req.method === 'GET' && segments[2]) {
    const tool = getToolDefinition(segments[2]);
    if (!tool) {
      sendJson(res, 404, {error: 'Tool not found'});
      return;
    }
    sendJson(res, 200, {tool});
    return;
  }

  if (segments[1] === 'tools' && req.method === 'POST' && segments[2]) {
    const tool = getToolDefinition(segments[2]);
    if (!requireToolRole(req, res, principal, tool)) return;
    try {
      const body = await readJsonBody(req);
      const result = await runTool(segments[2], body || {}, principal);
      sendJson(res, 200, {ok: true, tool: segments[2], result});
    } catch (error) {
      sendJson(res, 400, {error: getBodyError(error)});
    }
    return;
  }

  if (req.method === 'GET' && segments[1] === 'projects' && segments.length === 2) {
    sendJson(res, 200, {projects: listProjects()});
    return;
  }

  if (req.method === 'GET' && segments[1] === 'projects' && segments[2]) {
    const bundle = getProjectBundle(segments[2]);
    if (!bundle) {
      sendJson(res, 404, {error: 'Project not found'});
      return;
    }
    sendJson(res, 200, bundle);
    return;
  }

  if (req.method === 'GET' && segments[1] === 'floors') {
    sendJson(res, 200, {floors: listFloors(url.searchParams.get('projectId'))});
    return;
  }

  if (req.method === 'GET' && segments[1] === 'drawing-versions' && segments[2] && segments[3] === 'file') {
    const bundle = listDrawingVersions().find((item) => item.id === segments[2]);
    if (!bundle) {
      sendJson(res, 404, {error: 'Drawing version not found'});
      return;
    }
    await handleGetUpload(req, res, bundle.source_file_ref, {
      contentType: bundle.source_file_type || 'application/octet-stream',
      fileName: bundle.source_file_name,
    });
    return;
  }

  if (req.method === 'GET' && segments[1] === 'drawing-versions') {
    const projectId = url.searchParams.get('projectId');
    const floorId = url.searchParams.get('floorId');
    sendJson(res, 200, {drawingVersions: listDrawingVersions(projectId, floorId)});
    return;
  }

  if (req.method === 'DELETE' && segments[1] === 'drawing-versions' && segments[2]) {
    if (!requireEditor(req, res, principal)) return;
    try {
      const deleted = await deleteDrawingVersion(segments[2], principal.actor);
      if (!deleted) {
        sendJson(res, 404, {error: 'Drawing version not found'});
        return;
      }
      sendJson(res, 200, {deleted: true, drawingVersion: deleted});
    } catch (error) {
      sendJson(res, 400, {error: getBodyError(error)});
    }
    return;
  }

  if (req.method === 'GET' && segments[1] === 'markers') {
    sendJson(res, 200, {
      markers: listMarkers({
        projectId: url.searchParams.get('projectId'),
        floorId: url.searchParams.get('floorId'),
        drawingVersionId: url.searchParams.get('drawingVersionId'),
      }),
    });
    return;
  }

  if (req.method === 'GET' && segments[1] === 'audit-events') {
    sendJson(res, 200, {auditEvents: listAuditEvents(url.searchParams.get('limit') || 100)});
    return;
  }

  if (req.method === 'GET' && segments[1] === 'uploads' && segments[2]) {
    await handleGetUpload(req, res, `uploads/${segments.slice(2).join('/')}`);
    return;
  }

  if (req.method === 'GET' && segments[1] === 'export.json') {
    if (!requireEditor(req, res, principal)) return;
    sendJson(res, 200, exportSnapshot());
    return;
  }

  if (req.method === 'GET' && segments[1] === 'export.pdf') {
    if (!requireEditor(req, res, principal)) return;
    const snapshot = exportSnapshot();
    const pdf = buildSummaryPdf({
      title: 'LHB Markup Platform v1 Export',
      lines: [
        `Schema version: ${snapshot.schemaVersion}`,
        `Generated at: ${snapshot.generatedAt}`,
        `Projects: ${snapshot.projects.length}`,
        `Floors: ${snapshot.floors.length}`,
        `Drawing versions: ${snapshot.drawingVersions.length}`,
        `Markers: ${snapshot.markers.length}`,
        `Audit events: ${snapshot.auditEvents.length}`,
      ],
    });
    sendPdf(res, pdf, {
      'Content-Disposition': 'attachment; filename="lhb-markup-export.pdf"',
    });
    return;
  }

  if (req.method === 'POST' && segments[1] === 'import') {
    if (!requireEditor(req, res, principal)) return;
    try {
      const body = await readJsonBody(req);
      const result = importSnapshot(body, principal.actor);
      sendJson(res, 200, {ok: true, ...result});
    } catch (error) {
      sendJson(res, 400, {error: getBodyError(error)});
    }
    return;
  }

  if (req.method === 'POST' && segments[1] === 'projects') {
    if (!requireEditor(req, res, principal)) return;
    try {
      const body = await readJsonBody(req);
      const saved = upsertProject(body, principal.actor);
      sendJson(res, 201, {project: saved});
    } catch (error) {
      sendJson(res, 400, {error: getBodyError(error)});
    }
    return;
  }

  if (req.method === 'POST' && segments[1] === 'floors') {
    if (!requireEditor(req, res, principal)) return;
    try {
      const body = await readJsonBody(req);
      const saved = upsertFloor(body, principal.actor);
      sendJson(res, 201, {floor: saved});
    } catch (error) {
      sendJson(res, 400, {error: getBodyError(error)});
    }
    return;
  }

  if (req.method === 'POST' && segments[1] === 'drawing-versions') {
    if (!requireEditor(req, res, principal)) return;
    try {
      const body = await readJsonBody(req);
      const saved = upsertDrawingVersion(body, principal.actor);
      sendJson(res, 201, {drawingVersion: saved});
    } catch (error) {
      sendJson(res, 400, {error: getBodyError(error)});
    }
    return;
  }

  if (req.method === 'POST' && segments[1] === 'markers') {
    if (!requireEditor(req, res, principal)) return;
    try {
      const body = await readJsonBody(req);
      const saved = upsertMarker(body, principal.actor);
      sendJson(res, 201, {marker: saved});
    } catch (error) {
      sendJson(res, 400, {error: getBodyError(error)});
    }
    return;
  }

  if (req.method === 'PATCH' && segments[1] === 'markers' && segments[2]) {
    if (!requireEditor(req, res, principal)) return;
    try {
      const body = await readJsonBody(req);
      const saved = upsertMarker({id: segments[2], ...body}, principal.actor);
      sendJson(res, 200, {marker: saved});
    } catch (error) {
      sendJson(res, 400, {error: getBodyError(error)});
    }
    return;
  }

  if (req.method === 'DELETE' && segments[1] === 'markers' && segments[2]) {
    if (!requireEditor(req, res, principal)) return;
    try {
      const deleted = deleteMarker(segments[2], principal.actor);
      if (!deleted) {
        sendJson(res, 404, {error: 'Marker not found'});
        return;
      }
      sendJson(res, 200, {deleted: true, marker: deleted});
    } catch (error) {
      sendJson(res, 400, {error: getBodyError(error)});
    }
    return;
  }

  if (req.method === 'PUT' && segments[1] === 'uploads' && segments[2]) {
    if (!requireEditor(req, res, principal)) return;
    try {
      const originalName = decodeURIComponent(segments.slice(2).join('/'));
      const stored = await storeUploadFromRequest(req, originalName);
      sendJson(res, 201, {
        ok: true,
        ...stored,
        originalName,
      });
    } catch (error) {
      sendJson(res, 400, {error: getBodyError(error)});
    }
    return;
  }

  sendJson(res, 404, {error: 'Not found'});
}

const server = createServer((req, res) => {
  routeRequest(req, res).catch((error) => {
    sendJson(res, 500, {error: getBodyError(error)});
  });
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`LHB Markup prototype API listening on http://${HOST}:${PORT}\n`);
});
