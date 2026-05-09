# LHB Engineering Markup Platform Read-Only Review

Status: READ-ONLY REVIEW ONLY / NO INSTALL / NO RUNTIME / NO PRODUCTION DEPLOYMENT

Reviewed from `./lhb-engineering-markup-platform.zip` after extraction into `./_review_lhb_engineering_markup_platform/`.

## 1. Framework And Dependencies

This is a React 19 + Vite 6 frontend project with Tailwind and motion-based UI animation.

- Framework entry is React + Vite in [src/main.tsx](./_review_lhb_engineering_markup_platform/src/main.tsx)
- Build tooling is Vite with `@vitejs/plugin-react` and `@tailwindcss/vite` in [vite.config.ts](./_review_lhb_engineering_markup_platform/vite.config.ts)
- UI dependencies include `lucide-react` and `motion`
- AI-related dependency present: `@google/genai`
- Runtime helper dependencies present: `express` and `dotenv`

Important note: the project is still a single-page client app; there is no evidence here of a backend service, persistence API, or server-side workflow engine.

## 2. Main Functions In `src/App.tsx`

The app is a single-screen engineering markup workspace centered on one uploaded drawing and a set of markers.

Main flows:

- Project bootstrap/setup dialog for project name, code, client, location, floor level, revision, discipline, and drawing size
- Upload a base drawing image as a floor plan
- Click-to-place markers on the drawing
- Select a marker and edit its fields
- Delete a marker from the canvas
- Filter markers by discipline layer
- Import/export project data as JSON
- Export marker data as CSV
- Persist project, markers, and floor plan in `localStorage` with an in-memory fallback

Key implementation points:

- State is stored in `useState` and persisted with a small `storage` helper in [src/App.tsx](./_review_lhb_engineering_markup_platform/src/App.tsx#L114)
- Marker placement is done by clicking on the canvas and storing relative `xPercent` / `yPercent` coordinates in [src/App.tsx](./_review_lhb_engineering_markup_platform/src/App.tsx#L212)
- Project export writes JSON in [src/App.tsx](./_review_lhb_engineering_markup_platform/src/App.tsx#L273)
- CSV export writes marker rows in [src/App.tsx](./_review_lhb_engineering_markup_platform/src/App.tsx#L283)
- Import replaces the current in-memory project after confirmation in [src/App.tsx](./_review_lhb_engineering_markup_platform/src/App.tsx#L307)

## 3. Is It Generic Enough For LHB Projects?

Partially.

It is not RC2-only in a strict sense because the data model is already project-oriented:

- project name
- project code
- client
- location
- floor level
- revision
- discipline
- drawing dimensions

However, the current UI copy and defaults are still LHB/Alan-specific and not cleanly neutral:

- sidebar branding says `LHB Hub` in [src/App.tsx](./_review_lhb_engineering_markup_platform/src/App.tsx#L351)
- status text says `LHB-PRELIMINARY` in [src/App.tsx](./_review_lhb_engineering_markup_platform/src/App.tsx#L448)
- footer says `For Alan + Engineer Review` and `Preliminary Engineering Markup Only` in [src/App.tsx](./_review_lhb_engineering_markup_platform/src/App.tsx#L762)
- setup header says `LHB Engineering Platform Initial Setup` in [src/App.tsx](./_review_lhb_engineering_markup_platform/src/App.tsx#L800)

Conclusion: it is more like a generic preliminary markup prototype branded for one LHB workflow than a reusable multi-project company platform.

## 4. Upload / Markup / Component Placement Features

Yes, basic features exist.

Present:

- Drawing upload via file input in [src/App.tsx](./_review_lhb_engineering_markup_platform/src/App.tsx#L503)
- Base plan image rendered as the canvas background in [src/App.tsx](./_review_lhb_engineering_markup_platform/src/App.tsx#L536)
- Marker placement by clicking the canvas in [src/App.tsx](./_review_lhb_engineering_markup_platform/src/App.tsx#L212)
- Tool palette for many marker types in [src/App.tsx](./_review_lhb_engineering_markup_platform/src/App.tsx#L477)
- Marker status, note, revision, mounting height, and circuit/pipe reference editing in [src/App.tsx](./_review_lhb_engineering_markup_platform/src/App.tsx#L604)

Limits:

- There is no drag-and-drop placement
- There is no snapping, grid locking, rotate, resize, or multi-select
- There is no true component library management; it is marker stamping on a single floor plan image

## 5. Coordinates, Component List, Delete/Edit, Export/Save Logic

Coordinates:

- Yes. Marker positions are stored as percentages in `xPercent` / `yPercent`
- Yes. The UI converts them to mm using drawing width/height when displaying details and exports
- No. There is no absolute coordinate grid editor or calibration workflow

Component list:

- Yes. The right-side list shows markers under `Drawing Database` in [src/App.tsx](./_review_lhb_engineering_markup_platform/src/App.tsx#L679)
- Filtering exists by discipline layer
- The list is marker-centric rather than component-type-centric

Delete/Edit:

- Yes. Marker delete is present in [src/App.tsx](./_review_lhb_engineering_markup_platform/src/App.tsx#L265)
- Yes. Marker edit fields are present in the details panel in [src/App.tsx](./_review_lhb_engineering_markup_platform/src/App.tsx#L604)

Export/Save:

- Yes. JSON export exists in [src/App.tsx](./_review_lhb_engineering_markup_platform/src/App.tsx#L273)
- Yes. CSV export exists in [src/App.tsx](./_review_lhb_engineering_markup_platform/src/App.tsx#L283)
- Yes. Import exists in [src/App.tsx](./_review_lhb_engineering_markup_platform/src/App.tsx#L307)
- Yes. Auto-save to `localStorage` exists in [src/App.tsx](./_review_lhb_engineering_markup_platform/src/App.tsx#L182)
- No. There is no PDF export
- No. There is no cloud sync or server-backed save

## 6. Security Risks Around `GEMINI_API_KEY`

There is a real client-side secret exposure risk pattern here.

Evidence:

- `vite.config.ts` injects `process.env.GEMINI_API_KEY` into the frontend bundle at build time in [vite.config.ts](./_review_lhb_engineering_markup_platform/vite.config.ts#L10-L12)
- `README.md` instructs the user to set `GEMINI_API_KEY` in `.env.local`
- `package.json` includes `@google/genai`

Risk assessment:

- If frontend code reads `process.env.GEMINI_API_KEY`, the key can end up in browser-delivered code or be trivially recoverable from built assets
- Even if not currently used in `App.tsx`, the build-time exposure pattern is unsafe for anything meant to stay secret
- This is acceptable only for a demo sandbox where the key is intentionally a browser-usable demo credential, not a private server secret

Recommendation:

- Do not treat `GEMINI_API_KEY` as a protected backend secret in this architecture
- For production or internal company use, move Gemini calls behind a server or local proxy, or remove the secret from the client build entirely

## 7. Missing Engineering Workflow Features

Missing or incomplete for a real engineering workflow:

- Project selector
- Floor selector
- Discipline selector beyond the current simple layer toggle
- Role permissions and access control
- Export to PDF
- Export to structured JSON/CSV with richer schema validation
- Drawing version tracking and revision history
- Audit trail for edits/deletes/imports
- Multi-drawing navigation
- Search/filter by tag, system, zone, or issue owner
- Commenting or review thread workflow
- Approval status workflow
- Server-side persistence and backups

Current version tracking is only shallow:

- one `revision` string per project
- one `revision` string per marker
- no history timeline, compare, or restore point

## 8. Recommendation

Best fit:

1. Keep as an AI Studio demo if the goal is a quick prototype or showcase.
2. Convert to a local Vite app if you want a reusable offline-first internal tool.
3. Connect later to Hermes/OpenClaw if you want AI-assisted review, but only after separating secrets and adding a real backend or local API layer.
4. Keep it isolated from official company records until it has explicit project selector, permissions, audit trail, and export/version controls.

My recommendation:

- Keep it isolated from official company records for now
- Convert it to a local Vite app only if you want to extend the workflow
- Do not attach it directly to Hermes/OpenClaw in production form yet

## Short Conclusion

This zip contains a workable single-page engineering markup prototype. It already supports image upload, marker placement, marker editing, marker deletion, and JSON/CSV export. It is not yet a company-grade engineering records platform, and the Gemini key handling should be treated as demo-only until the secret flow is redesigned.
