# Hermes / OpenClaw Tool Gateway

This repo exposes a local HTTP tool layer for Hermes and OpenClaw.

## Base URL

- `http://127.0.0.1:8787`

## Tool manifest

- `GET /api/tools`
- `GET /api/tools/{toolName}`

## Read tools

- `GET /api/health`
- `GET /api/projects`
- `GET /api/projects/{projectId}`
- `GET /api/floors?projectId=...`
- `GET /api/drawing-versions?projectId=...&floorId=...`
- `GET /api/markers?projectId=...&floorId=...&drawingVersionId=...`
- `GET /api/audit-events?limit=...`

## Write tools

Use headers:

- `X-LHB-Role: editor`
- `X-LHB-Actor: <agent-name>`

Examples:

```bash
curl -sS -X POST http://127.0.0.1:8787/api/tools/create_project \
  -H 'Content-Type: application/json' \
  -H 'X-LHB-Role: editor' \
  -H 'X-LHB-Actor: hermes' \
  --data '{"name":"Sample Project","code":"SAMPLE"}'
```

```bash
curl -sS -X POST http://127.0.0.1:8787/api/tools/create_drawing_version_from_upload \
  -H 'Content-Type: application/json' \
  -H 'X-LHB-Role: editor' \
  -H 'X-LHB-Actor: openclaw' \
  --data '{
    "projectId":"<project-id>",
    "floorId":"<floor-id>",
    "version":"A",
    "sourceFileName":"plan.pdf",
    "sourceFileType":"application/pdf",
    "contentBase64":"<base64-bytes>",
    "widthMm":12000,
    "heightMm":8000
  }'
```

```bash
curl -sS -X POST http://127.0.0.1:8787/api/tools/create_marker \
  -H 'Content-Type: application/json' \
  -H 'X-LHB-Role: editor' \
  -H 'X-LHB-Actor: hermes' \
  --data '{"projectId":"...","floorId":"...","drawingVersionId":"...","label":"EL-001","type":"ELECTRICAL","discipline":"Electrical","xPercent":25,"yPercent":35}'
```

## Role model

- `viewer`: read-only tools
- `editor`: create, update, delete, import, export

## Notes

- No browser-exposed API keys.
- Tool calls stay local and are controlled by HTTP headers.
- Hermes and OpenClaw can each point at the same local gateway.
