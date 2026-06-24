import { useEffect, useMemo, useState } from "react";
import { Loader2, Package, Boxes } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import {
  inspectModpack,
  importMrpack,
  importZip,
  listVersions,
  listLoaderVersions,
  type Instance,
  type LoaderKind,
  type LoaderVersion,
  type ModpackInfo,
  type VersionInfo,
} from "../lib/api";

const LOADERS: { value: LoaderKind | "vanilla"; label: string }[] = [
  { value: "vanilla", label: "Vanilla (no loader)" },
  { value: "fabric", label: "Fabric" },
  { value: "quilt", label: "Quilt" },
  { value: "neoforge", label: "NeoForge" },
  { value: "forge", label: "Forge" },
];

export function ImportModal({
  open,
  path,
  onClose,
  onImported,
}: {
  open: boolean;
  path: string | null;
  onClose: () => void;
  onImported: (instance: Instance) => void;
}) {
  const [info, setInfo] = useState<ModpackInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // .zip configuration
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [loader, setLoader] = useState<LoaderKind | "vanilla">("vanilla");
  const [loaderVersion, setLoaderVersion] = useState("");
  const [loaderVersions, setLoaderVersions] = useState<LoaderVersion[]>([]);
  const [loadingLoaders, setLoadingLoaders] = useState(false);

  // Inspect the file when opened.
  useEffect(() => {
    if (!open || !path) return;
    setInfo(null);
    setError(null);
    setLoading(true);
    inspectModpack(path)
      .then((i) => {
        setInfo(i);
        setName(i.name);
        if (i.kind === "zip") listVersions().then(setVersions).catch(() => {});
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [open, path]);

  // Default the zip version to the latest release once versions load.
  useEffect(() => {
    if (info?.kind === "zip" && !version && versions.length) {
      const r = versions.find((v) => v.type === "release");
      if (r) setVersion(r.id);
    }
  }, [info, versions, version]);

  // Fetch loader versions for the zip case.
  useEffect(() => {
    if (info?.kind !== "zip" || loader === "vanilla" || !version) {
      setLoaderVersions([]);
      return;
    }
    let cancelled = false;
    setLoadingLoaders(true);
    listLoaderVersions(loader, version)
      .then((vers) => {
        if (cancelled) return;
        setLoaderVersions(vers);
        setLoaderVersion((vers.find((v) => v.stable) ?? vers[0])?.version ?? "");
      })
      .catch(() => !cancelled && setLoaderVersions([]))
      .finally(() => !cancelled && setLoadingLoaders(false));
    return () => {
      cancelled = true;
    };
  }, [info, loader, version]);

  const shown = useMemo(
    () => versions.filter((v) => showSnapshots || v.type === "release" || v.id === version),
    [versions, showSnapshots, version]
  );

  const doImport = async () => {
    if (!path || !info) return;
    setImporting(true);
    setError(null);
    try {
      const instance =
        info.kind === "mrpack"
          ? await importMrpack(path)
          : await importZip(
              path,
              name.trim(),
              version,
              loader === "vanilla"
                ? null
                : { kind: loader, version: loaderVersion.trim() },
            );
      onImported(instance);
    } catch (e) {
      setError(String(e));
      setImporting(false);
    }
  };

  const zipReady =
    info?.kind === "zip" &&
    name.trim().length > 0 &&
    !!version &&
    (loader === "vanilla" || (!loadingLoaders && loaderVersion.length > 0));
  const canImport = info?.kind === "mrpack" || zipReady;

  return (
    <Modal
      open={open}
      onClose={() => !importing && onClose()}
      title="Import modpack"
      footer={
        info && (
          <>
            <Button variant="ghost" onClick={onClose} disabled={importing}>
              Cancel
            </Button>
            <Button onClick={doImport} disabled={!canImport || importing}>
              {importing ? <Loader2 size={16} className="animate-spin" /> : <Boxes size={16} />}
              {importing ? "Importing…" : "Import"}
            </Button>
          </>
        )
      }
    >
      {loading && (
        <div className="flex items-center gap-2 py-6 text-sm text-muted">
          <Loader2 size={16} className="animate-spin" /> Reading modpack…
        </div>
      )}

      {error && <p className="mb-3 text-sm text-red-300">{error}</p>}

      {info?.kind === "mrpack" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 rounded-card bg-surface-2 p-4 ring-1 ring-border">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-surface text-2xl">
              📦
            </div>
            <div className="min-w-0">
              <div className="truncate font-medium">{info.name}</div>
              <div className="text-xs text-muted">
                Minecraft {info.mc_version}
                {info.loader ? ` · ${info.loader.kind} ${info.loader.version}` : ""}
              </div>
            </div>
          </div>
          <p className="flex items-center gap-2 text-sm text-muted">
            <Package size={15} />
            {info.mod_count} files will be downloaded into a new instance.
          </p>
        </div>
      )}

      {info?.kind === "zip" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            This zip has no manifest, so pick the Minecraft version and loader it's
            built for.
          </p>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted">Instance name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg bg-surface-2 px-3 py-2 ring-1 ring-border focus:outline-none focus:ring-accent"
            />
          </label>
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
            <label className="flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={showSnapshots}
                onChange={(e) => setShowSnapshots(e.target.checked)}
                className="accent-[var(--accent)]"
              />
              Show snapshots
            </label>
          </label>
          <div className="grid grid-cols-2 gap-3">
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
            </label>
            {loader !== "vanilla" && (
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="flex items-center gap-1.5 text-muted">
                  Loader version
                  {loadingLoaders && <Loader2 size={12} className="animate-spin" />}
                </span>
                <select
                  value={loaderVersion}
                  onChange={(e) => setLoaderVersion(e.target.value)}
                  disabled={loadingLoaders || loaderVersions.length === 0}
                  className="rounded-lg bg-surface-2 px-3 py-2 ring-1 ring-border focus:outline-none focus:ring-accent disabled:opacity-60"
                >
                  {loaderVersions.map((v, i) => (
                    <option key={v.version} value={v.version}>
                      {v.version}
                      {v.stable ? (i === 0 ? "  (latest)" : "") : "  (beta)"}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
