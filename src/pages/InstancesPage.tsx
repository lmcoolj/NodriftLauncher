import { useEffect, useMemo, useState } from "react";
import { Play, Terminal, Trash2, Loader2, Info } from "lucide-react";
import { Button } from "../components/Button";
import { listVersions, type LoaderSelection, type VersionInfo } from "../lib/api";
import { useAccounts } from "../store/accounts";
import { useLaunch } from "../store/launch";
import { useUI } from "../store/ui";

const LOADERS: { value: LoaderSelection["kind"] | "vanilla"; label: string }[] = [
  { value: "vanilla", label: "Vanilla (no loader)" },
  { value: "fabric", label: "Fabric" },
  { value: "quilt", label: "Quilt" },
  { value: "neoforge", label: "NeoForge" },
  { value: "forge", label: "Forge" },
];

export function InstancesPage() {
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [version, setVersion] = useState("");
  const [loader, setLoader] = useState<LoaderSelection["kind"] | "vanilla">("vanilla");
  const [loaderVersion, setLoaderVersion] = useState("");
  const [versionsError, setVersionsError] = useState<string | null>(null);

  const active = useAccounts((s) => s.active);
  const setView = useUI((s) => s.setView);
  const { status, log, progress, error, clearLog, launch } = useLaunch();

  useEffect(() => {
    listVersions()
      .then((v) => {
        setVersions(v);
        const firstRelease = v.find((x) => x.type === "release");
        if (firstRelease) setVersion(firstRelease.id);
      })
      .catch((e) => setVersionsError(String(e)));
  }, []);

  const shown = useMemo(
    () => versions.filter((v) => showSnapshots || v.type === "release"),
    [versions, showSnapshots]
  );

  const busy = status === "Installing" || status === "Launching" || status === "Running";
  const canLaunch =
    !!active && !!version && !busy && (loader === "vanilla" || !!loaderVersion.trim());

  const doLaunch = () =>
    launch({
      version,
      loader:
        loader === "vanilla"
          ? undefined
          : { kind: loader, version: loaderVersion.trim() },
    });

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-5">
      {/* Temporary step-2 notice */}
      <div className="flex items-start gap-2 rounded-card bg-accent/10 px-4 py-3 text-sm text-accent-soft ring-1 ring-accent/20">
        <Info size={16} className="mt-0.5 shrink-0" />
        <span>
          <strong>Quick Launch</strong> (Step 2) — verifies Microsoft login + the
          launch pipeline. Full instance management lands in Step 3.
        </span>
      </div>

      {/* Launch card */}
      <div className="rounded-card bg-surface p-5 ring-1 ring-border">
        {!active && (
          <div className="mb-4 flex items-center justify-between rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-300 ring-1 ring-amber-500/30">
            <span>No account signed in.</span>
            <Button variant="ghost" onClick={() => setView("accounts")}>
              Sign in
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted">Minecraft version</span>
            <select
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="rounded-lg bg-surface-2 px-3 py-2 ring-1 ring-border focus:outline-none focus:ring-accent"
            >
              {shown.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.id}
                  {v.type !== "release" ? ` (${v.type})` : ""}
                </option>
              ))}
            </select>
            <label className="mt-0.5 flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={showSnapshots}
                onChange={(e) => setShowSnapshots(e.target.checked)}
                className="accent-[var(--accent)]"
              />
              Show snapshots
            </label>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted">Mod loader</span>
            <select
              value={loader}
              onChange={(e) => setLoader(e.target.value as typeof loader)}
              className="rounded-lg bg-surface-2 px-3 py-2 ring-1 ring-border focus:outline-none focus:ring-accent"
            >
              {LOADERS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
            {loader !== "vanilla" && (
              <input
                value={loaderVersion}
                onChange={(e) => setLoaderVersion(e.target.value)}
                placeholder="Loader version (e.g. 0.16.9)"
                className="mt-0.5 rounded-lg bg-surface-2 px-3 py-2 text-sm ring-1 ring-border placeholder:text-muted focus:outline-none focus:ring-accent"
              />
            )}
          </label>
        </div>

        {versionsError && (
          <p className="mt-3 text-sm text-red-300">
            Couldn't load versions: {versionsError}
          </p>
        )}

        <div className="mt-5 flex items-center gap-3">
          <Button onClick={doLaunch} disabled={!canLaunch}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {busy ? status : "Launch"}
          </Button>
          <StatusPill status={status} />
          {progress && (
            <span className="text-xs text-muted">
              {progress.current}/{progress.total} files
            </span>
          )}
        </div>

        {progress && progress.total > 0 && (
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      </div>

      {/* Console */}
      <div className="flex min-h-0 flex-1 flex-col rounded-card bg-[#161618] ring-1 ring-border">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Terminal size={15} className="text-accent-soft" />
            Console
          </div>
          <Button variant="ghost" onClick={clearLog} className="px-2.5 py-1 text-xs">
            <Trash2 size={13} />
            Clear
          </Button>
        </div>
        <Console log={log} />
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    idle: "bg-surface-2 text-muted",
    Installing: "bg-accent/15 text-accent-soft",
    Launching: "bg-accent/15 text-accent-soft",
    Running: "bg-green-500/15 text-green-300",
    Stopped: "bg-surface-2 text-muted",
    error: "bg-red-500/15 text-red-300",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${map[status] ?? map.idle}`}
    >
      {status === "idle" ? "Ready" : status}
    </span>
  );
}

function Console({ log }: { log: string[] }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 font-mono text-xs leading-relaxed text-muted">
      {log.length === 0 ? (
        <span className="text-muted/60">
          Game output will appear here once you launch…
        </span>
      ) : (
        log.map((line, i) => (
          <div key={i} className="whitespace-pre-wrap break-words text-text/80">
            {line}
          </div>
        ))
      )}
    </div>
  );
}
