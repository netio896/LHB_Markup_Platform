# LHB Markup Platform v1 Prototype Implementation Plan

Status: PLANNING ONLY / NO CODE CHANGE / NO RUNTIME / NO DEPLOYMENT

## 1. Goal

Build a local internal prototype of the LHB Markup Platform that supports engineering markup workflows for project drawings, marker placement, and controlled export/import.

The prototype should be useful for internal coordination and review, while staying clearly outside official company record and production usage.

## 2. Allowed Scope

- Local internal prototype only
- Backend-controlled secret handling
- Project, floor, and drawing version structure
- JSON import/export
- PDF export
- Audit trail concept

## 3. Not Allowed Scope

- Official company record system
- Production deployment
- Real approval workflow
- Procurement workflow
- BOQ workflow
- Site instruction workflow

## 4. Proposed Local Architecture

Recommended local-first structure:

- Frontend: React + Vite UI for drawing upload, marker placement, marker editing, and review
- Backend/API: local service for persistence, exports, and secure AI integration later
- Storage: SQLite for project metadata, floors, drawing versions, markers, and audit events
- File storage: local uploads folder for drawing files
- Export pipeline: backend generates PDF and structured JSON exports

Suggested separation of responsibilities:

- Frontend handles interaction and display only
- Backend handles persistence, versioning, export generation, and all secret usage
- AI calls never occur directly in browser code

## 5. Frontend Changes Needed

- Add project selector
- Add floor selector
- Add drawing version selector
- Add clearer project header and context summary
- Keep marker placement on the canvas
- Keep marker editing in a detail panel
- Add read-only mode for viewers
- Replace demo branding with LHB markup prototype branding
- Add explicit export/import entry points for JSON and PDF

Frontend should remain simple and focused:

- canvas first
- metadata second
- list and history side panel
- no approval workflow UI yet

## 6. Backend/API Changes Needed

Backend should provide:

- Project CRUD
- Floor CRUD
- Drawing version CRUD
- Marker CRUD
- Audit event recording
- JSON import/export endpoints
- PDF export endpoint

Backend should also:

- enforce permissions
- store timestamps and user attribution
- keep drawing version history
- validate import schema
- serialize stable export formats

Backend permission model:

- `viewer` = read-only
- `editor` = create/edit/delete markers and import/export

## 7. Data Model

### project

- `schemaVersion`: `lhb-markup-v1`
- `id`
- `name`
- `code`
- `client`
- `location`
- `status`
- `created_at`
- `updated_at`

### floor

- `schemaVersion`: `lhb-markup-v1`
- `id`
- `project_id`
- `level`
- `name`
- `sort_order`
- `created_at`
- `updated_at`

### drawing version

- `schemaVersion`: `lhb-markup-v1`
- `id`
- `project_id`
- `floor_id`
- `version`
- `source_file_name`
- `source_file_type`
- `source_file_size`
- `source_file_ref`
- `width_mm`
- `height_mm`
- `created_by`
- `created_at`

Drawing file lifecycle:

- upload
- store locally
- assign to project/floor/drawingVersion
- reopen later
- export with linked marker data

### marker

- `schemaVersion`: `lhb-markup-v1`
- `id`
- `project_id`
- `floor_id`
- `drawing_version_id`
- `label`
- `type`
- `discipline`
- `x_percent`
- `y_percent`
- `status`
- `note`
- `mounting_height`
- `circuit_or_pipe_note`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`

### audit event

- `schemaVersion`: `lhb-markup-v1`
- `id`
- `entity_type`
- `entity_id`
- `action`
- `before_data`
- `after_data`
- `actor`
- `created_at`

Audit events should record:

- create
- update
- delete
- import
- export
- version change

## 8. Security

Security requirements:

- Backend-controlled secrets only
- No browser-exposed API key
- No direct secret injection into frontend bundles
- Any AI provider key stays server-side
- Secrets should be loaded from backend environment variables or secure local config

Implementation rule:

- The browser may request an AI-related action, but it must never receive the raw secret

## 9. Export / Import

### JSON

JSON export should include:

- `schemaVersion: lhb-markup-v1`
- project
- floor
- drawing version
- markers
- audit snapshot or export metadata

JSON import should:

- validate schema
- require `schemaVersion`
- preserve stable IDs when appropriate
- reject malformed data
- create audit events for import actions

### PDF

PDF export should include:

- project summary
- floor and drawing version metadata
- rendered markup drawing
- marker list
- marker status summary
- export timestamp

PDF export should be generated server-side for consistency and to avoid browser rendering limitations.

## 10. v1 Acceptance Criteria

v1 is acceptable when:

- A user can create or open a project
- A user can select a floor and drawing version
- A user can upload a drawing and place markers
- A user can edit and delete markers
- A user can import and export JSON
- A user can export PDF
- The system records audit events for meaningful changes
- No API key is exposed in the browser
- The app remains a local internal prototype only

## 11. Next Step After Alan Approval

After Alan approves the scope:

1. Build the local backend/API skeleton
2. Define the persistent schema for project, floor, drawing version, marker, and audit event
3. Refactor the frontend to consume backend data instead of local-only storage
4. Add JSON export/import endpoints
5. Add PDF export generation
6. Add controlled secret handling on the backend
7. Then evaluate whether AI assistance should be connected later

Future phase items:

- Optional AI helper endpoint
- Reviewer mode
- Full change-history UI
