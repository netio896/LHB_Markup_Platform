import React, {useEffect, useRef, useState} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Database,
  Download,
  Eye,
  FileJson,
  FileText,
  FolderOpen,
  Layers3,
  LockKeyhole,
  PencilLine,
  Plus,
  RefreshCw,
  Save,
  Shield,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  AuditEvent,
  DrawingVersion,
  Floor,
  Marker,
  Project,
  Role,
  SCHEMA_VERSION,
} from './lib/prototype-contract';
import {apiBlob, apiJson, downloadBlob, downloadCsv} from './lib/prototype-api';

type ProjectBundle = {
  project: Project;
  floors: Floor[];
  drawingVersions: DrawingVersion[];
  markers: Marker[];
};

type ProjectForm = {
  name: string;
  code: string;
  client: string;
  location: string;
  status: string;
};

type FloorForm = {
  level: string;
  name: string;
  sortOrder: string;
};

type DrawingForm = {
  version: string;
  widthMm: string;
  heightMm: string;
};

type MarkerEditor = {
  id: string;
  label: string;
  type: string;
  discipline: string;
  status: string;
  note: string;
  mounting_height: string;
  circuit_or_pipe_note: string;
  x_percent: string;
  y_percent: string;
};

type Health = {
  ok: boolean;
  schemaVersion: string;
  counts: Record<string, number>;
};

const ROLE_STORAGE_KEY = 'lhb-markup-role';
const ACTOR_STORAGE_KEY = 'lhb-markup-actor';

const DISCIPLINES = [
  'Architectural',
  'Electrical',
  'Plumbing',
  'Fire Fighting',
  'ELV',
  'Solar PV',
  'Coordination',
];

const MARKER_TYPES = [
  {value: 'NOTE', label: 'Note', prefix: 'NT'},
  {value: 'ELECTRICAL', label: 'Electrical', prefix: 'EL'},
  {value: 'PLUMBING', label: 'Plumbing', prefix: 'PL'},
  {value: 'FIRE', label: 'Fire', prefix: 'FF'},
  {value: 'ELV', label: 'ELV', prefix: 'EV'},
  {value: 'SOLAR', label: 'Solar', prefix: 'PV'},
  {value: 'COORDINATION', label: 'Coordination', prefix: 'CO'},
];

const MARKER_STATUSES = ['DRAFT', 'TO REVIEW', 'CONFIRMED', 'REVISE REQUIRED', 'REJECTED'];

const EMPTY_PROJECT: ProjectForm = {
  name: '',
  code: '',
  client: '',
  location: '',
  status: 'active',
};

const EMPTY_FLOOR: FloorForm = {
  level: '',
  name: '',
  sortOrder: '0',
};

const EMPTY_DRAWING: DrawingForm = {
  version: 'A',
  widthMm: '0',
  heightMm: '0',
};

const EMPTY_MARKER: MarkerEditor = {
  id: '',
  label: '',
  type: 'NOTE',
  discipline: 'Coordination',
  status: 'DRAFT',
  note: '',
  mounting_height: '',
  circuit_or_pipe_note: '',
  x_percent: '0',
  y_percent: '0',
};

function defaultActor() {
  return localStorage.getItem(ACTOR_STORAGE_KEY) || 'alan';
}

function defaultRole(): Role {
  const stored = localStorage.getItem(ROLE_STORAGE_KEY);
  if (stored === 'editor' || stored === 'viewer') {
    return stored;
  }
  return 'editor';
}

async function loadJson<T>(path: string): Promise<T> {
  return apiJson<T>(path);
}

function markerPrefix(type: string) {
  const found = MARKER_TYPES.find((item) => item.value === type);
  return found?.prefix || 'MK';
}

function excelLabel(index: number) {
  let value = index;
  let label = '';
  while (value >= 0) {
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26) - 1;
  }
  return label;
}

function nextDrawingVersionLabel(existingVersions: string[], preferredVersion = 'A') {
  const taken = new Set(existingVersions.map((item) => item.trim().toUpperCase()).filter(Boolean));
  const preferred = preferredVersion.trim().toUpperCase() || 'A';
  if (!taken.has(preferred)) {
    return preferred;
  }

  for (let index = 0; index < 5000; index += 1) {
    const candidate = excelLabel(index);
    if (!taken.has(candidate)) {
      return candidate;
    }
  }

  return 'A';
}

function toNumberText(value: number | string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(0) : '0';
}

function Panel({
  title,
  icon: Icon,
  children,
  right,
}: {
  title: string;
  icon?: React.ComponentType<{size?: number; className?: string}>;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          {Icon ? <Icon size={16} className="text-slate-400" /> : null}
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">{title}</h2>
        </div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function Button({
  children,
  variant = 'default',
  disabled,
  onClick,
  type = 'button',
  className = '',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
  className?: string;
}) {
  const styles: Record<string, string> = {
    default: 'bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700',
    primary: 'bg-cyan-600 text-white hover:bg-cyan-500 border border-cyan-500/40',
    danger: 'bg-rose-600 text-white hover:bg-rose-500 border border-rose-500/40',
    ghost: 'bg-transparent text-slate-300 hover:bg-slate-800 border border-slate-700',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [bundle, setBundle] = useState<ProjectBundle | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);

  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedFloorId, setSelectedFloorId] = useState('');
  const [selectedDrawingVersionId, setSelectedDrawingVersionId] = useState('');
  const [selectedMarkerId, setSelectedMarkerId] = useState('');
  const [selectedType, setSelectedType] = useState(MARKER_TYPES[0].value);
  const [selectedDiscipline, setSelectedDiscipline] = useState('Coordination');

  const [role, setRole] = useState<Role>(defaultRole());
  const [actor, setActor] = useState(defaultActor());

  const [projectForm, setProjectForm] = useState<ProjectForm>(EMPTY_PROJECT);
  const [floorForm, setFloorForm] = useState<FloorForm>(EMPTY_FLOOR);
  const [drawingForm, setDrawingForm] = useState<DrawingForm>(EMPTY_DRAWING);
  const [markerEditor, setMarkerEditor] = useState<MarkerEditor>(EMPTY_MARKER);

  const [status, setStatus] = useState('Idle');
  const [error, setError] = useState('');
  const [importBusy, setImportBusy] = useState(false);

  const drawingFileInputRef = useRef<HTMLInputElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const canEdit = role === 'editor';
  const project = bundle?.project || null;
  const floors = bundle?.floors || [];
  const drawingVersions = bundle?.drawingVersions || [];
  const markers = bundle?.markers || [];
  const currentFloorVersions = selectedFloorId
    ? drawingVersions.filter((item) => item.floor_id === selectedFloorId)
    : drawingVersions;
  const currentMarkers = selectedDrawingVersionId
    ? markers.filter((item) => item.drawing_version_id === selectedDrawingVersionId)
    : [];
  const selectedDrawingVersion = drawingVersions.find((item) => item.id === selectedDrawingVersionId) || null;
  const selectedMarker = markers.find((item) => item.id === selectedMarkerId) || null;
  const markerEditorVisible = canEdit && !!selectedProjectId && !!selectedDrawingVersionId;

  useEffect(() => {
    localStorage.setItem(ROLE_STORAGE_KEY, role);
  }, [role]);

  useEffect(() => {
    localStorage.setItem(ACTOR_STORAGE_KEY, actor);
  }, [actor]);

  useEffect(() => {
    if (actor.trim().toLowerCase() === 'alan' && role !== 'editor') {
      setRole('editor');
    }
  }, [actor, role]);

  useEffect(() => {
    void refreshProjects();
    void refreshHealth();
    void refreshAuditEvents();
  }, []);

  useEffect(() => {
    if (!selectedProjectId && projects[0]) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (selectedProjectId) {
      void refreshBundle(selectedProjectId, {preserveFloor: false, preserveDrawing: false});
    } else {
      setBundle(null);
      setSelectedFloorId('');
      setSelectedDrawingVersionId('');
      setSelectedMarkerId('');
    }
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedFloorId) {
      setSelectedDrawingVersionId('');
      setSelectedMarkerId('');
      setDrawingForm(EMPTY_DRAWING);
      return;
    }
    const floorVersions = drawingVersions.filter((item) => item.floor_id === selectedFloorId);
    const nextVersion =
      floorVersions.find((item) => item.id === selectedDrawingVersionId) ||
      floorVersions[0] ||
      null;
    if (nextVersion && nextVersion.id !== selectedDrawingVersionId) {
      setSelectedDrawingVersionId(nextVersion.id);
    }
    if (!nextVersion) {
      setSelectedDrawingVersionId('');
      setSelectedMarkerId('');
      setDrawingForm((prev) => ({
        ...EMPTY_DRAWING,
        version: nextDrawingVersionLabel(floorVersions.map((item) => item.version), prev.version || 'A'),
      }));
    } else {
      setDrawingForm({
        version: nextDrawingVersionLabel(floorVersions.map((item) => item.version), nextVersion.version),
        widthMm: String(nextVersion.width_mm),
        heightMm: String(nextVersion.height_mm),
      });
    }
  }, [selectedFloorId, drawingVersions]);

  useEffect(() => {
    if (!currentMarkers.some((item) => item.id === selectedMarkerId)) {
      setSelectedMarkerId('');
      setMarkerEditor(EMPTY_MARKER);
    }
  }, [currentMarkers, selectedMarkerId]);

  useEffect(() => {
    if (project) {
      setProjectForm({
        name: project.name,
        code: project.code,
        client: project.client,
        location: project.location,
        status: project.status,
      });
    }
  }, [project?.id]);

  useEffect(() => {
    if (selectedMarker) {
      setMarkerEditor({
        id: selectedMarker.id,
        label: selectedMarker.label,
        type: selectedMarker.type,
        discipline: selectedMarker.discipline,
        status: selectedMarker.status,
        note: selectedMarker.note,
        mounting_height: selectedMarker.mounting_height,
        circuit_or_pipe_note: selectedMarker.circuit_or_pipe_note,
        x_percent: String(selectedMarker.x_percent),
        y_percent: String(selectedMarker.y_percent),
      });
    } else if (!selectedMarkerId) {
      setMarkerEditor(EMPTY_MARKER);
    }
  }, [selectedMarker?.id, selectedMarkerId]);

  async function refreshProjects() {
    try {
      const result = await loadJson<{projects: Project[]}>('/projects');
      setProjects(result.projects);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load projects');
    }
  }

  async function refreshHealth() {
    try {
      const result = await loadJson<Health>('/health');
      setHealth(result);
    } catch {
      // ignore; API may still be starting
    }
  }

  async function refreshAuditEvents() {
    try {
      const result = await loadJson<{auditEvents: AuditEvent[]}>('/audit-events?limit=25');
      setAuditEvents(result.auditEvents);
    } catch {
      setAuditEvents([]);
    }
  }

  async function refreshBundle(projectId: string, options?: {preserveFloor?: boolean; preserveDrawing?: boolean}) {
    try {
      const result = await loadJson<ProjectBundle>(`/projects/${projectId}`);
      setBundle(result);

      const nextFloor =
        (options?.preserveFloor && result.floors.find((item) => item.id === selectedFloorId)) ||
        result.floors[0] ||
        null;
      const floorVersions = nextFloor
        ? result.drawingVersions.filter((item) => item.floor_id === nextFloor.id)
        : result.drawingVersions;
      const nextDrawing =
        (options?.preserveDrawing &&
          result.drawingVersions.find((item) => item.id === selectedDrawingVersionId)) ||
        (nextFloor ? floorVersions[0] || null : result.drawingVersions[0] || null) ||
        null;

      setSelectedFloorId(nextFloor?.id || '');
      setSelectedDrawingVersionId(nextDrawing?.id || '');
      setSelectedMarkerId('');

      setFloorForm(
        nextFloor
          ? {
              level: nextFloor.level,
              name: nextFloor.name,
              sortOrder: String(nextFloor.sort_order),
            }
          : EMPTY_FLOOR,
      );

      setDrawingForm(
        nextDrawing
          ? {
              version: nextDrawingVersionLabel(
                floorVersions.map((item) => item.version),
                nextDrawing.version,
              ),
              widthMm: String(nextDrawing.width_mm),
              heightMm: String(nextDrawing.height_mm),
            }
          : {
              ...EMPTY_DRAWING,
              version: nextDrawingVersionLabel(floorVersions.map((item) => item.version), EMPTY_DRAWING.version),
            },
      );

      setStatus(`Loaded ${result.project.code}`);
      setError('');
      await refreshAuditEvents();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load project bundle');
    }
  }

  async function createProject() {
    if (!canEdit) return;
    try {
      setStatus('Creating project...');
      const result = await apiJson<{project: Project}>('/projects', {
        method: 'POST',
        body: JSON.stringify(projectForm),
      });
      await refreshProjects();
      setSelectedProjectId(result.project.id);
      setStatus(`Project created: ${result.project.code}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to create project');
    }
  }

  async function createFloor() {
    if (!canEdit || !selectedProjectId) return;
    try {
      setStatus('Creating floor...');
      const result = await apiJson<{floor: Floor}>('/floors', {
        method: 'POST',
        body: JSON.stringify({
          projectId: selectedProjectId,
          level: floorForm.level,
          name: floorForm.name,
          sortOrder: Number(floorForm.sortOrder || 0),
        }),
      });
      await refreshBundle(selectedProjectId, {preserveFloor: false, preserveDrawing: false});
      setSelectedFloorId(result.floor.id);
      setStatus(`Floor saved: ${result.floor.level}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to create floor');
    }
  }

  async function uploadDrawing(file: File) {
    if (!canEdit || !selectedProjectId || !selectedFloorId) return;
    try {
      setStatus('Uploading drawing...');
      const uploadResponse = await fetch(`/api/uploads/${encodeURIComponent(file.name)}`, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-LHB-Role': role,
          'X-LHB-Actor': actor,
        },
      });
      const uploadResult = await uploadResponse.json();
      if (!uploadResponse.ok) {
        throw new Error(uploadResult?.error || 'Upload failed');
      }

      const result = await apiJson<{drawingVersion: DrawingVersion}>('/drawing-versions', {
        method: 'POST',
        body: JSON.stringify({
          projectId: selectedProjectId,
          floorId: selectedFloorId,
          version: drawingForm.version,
          sourceFileName: file.name,
          sourceFileType: file.type,
          sourceFileSize: file.size,
          sourceFileRef: uploadResult.fileRef,
          widthMm: Number(drawingForm.widthMm || 0),
          heightMm: Number(drawingForm.heightMm || 0),
          createdBy: actor,
        }),
        headers: {
          'X-LHB-Role': role,
          'X-LHB-Actor': actor,
        },
      });
      await refreshBundle(selectedProjectId, {preserveFloor: true, preserveDrawing: false});
      setSelectedDrawingVersionId(result.drawingVersion.id);
      setStatus(`Drawing version saved: ${result.drawingVersion.version}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to upload drawing');
    }
  }

  async function saveMarker() {
    if (!canEdit || !selectedProjectId || !selectedFloorId || !selectedDrawingVersionId) return;
    try {
      setStatus('Saving marker...');
      const payload = {
        id: markerEditor.id || undefined,
        projectId: selectedProjectId,
        floorId: selectedFloorId,
        drawingVersionId: selectedDrawingVersionId,
        label: markerEditor.label || `${markerPrefix(markerEditor.type)}-${String(currentMarkers.length + 1).padStart(3, '0')}`,
        type: markerEditor.type,
        discipline: markerEditor.discipline,
        status: markerEditor.status,
        note: markerEditor.note,
        mountingHeight: markerEditor.mounting_height,
        circuitOrPipeNote: markerEditor.circuit_or_pipe_note,
        xPercent: Number(markerEditor.x_percent || 0),
        yPercent: Number(markerEditor.y_percent || 0),
        createdBy: actor,
        updatedBy: actor,
      };

      const result = await apiJson<{marker: Marker}>('/markers', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'X-LHB-Role': role,
          'X-LHB-Actor': actor,
        },
      });
      setSelectedMarkerId(result.marker.id);
      setMarkerEditor({
        id: result.marker.id,
        label: result.marker.label,
        type: result.marker.type,
        discipline: result.marker.discipline,
        status: result.marker.status,
        note: result.marker.note,
        mounting_height: result.marker.mounting_height,
        circuit_or_pipe_note: result.marker.circuit_or_pipe_note,
        x_percent: String(result.marker.x_percent),
        y_percent: String(result.marker.y_percent),
      });
      await refreshBundle(selectedProjectId, {preserveFloor: true, preserveDrawing: true});
      setStatus('Marker saved');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to save marker');
    }
  }

  async function deleteMarker(markerId: string) {
    if (!canEdit) return;
    if (!confirm('Delete this marker?')) return;
    try {
      setStatus('Deleting marker...');
      await apiJson(`/markers/${markerId}`, {
        method: 'DELETE',
        headers: {
          'X-LHB-Role': role,
          'X-LHB-Actor': actor,
        },
      });
      setSelectedMarkerId('');
      setMarkerEditor(EMPTY_MARKER);
      await refreshBundle(selectedProjectId, {preserveFloor: true, preserveDrawing: true});
      setStatus('Marker deleted');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to delete marker');
    }
  }

  async function deleteDrawingVersion(drawingVersionId: string) {
    if (!canEdit) return;
    if (!confirm('Delete this drawing version? This will also remove linked markers and the uploaded file.')) return;
    try {
      setStatus('Deleting drawing version...');
      await apiJson(`/drawing-versions/${drawingVersionId}`, {
        method: 'DELETE',
        headers: {
          'X-LHB-Role': role,
          'X-LHB-Actor': actor,
        },
      });
      setSelectedDrawingVersionId('');
      setSelectedMarkerId('');
      await refreshBundle(selectedProjectId, {preserveFloor: true, preserveDrawing: false});
      setStatus('Drawing version deleted');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to delete drawing version');
    }
  }

  async function importSnapshot(file: File) {
    if (!canEdit) return;
    try {
      setImportBusy(true);
      const text = await file.text();
      const result = await apiJson('/import', {
        method: 'POST',
        body: text,
        headers: {
          'Content-Type': 'application/json',
          'X-LHB-Role': role,
          'X-LHB-Actor': actor,
        },
      });
      setStatus(`Imported ${result.imported?.projects || 0} projects`);
      await refreshProjects();
      if (selectedProjectId) {
        await refreshBundle(selectedProjectId, {preserveFloor: true, preserveDrawing: true});
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Import failed');
    } finally {
      setImportBusy(false);
    }
  }

  async function exportJson() {
    try {
      const blob = await apiBlob('/export.json', {
        headers: {
          'X-LHB-Role': role,
          'X-LHB-Actor': actor,
        },
      });
      downloadBlob(`lhb-markup-${SCHEMA_VERSION}.json`, blob);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Export failed');
    }
  }

  async function exportPdf() {
    try {
      const blob = await apiBlob('/export.pdf', {
        headers: {
          'X-LHB-Role': role,
          'X-LHB-Actor': actor,
        },
      });
      downloadBlob(`lhb-markup-${SCHEMA_VERSION}.pdf`, blob);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Export failed');
    }
  }

  function exportCsv() {
    const rows = markers.map((marker) => [
      project?.name || '',
      project?.code || '',
      floors.find((item) => item.id === marker.floor_id)?.level || '',
      drawingVersions.find((item) => item.id === marker.drawing_version_id)?.version || '',
      marker.discipline,
      marker.type,
      marker.label,
      marker.status,
      marker.x_percent.toFixed(2),
      marker.y_percent.toFixed(2),
      marker.mounting_height,
      marker.note,
      marker.circuit_or_pipe_note,
      marker.created_at,
      marker.updated_at,
    ]);

    downloadCsv(
      `lhb-markup-${project?.code || 'export'}.csv`,
      [
        'Project Name',
        'Project Code',
        'Floor',
        'Drawing Version',
        'Discipline',
        'Marker Type',
        'Label',
        'Status',
        'X %',
        'Y %',
        'Mounting Height',
        'Note',
        'Circuit / Pipe Note',
        'Created',
        'Updated',
      ],
      rows,
    );
  }

  function handleCanvasClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!canEdit || !selectedProjectId || !selectedFloorId || !selectedDrawingVersionId) return;
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const xPercent = ((event.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((event.clientY - rect.top) / rect.height) * 100;

    setMarkerEditor({
      ...EMPTY_MARKER,
      label: `${markerPrefix(selectedType)}-${String(currentMarkers.length + 1).padStart(3, '0')}`,
      type: selectedType,
      discipline: selectedDiscipline,
      x_percent: xPercent.toFixed(2),
      y_percent: yPercent.toFixed(2),
    });
    setSelectedMarkerId('');
  }

  const previewUrl = selectedDrawingVersion ? `/api/drawing-versions/${selectedDrawingVersion.id}/file` : '';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/95 px-6 py-4 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
              <Layers3 size={18} />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">LHB Markup Platform v1</h1>
              <p className="text-xs text-slate-400">
                {SCHEMA_VERSION} · local prototype · backend-controlled secret boundary
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
              <Shield size={14} className="text-slate-400" />
              <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Role</span>
              <button
                className={`rounded-lg px-2 py-1 text-xs ${role === 'viewer' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
                onClick={() => setRole('viewer')}
              >
                viewer
              </button>
              <button
                className={`rounded-lg px-2 py-1 text-xs ${role === 'editor' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}
                onClick={() => setRole('editor')}
              >
                editor
              </button>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
              <LockKeyhole size={14} className="text-slate-400" />
              <input
                value={actor}
                onChange={(e) => setActor(e.target.value)}
                className="w-28 bg-transparent text-xs text-slate-200 outline-none"
                placeholder="actor"
              />
            </div>

            <Button variant="ghost" onClick={() => void refreshProjects()}>
              <RefreshCw size={14} />
              Refresh
            </Button>
            <Button variant="ghost" onClick={() => void refreshHealth()}>
              <Database size={14} />
              Health
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1">
            Projects: {health?.counts?.projects ?? projects.length}
          </span>
          <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1">
            Floors: {health?.counts?.floors ?? floors.length}
          </span>
          <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1">
            Drawing versions: {health?.counts?.drawingVersions ?? drawingVersions.length}
          </span>
          <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1">
            Markers: {health?.counts?.markers ?? markers.length}
          </span>
          <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1">
            Audit events: {health?.counts?.auditEvents ?? auditEvents.length}
          </span>
          <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1">
            API: {health?.schemaVersion || SCHEMA_VERSION}
          </span>
        </div>
      </header>

      {error ? (
        <div className="border-b border-amber-600/40 bg-amber-500/10 px-6 py-3 text-amber-200">
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle size={14} />
            <span>{error}</span>
          </div>
        </div>
      ) : null}

      <main className="grid gap-4 p-4 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Panel title="Projects" icon={FolderOpen}>
            <div className="space-y-3">
              <Field label="Select project">
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none"
                >
                  <option value="">No project selected</option>
                  {projects.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} - {item.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Project name">
                <input
                  value={projectForm.name}
                  onChange={(e) => setProjectForm((prev) => ({...prev, name: e.target.value}))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Code">
                  <input
                    value={projectForm.code}
                    onChange={(e) => setProjectForm((prev) => ({...prev, code: e.target.value.toUpperCase()}))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none"
                  />
                </Field>
                <Field label="Status">
                  <input
                    value={projectForm.status}
                    onChange={(e) => setProjectForm((prev) => ({...prev, status: e.target.value}))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none"
                  />
                </Field>
              </div>

              <Field label="Client">
                <input
                  value={projectForm.client}
                  onChange={(e) => setProjectForm((prev) => ({...prev, client: e.target.value}))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none"
                />
              </Field>

              <Field label="Location">
                <input
                  value={projectForm.location}
                  onChange={(e) => setProjectForm((prev) => ({...prev, location: e.target.value}))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none"
                />
              </Field>

              <Button variant="primary" disabled={!canEdit || !projectForm.name || !projectForm.code} onClick={() => void createProject()}>
                <Plus size={14} />
                Create / Save Project
              </Button>
            </div>
          </Panel>

          <Panel title="Floor + Drawing" icon={Layers3}>
            <div className="space-y-3">
              <Field label="Select floor">
                <select
                  value={selectedFloorId}
                  onChange={(e) => setSelectedFloorId(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none"
                >
                  <option value="">No floor selected</option>
                  {floors.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.level} - {item.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Floor level">
                <input
                  value={floorForm.level}
                  onChange={(e) => setFloorForm((prev) => ({...prev, level: e.target.value}))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none"
                />
              </Field>

              <Field label="Floor name">
                <input
                  value={floorForm.name}
                  onChange={(e) => setFloorForm((prev) => ({...prev, name: e.target.value}))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none"
                />
              </Field>

              <Field label="Sort order">
                <input
                  type="number"
                  value={floorForm.sortOrder}
                  onChange={(e) => setFloorForm((prev) => ({...prev, sortOrder: e.target.value}))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none"
                />
              </Field>

              <Button variant="primary" disabled={!canEdit || !selectedProjectId || !floorForm.level} onClick={() => void createFloor()}>
                <Plus size={14} />
                Create / Save Floor
              </Button>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Version">
                  <input
                    value={drawingForm.version}
                    onChange={(e) => setDrawingForm((prev) => ({...prev, version: e.target.value}))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none"
                  />
                </Field>
                <Field label="Width mm">
                  <input
                    type="number"
                    value={drawingForm.widthMm}
                    onChange={(e) => setDrawingForm((prev) => ({...prev, widthMm: e.target.value}))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none"
                  />
                </Field>
              </div>

              <Field label="Height mm">
                <input
                  type="number"
                  value={drawingForm.heightMm}
                  onChange={(e) => setDrawingForm((prev) => ({...prev, heightMm: e.target.value}))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none"
                />
              </Field>

              <Button
                variant="default"
                disabled={!canEdit || !selectedProjectId || !selectedFloorId}
                onClick={() => drawingFileInputRef.current?.click()}
              >
                <Upload size={14} />
                Upload Drawing
              </Button>
              <input
                ref={drawingFileInputRef}
                type="file"
                accept="image/*,.pdf"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void uploadDrawing(file);
                    e.currentTarget.value = '';
                  }
                }}
              />
            </div>
          </Panel>

          <Panel title="Import / Export" icon={FileJson}>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="default" onClick={() => void exportJson()}>
                <Download size={14} />
                JSON
              </Button>
              <Button variant="default" onClick={() => void exportPdf()}>
                <FileText size={14} />
                PDF
              </Button>
              <Button variant="default" onClick={exportCsv}>
                <FileJson size={14} />
                CSV
              </Button>
              <Button variant="ghost" disabled={!canEdit || importBusy} onClick={() => importFileInputRef.current?.click()}>
                <Upload size={14} />
                Import
              </Button>
            </div>
            <input
              ref={importFileInputRef}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void importSnapshot(file);
                  e.currentTarget.value = '';
                }
              }}
            />
          </Panel>

          <Panel title="System" icon={Database}>
            <div className="space-y-2 text-sm text-slate-300">
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
                <span className="text-slate-500">Schema</span>
                <span className="font-mono text-xs">{SCHEMA_VERSION}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
                <span className="text-slate-500">Role</span>
                <span className="font-mono text-xs">{role}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
                <span className="text-slate-500">Actor</span>
                <span className="truncate font-mono text-xs">{actor}</span>
              </div>
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel
            title="Drawing Workspace"
            icon={Eye}
            right={
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="rounded-full border border-slate-800 px-2 py-1">Project</span>
                <span className="rounded-full border border-slate-800 px-2 py-1">Floor</span>
                <span className="rounded-full border border-slate-800 px-2 py-1">Version</span>
              </div>
            }
          >
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none"
                  disabled={!canEdit}
                >
                  {MARKER_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedDiscipline}
                  onChange={(e) => setSelectedDiscipline(e.target.value)}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none"
                  disabled={!canEdit}
                >
                  {DISCIPLINES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <div className="text-xs text-slate-500">
                  Click the drawing to place a new marker at the clicked coordinates.
                </div>
              </div>

              <div
                ref={canvasRef}
                onClick={handleCanvasClick}
                className={`relative min-h-[720px] overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 ${
                  canEdit && selectedDrawingVersionId ? 'cursor-crosshair' : 'cursor-default'
                }`}
              >
                {previewUrl ? (
                  (selectedDrawingVersion?.source_file_type || '').toLowerCase().includes('pdf') ? (
                    <iframe
                      src={previewUrl}
                      title="drawing preview"
                      className="h-[720px] w-full border-0 pointer-events-none"
                    />
                  ) : (
                    <img src={previewUrl} alt="drawing" className="h-full w-full object-contain pointer-events-none" />
                  )
                ) : (
                  <div className="flex min-h-[720px] flex-col items-center justify-center gap-4 text-center text-slate-500">
                    <FolderOpen size={40} className="text-slate-700" />
                    <div>
                      <p className="text-sm font-medium text-slate-300">No drawing version selected</p>
                      <p className="mt-1 text-xs text-slate-500">Create a floor and upload a drawing to start marking.</p>
                    </div>
                  </div>
                )}

                {currentMarkers.map((marker) => {
                  const isSelected = marker.id === selectedMarkerId;
                  return (
                    <button
                      key={marker.id}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedMarkerId(marker.id);
                      }}
                      className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 px-2 py-1 text-[10px] font-semibold shadow-xl ${
                        isSelected
                          ? 'border-cyan-300 bg-cyan-600 text-white'
                          : 'border-slate-200 bg-rose-600 text-white'
                      }`}
                      style={{
                        left: `${marker.x_percent}%`,
                        top: `${marker.y_percent}%`,
                      }}
                      title={marker.label}
                    >
                      {marker.label}
                    </button>
                  );
                })}
                {markerEditorVisible && markerEditor.x_percent && markerEditor.y_percent ? (
                  <div
                    className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-dashed border-cyan-300 bg-cyan-500/25 px-2 py-1 text-[10px] font-semibold text-cyan-100 shadow-xl"
                    style={{
                      left: `${markerEditor.x_percent}%`,
                      top: `${markerEditor.y_percent}%`,
                    }}
                  >
                    {markerEditor.label || 'DRAFT'}
                  </div>
                ) : null}
              </div>
            </div>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title={selectedMarker ? 'Selected Marker' : 'Marker Draft'} icon={PencilLine}>
              {selectedMarker || markerEditorVisible ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-400">
                    <span>{selectedMarker ? selectedMarker.label : markerEditor.label || 'New marker'}</span>
                    <span>{selectedMarker ? selectedMarker.status : markerEditor.status}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Label">
                      <input
                        value={markerEditor.label}
                        onChange={(e) => setMarkerEditor((prev) => ({...prev, label: e.target.value}))}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none"
                        disabled={!canEdit}
                      />
                    </Field>
                    <Field label="Type">
                      <select
                        value={markerEditor.type}
                        onChange={(e) => setMarkerEditor((prev) => ({...prev, type: e.target.value}))}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none"
                        disabled={!canEdit}
                      >
                        {MARKER_TYPES.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Discipline">
                      <select
                        value={markerEditor.discipline}
                        onChange={(e) => setMarkerEditor((prev) => ({...prev, discipline: e.target.value}))}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none"
                        disabled={!canEdit}
                      >
                        {DISCIPLINES.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Status">
                      <select
                        value={markerEditor.status}
                        onChange={(e) => setMarkerEditor((prev) => ({...prev, status: e.target.value}))}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none"
                        disabled={!canEdit}
                      >
                        {MARKER_STATUSES.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="X %">
                      <input
                        type="number"
                        value={markerEditor.x_percent}
                        onChange={(e) => setMarkerEditor((prev) => ({...prev, x_percent: e.target.value}))}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none"
                        disabled={!canEdit}
                      />
                    </Field>
                    <Field label="Y %">
                      <input
                        type="number"
                        value={markerEditor.y_percent}
                        onChange={(e) => setMarkerEditor((prev) => ({...prev, y_percent: e.target.value}))}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none"
                        disabled={!canEdit}
                      />
                    </Field>
                  </div>
                  <Field label="Mounting height">
                    <input
                      value={markerEditor.mounting_height}
                      onChange={(e) => setMarkerEditor((prev) => ({...prev, mounting_height: e.target.value}))}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none"
                      disabled={!canEdit}
                    />
                  </Field>
                  <Field label="Note">
                    <textarea
                      value={markerEditor.note}
                      onChange={(e) => setMarkerEditor((prev) => ({...prev, note: e.target.value}))}
                      className="min-h-24 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none"
                      disabled={!canEdit}
                    />
                  </Field>
                  <Field label="Circuit / pipe note">
                    <input
                      value={markerEditor.circuit_or_pipe_note}
                      onChange={(e) =>
                        setMarkerEditor((prev) => ({...prev, circuit_or_pipe_note: e.target.value}))
                      }
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none"
                      disabled={!canEdit}
                    />
                  </Field>
                  <div className="flex gap-2">
                    <Button variant="primary" disabled={!canEdit || !selectedProjectId || !selectedDrawingVersionId} onClick={() => void saveMarker()}>
                      <Save size={14} />
                      {selectedMarker ? 'Save Marker' : 'Create Marker'}
                    </Button>
                    <Button variant="danger" disabled={!canEdit || !selectedMarkerId} onClick={() => void deleteMarker(selectedMarkerId)}>
                      <Trash2 size={14} />
                      Delete
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950 p-6 text-sm text-slate-500">
                  Select a marker from the canvas or marker list, or click the canvas in editor mode to create a draft.
                </div>
              )}
            </Panel>

            <Panel title="Audit Trail" icon={CheckCircle2}>
              <div className="space-y-2">
                {auditEvents.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950 p-6 text-sm text-slate-500">
                    No audit events yet.
                  </div>
                ) : (
                  auditEvents.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{event.entity_type}</span>
                        <span className="text-slate-500">{event.action}</span>
                      </div>
                      <div className="mt-1 text-slate-500">
                        {event.entity_id} · {event.actor} · {event.created_at}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Panel>
          </div>

          <Panel title="Markers in Current Drawing" icon={Layers3}>
            {currentMarkers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950 p-6 text-sm text-slate-500">
                No markers on the selected drawing version.
              </div>
            ) : (
              <div className="space-y-2">
                {currentMarkers.map((marker) => (
                  <button
                    key={marker.id}
                    type="button"
                    onClick={() => setSelectedMarkerId(marker.id)}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition ${
                      selectedMarkerId === marker.id
                        ? 'border-cyan-500/40 bg-cyan-500/10'
                        : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-100">{marker.label}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {marker.type} · {marker.discipline} · {marker.status}
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      <div>
                        {toNumberText(marker.x_percent)}%, {toNumberText(marker.y_percent)}%
                      </div>
                      <div className="mt-1">{marker.created_at}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Project Bundle" icon={Layers3}>
            {project ? (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
                    <div className="text-xs text-slate-500">Project</div>
                    <div className="mt-1 font-medium">{project.code}</div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
                    <div className="text-xs text-slate-500">Status</div>
                    <div className="mt-1 font-medium">{project.status}</div>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
                  <div className="text-xs text-slate-500">Name</div>
                  <div className="mt-1 font-medium">{project.name}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
                  <div className="text-xs text-slate-500">Location</div>
                  <div className="mt-1 font-medium">{project.location || '-'}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
                  <div className="text-xs text-slate-500">Floors / Versions / Markers</div>
                  <div className="mt-1 font-medium">
                    {floors.length} / {drawingVersions.length} / {markers.length}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950 p-6 text-sm text-slate-500">
                No project loaded yet.
              </div>
            )}
          </Panel>

          <Panel title="Drawing Versions" icon={FolderOpen}>
            {currentFloorVersions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950 p-6 text-sm text-slate-500">
                No drawing versions for the selected floor.
              </div>
            ) : (
              <div className="space-y-2">
                {currentFloorVersions.map((item) => (
                  <div
                    key={item.id}
                    className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                      selectedDrawingVersionId === item.id
                        ? 'border-cyan-500/40 bg-cyan-500/10'
                        : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedDrawingVersionId(item.id)}
                      className="w-full text-left"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-slate-100">{item.version}</div>
                        <span className="text-xs text-slate-500">{item.created_at}</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {item.source_file_name} · {item.width_mm} x {item.height_mm} mm
                      </div>
                    </button>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                        {currentMarkers.filter((marker) => marker.drawing_version_id === item.id).length} markers
                      </span>
                      <Button
                        variant="danger"
                        disabled={!canEdit}
                        onClick={() => void deleteDrawingVersion(item.id)}
                        className="px-2 py-1 text-xs"
                      >
                        <Trash2 size={12} />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Minimum v1 Notes" icon={AlertTriangle}>
            <div className="space-y-2 text-sm text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-400" />
                SQLite metadata, markers, and audit trail
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-400" />
                Local uploads folder for drawing files
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-400" />
                viewer / editor role split
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-400" />
                JSON, CSV, and PDF export
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-400" />
                schemaVersion: {SCHEMA_VERSION}
              </div>
            </div>
          </Panel>
        </div>
      </main>

      <footer className="border-t border-slate-800 px-6 py-4 text-xs text-slate-500">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1">
              Local internal prototype only
            </span>
            <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1">
              Backend-controlled secrets only
            </span>
            <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1">
              Not a company record system yet
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">{status}</span>
            <ChevronRight size={14} className="text-slate-600" />
          </div>
        </div>
      </footer>
    </div>
  );
}
