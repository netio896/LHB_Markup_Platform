# LHB Engineering Markup Platform Upgrade Roadmap

Status: planning only

This roadmap is based on the read-only review of `./lhb-engineering-markup-platform.zip`.

## Guiding Direction

Current state:

- Single-page React + Vite markup prototype
- Local image upload and marker editing already work
- JSON/CSV export exists
- No backend, no roles, no audit trail, no versioning, no multi-project management
- Client-side Gemini key handling is unsafe for company-grade use

Target state:

- A reusable internal engineering markup tool
- Safe secret handling
- Multi-project and multi-floor workflow support
- Permissioned editing and review
- Exportable records for engineering coordination
- Optional AI assistance through a controlled backend or local gateway

## Phase 0. Keep The Prototype Contained

Goal:

- Keep the current app isolated from official company records
- Treat it as a demo or sandbox until workflow controls exist

Actions:

- Do not store real project records in the current client-only app
- Keep AI credentials out of browser-delivered code
- Use a separate test project namespace for all prototype work

Exit criteria:

- The team agrees this is a sandbox, not a production system
- No official records are being written through this app

## Phase 1. Safe Local App Conversion

Goal:

- Convert the demo into a local-first Vite app that can evolve cleanly

Actions:

- Remove any client-side secret injection pattern
- Move any AI calls behind a local API or proxy
- Keep the UI behavior unchanged while the application boundary is improved
- Normalize project naming away from the current demo-oriented labels

Exit criteria:

- No private API key is exposed to the browser bundle
- App still loads and supports upload, markup, and export
- The UI is clearly framed as an internal tool

## Phase 2. Core Workflow Structure

Goal:

- Introduce the minimum structure needed for actual engineering work

Add:

- Project selector
- Floor selector
- Discipline selector with clearer workflow meaning
- Drawing version selector
- Document metadata panel

Actions:

- Make project and floor selection first-class state
- Separate drawing identity from marker identity
- Track revision and version history explicitly

Exit criteria:

- A user can switch between projects and floors without losing context
- Markups remain tied to the correct project and version

## Phase 3. Review And Permission Model

Goal:

- Add editing control and traceability

Add:

- Role permissions
- Read-only review mode
- Markup author attribution
- Change history
- Delete confirmation with audit trail

Actions:

- Define roles such as admin, engineer, reviewer, and viewer
- Restrict destructive actions to privileged users
- Record who created or edited each marker

Exit criteria:

- Not every user can edit or delete
- Every meaningful change is attributable
- Reviews can be separated from editing

## Phase 4. Record Quality And Exports

Goal:

- Make the output usable as a project record, not only a screen overlay

Add:

- PDF export
- JSON export with versioned schema
- CSV export for tabular handoff
- Drawing revision archive
- Marker history export

Actions:

- Standardize export schema
- Include project, floor, version, author, timestamp, and status fields
- Add stable IDs for projects, drawings, and markers

Exit criteria:

- Exported data can be re-imported cleanly
- Records are useful outside the browser

## Phase 5. AI Workflow Integration

Goal:

- Add AI assistance without making the browser the trust boundary

Add:

- Hermes/OpenClaw assisted review later
- Comment summarization
- Markup suggestion assistance
- Issue extraction from notes

Actions:

- Keep AI behind a backend or local gateway
- Feed AI only the minimum required context
- Avoid direct exposure of secrets or company records in client code

Exit criteria:

- AI can assist review without holding the primary source of truth
- Human review remains the approval gate

## Phase 6. Company Data Boundary

Goal:

- Decide whether this becomes an internal company system

If yes:

- Add project ownership
- Add tenant or company scope
- Add storage backups
- Add audit retention policy
- Add import/export controls

If no:

- Keep it as a personal or pre-production tool
- Do not use it for official drawings, approvals, or procurement records

Exit criteria:

- The app has a documented data ownership model
- The boundary between personal sandbox and company records is explicit

## Recommended Build Order

1. Remove browser-exposed secret handling
2. Add project/floor/version structure
3. Add roles and audit trail
4. Add PDF and richer exports
5. Add AI assist through a controlled backend
6. Only then consider company-record usage

## Not Recommended Yet

- Direct production deployment
- Use as the authoritative company drawing register
- Connection to Hermes/OpenClaw before secret handling and role control are fixed
- Storing official project records in the current prototype state

## Success Criteria

The platform is ready for company-grade use only when:

- Secrets are not exposed in client bundles
- Projects, floors, and drawing versions are explicit
- Editing is permissioned
- Changes are audited
- Exports are standardized
- The app has a clear data ownership boundary

