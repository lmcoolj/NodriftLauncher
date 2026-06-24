import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Play,
  Square,
  Pencil,
  FolderOpen,
  Loader2,
  Trash2,
  Package,
  Folder,
  FileText,
  ChevronRight,
  Boxes,
  RefreshCw,
} from "lucide-react";
import { openPath } from "@tauri-apps/plugin-opener";
import { Button } from "../components/Button";
import { InstanceModal } from "../components/InstanceModal";
import {
  toggleMod,
  deleteModFile,
  listMods,
  listInstanceFiles,
  instancePath,
  type FileEntry,
  type ModInfo,
} from "../lib/api";
import { useInstances } from "../store/instances";
import { useLaunch } from "../store/launch";
import { useAccounts } from "../store/accounts";
import { useSettings } from "../store/settings";
import { useUI } from "../store/ui";

function fmtSize(n: number): string {
  if (n >= 1 << 20) return `${(n / (1 << 20)).toFixed(1)} MB`;
  if (n >= 1 << 10) return `${(n / (1 << 10)).toFixed(0)} KB`;
  return `${n} B`;
}

export function InstanceDetailPage({ id }: { id: string }) {
  const { instances, apply } = useInstances();
  const instance = useMemo(() => instances.find((i) => i.id === id), [instances, id]);
  const closeInstance = useUI((s) => s.closeInstance);
  const setView = useUI((s) => s.setView);
  const select = useInstances((s) => s.select);
  const active = useAccounts((s) => s.active);
  const { defaultRamMb, defaultJavaArgs, resolution } = useSettings();
  const { status, activeId, launch, kill } = useLaunch();

  const [editing, setEditing] = useState(false);
  const [busyMod, setBusyMod] = useState<string | null>(null);

  // Installed mods (rich metadata read from the jars)
  const [mods, setMods] = useState<ModInfo[]>([]);
  const loadMods = () => listMods(id).then(setMods).catch(() => setMods([]));
  useEffect(() => {
    if (instance) loadMods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, instance?.mods.length]);

  // File browser
  const [rel, setRel] = useState("");
  const [files, setFiles] = useState<FileEntry[]>([]);

  useEffect(() => {
    if (!instance) return;
    listInstanceFiles(id, rel)
      .then(setFiles)
      .catch(() => setFiles([]));
  }, [id, rel, instance]);

  if (!instance) {
    return (
      <div className="text-sm text-muted">
        Instance not found.{" "}
        <button className="underline" onClick={closeInstance}>
          Go back
        </button>
      </div>
    );
  }

  const busy = status === "Installing" || status === "Launching" || status === "Running";
  const launchBusy = busy && activeId === id;

  const play = () => {
    if (!active) {
      setView("accounts");
      return;
    }
    launch({
      instanceId: id,
      defaultRamMb,
      defaultJavaArgs,
      width: resolution.width,
      height: resolution.height,
    });
  };

  const crumbs = rel.split("/").filter(Boolean);

  return (
    <div className="mx-auto max-w-3xl">
      <button
        onClick={closeInstance}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-text"
      >
        <ArrowLeft size={16} />
        Instances
      </button>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-surface text-3xl ring-1 ring-border">
          {instance.icon ?? "🟪"}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-semibold">{instance.name}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <span className="rounded-full bg-surface-2 px-2 py-0.5">{instance.mc_version}</span>
            {instance.loader && (
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-accent-soft">
                {instance.loader.kind} {instance.loader.version}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Package size={11} />
              {instance.mods.length} mods
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {status === "Running" && activeId === id ? (
          <button
            onClick={() => kill(id)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-500/90 px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:bg-red-500"
          >
            <Square size={15} fill="currentColor" />
            Stop
          </button>
        ) : (
          <Button onClick={play} disabled={launchBusy}>
            {launchBusy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {launchBusy ? status : "Play"}
          </Button>
        )}
        <Button variant="ghost" onClick={() => setEditing(true)}>
          <Pencil size={15} />
          Edit
        </Button>
        {instance.loader && (
          <Button
            variant="ghost"
            onClick={() => {
              select(id);
              setView("browse");
            }}
          >
            <Boxes size={15} />
            Add mods
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={() => instancePath(id).then(openPath).catch(() => {})}
        >
          <FolderOpen size={15} />
          Open folder
        </Button>
      </div>

      {/* Info */}
      <div className="mt-5 grid grid-cols-2 gap-3 rounded-card bg-surface p-4 text-sm ring-1 ring-border sm:grid-cols-3">
        <Info label="Minecraft" value={instance.mc_version} />
        <Info
          label="Loader"
          value={instance.loader ? `${instance.loader.kind} ${instance.loader.version}` : "Vanilla"}
        />
        <Info
          label="RAM"
          value={
            instance.ram_mb
              ? `${(instance.ram_mb / 1024).toFixed(1)} GB`
              : `${(defaultRamMb / 1024).toFixed(1)} GB (default)`
          }
        />
        <Info
          label="Java args"
          value={instance.java_args ? "Custom" : "Default"}
        />
        <Info
          label="Last played"
          value={
            instance.last_played
              ? new Date(instance.last_played * 1000).toLocaleDateString()
              : "Never"
          }
        />
      </div>

      {/* Installed mods */}
      <div className="mb-2 mt-6 flex items-center justify-between">
        <h3 className="font-semibold">
          Mods <span className="text-sm font-normal text-muted">({mods.length})</span>
        </h3>
        <button
          onClick={loadMods}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-text"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>
      {mods.length === 0 ? (
        <p className="rounded-card border border-dashed border-border p-6 text-center text-sm text-muted">
          No mods yet.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-card ring-1 ring-border">
          {mods.map((m, i) => {
            const toggle = async () => {
              setBusyMod(m.file_name);
              try {
                apply(await toggleMod(id, m.file_name, !m.enabled));
                await loadMods();
              } finally {
                setBusyMod(null);
              }
            };
            const remove = async () => {
              apply(await deleteModFile(id, m.file_name));
              await loadMods();
            };
            return (
              <li
                key={m.file_name}
                className={`flex items-center gap-3 px-3 py-2.5 ${
                  i % 2 ? "bg-surface-2/40" : "bg-surface"
                } ${m.enabled ? "" : "opacity-60"}`}
              >
                {m.icon ? (
                  <img
                    src={m.icon}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-lg bg-surface-2 object-cover ring-1 ring-border"
                  />
                ) : (
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted ring-1 ring-border">
                    <Package size={18} />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate font-medium">{m.name}</span>
                    {m.version && (
                      <span className="shrink-0 text-xs text-muted">{m.version}</span>
                    )}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {m.authors ? `by ${m.authors}` : m.file_name}
                  </div>
                </div>

                {/* toggle switch */}
                <button
                  title={m.enabled ? "Disable" : "Enable"}
                  onClick={toggle}
                  disabled={busyMod === m.file_name}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                    m.enabled ? "bg-green-500" : "bg-surface-hover"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      m.enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>

                <button
                  title="Delete"
                  onClick={remove}
                  className="shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-red-500/10 hover:text-red-300"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* File browser */}
      <h3 className="mb-2 mt-6 font-semibold">Files</h3>
      <div className="rounded-card bg-surface ring-1 ring-border">
        <div className="flex items-center gap-1 border-b border-border px-3 py-2 text-xs text-muted">
          <button className="hover:text-text" onClick={() => setRel("")}>
            {instance.name}
          </button>
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight size={12} />
              <button
                className="hover:text-text"
                onClick={() => setRel(crumbs.slice(0, i + 1).join("/"))}
              >
                {c}
              </button>
            </span>
          ))}
        </div>
        <ul className="max-h-72 overflow-y-auto p-1">
          {files.length === 0 && (
            <li className="px-3 py-4 text-center text-sm text-muted">Empty folder</li>
          )}
          {files.map((f) => (
            <li key={f.name}>
              <button
                disabled={!f.is_dir}
                onClick={() => f.is_dir && setRel(rel ? `${rel}/${f.name}` : f.name)}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm ${
                  f.is_dir ? "hover:bg-surface-hover" : "cursor-default"
                }`}
              >
                {f.is_dir ? (
                  <Folder size={15} className="text-accent-soft" />
                ) : (
                  <FileText size={15} className="text-muted" />
                )}
                <span className="min-w-0 flex-1 truncate text-left">{f.name}</span>
                {!f.is_dir && <span className="text-xs text-muted">{fmtSize(f.size)}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <InstanceModal open={editing} editing={instance} onClose={() => setEditing(false)} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 truncate font-medium">{value}</div>
    </div>
  );
}
