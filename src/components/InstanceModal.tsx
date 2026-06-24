import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import {
  listVersions,
  listLoaderVersions,
  type Instance,
  type LoaderKind,
  type LoaderVersion,
  type VersionInfo,
} from "../lib/api";
import { useInstances } from "../store/instances";

const ICONS = ["🟪", "🧊", "🌿", "🔥", "⚙️", "🗡️", "🏰", "💎", "🚀", "🐉", "👾", "🌌"];

const LOADERS: { value: LoaderKind | "vanilla"; label: string }[] = [
  { value: "vanilla", label: "Vanilla (no loader)" },
  { value: "fabric", label: "Fabric" },
  { value: "quilt", label: "Quilt" },
  { value: "neoforge", label: "NeoForge" },
  { value: "forge", label: "Forge" },
];

export function InstanceModal({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  /** When provided, the modal edits this instance instead of creating one. */
  editing?: Instance | null;
}) {
  const { create, update } = useInstances();
  const isEdit = !!editing;

  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(ICONS[0]);
  const [version, setVersion] = useState("");
  const [loader, setLoader] = useState<LoaderKind | "vanilla">("vanilla");
  const [loaderVersion, setLoaderVersion] = useState("");
  const [loaderVersions, setLoaderVersions] = useState<LoaderVersion[]>([]);
  const [loadingLoaders, setLoadingLoaders] = useState(false);
  const [loaderErr, setLoaderErr] = useState<string | null>(null);
  const [ramOverride, setRamOverride] = useState(false);
  const [ramMb, setRamMb] = useState(4096);
  const [argsOverride, setArgsOverride] = useState(false);
  const [javaArgs, setJavaArgs] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load versions once the modal opens.
  useEffect(() => {
    if (!open) return;
    listVersions()
      .then((v) => {
        setVersions(v);
        if (!editing) {
          const first = v.find((x) => x.type === "release");
          if (first) setVersion(first.id);
        }
      })
      .catch((e) => setError(String(e)));
  }, [open, editing]);

  // Seed fields from the instance being edited (or reset for create).
  useEffect(() => {
    if (!open) return;
    setError(null);
    setBusy(false);
    if (editing) {
      setName(editing.name);
      setIcon(editing.icon ?? ICONS[0]);
      setVersion(editing.mc_version);
      setLoader(editing.loader?.kind ?? "vanilla");
      setLoaderVersion(editing.loader?.version ?? "");
      setRamOverride(editing.ram_mb != null);
      setRamMb(editing.ram_mb ?? 4096);
      setArgsOverride(editing.java_args != null);
      setJavaArgs(editing.java_args ?? "");
    } else {
      setName("");
      setIcon(ICONS[Math.floor(Math.random() * ICONS.length)]);
      setLoader("vanilla");
      setLoaderVersion("");
      setShowSnapshots(false);
      setRamOverride(false);
      setRamMb(4096);
      setArgsOverride(false);
      setJavaArgs("");
    }
  }, [open, editing]);

  // Fetch loader versions whenever the loader or MC version changes, and
  // auto-select the latest compatible one.
  useEffect(() => {
    if (!open || loader === "vanilla" || !version) {
      setLoaderVersions([]);
      setLoaderErr(null);
      return;
    }
    let cancelled = false;
    setLoadingLoaders(true);
    setLoaderErr(null);
    listLoaderVersions(loader, version)
      .then((vers) => {
        if (cancelled) return;
        // Keep an edited instance's saved version selectable even if old.
        const saved =
          editing?.loader?.kind === loader ? editing.loader.version : null;
        let list = vers;
        if (saved && !vers.some((v) => v.version === saved)) {
          list = [{ version: saved, stable: true }, ...vers];
        }
        setLoaderVersions(list);
        setLoaderVersion((cur) => {
          if (cur && list.some((v) => v.version === cur)) return cur;
          if (saved) return saved;
          return (list.find((v) => v.stable) ?? list[0])?.version ?? "";
        });
      })
      .catch((e) => {
        if (!cancelled) {
          setLoaderErr(String(e));
          setLoaderVersions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingLoaders(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, loader, version, editing]);

  const shown = useMemo(
    () => versions.filter((v) => showSnapshots || v.type === "release" || v.id === version),
    [versions, showSnapshots, version]
  );

  const loaderReady =
    loader === "vanilla" ||
    (!loadingLoaders && !loaderErr && loaderVersion.trim().length > 0);
  const canSave = name.trim().length > 0 && !!version && loaderReady && !busy;

  const save = async () => {
    setBusy(true);
    setError(null);
    const loaderInfo =
      loader === "vanilla" ? null : { kind: loader, version: loaderVersion.trim() };
    try {
      if (editing) {
        await update({
          ...editing,
          name: name.trim(),
          icon,
          mc_version: version,
          loader: loaderInfo,
          ram_mb: ramOverride ? ramMb : null,
          java_args: argsOverride ? javaArgs.trim() : null,
        });
      } else {
        await create({ name: name.trim(), mc_version: version, loader: loaderInfo, icon });
      }
      onClose();
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit instance" : "New instance"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!canSave}>
            {isEdit ? "Save" : "Create"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Icon + name */}
        <div className="flex gap-3">
          <div className="grid h-[58px] w-[58px] shrink-0 place-items-center rounded-card bg-surface-2 text-3xl ring-1 ring-border">
            {icon}
          </div>
          <label className="flex flex-1 flex-col gap-1.5 text-sm">
            <span className="text-muted">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My instance"
              autoFocus
              className="rounded-lg bg-surface-2 px-3 py-2 ring-1 ring-border placeholder:text-muted focus:outline-none focus:ring-accent"
            />
          </label>
        </div>

        {/* Icon picker */}
        <div className="flex flex-wrap gap-1.5">
          {ICONS.map((e) => (
            <button
              key={e}
              onClick={() => setIcon(e)}
              className={[
                "grid h-9 w-9 place-items-center rounded-lg text-xl transition-colors",
                icon === e ? "bg-accent/20 ring-1 ring-accent" : "hover:bg-surface-hover",
              ].join(" ")}
            >
              {e}
            </button>
          ))}
        </div>

        {/* Version */}
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

        {/* Loader */}
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
                {loadingLoaders && <option>Loading…</option>}
                {!loadingLoaders && loaderVersions.length === 0 && (
                  <option>None available</option>
                )}
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
        {loaderErr && (
          <p className="-mt-1 text-xs text-red-300">
            Couldn't load {loader} versions: {loaderErr}
          </p>
        )}
        {!loadingLoaders &&
          !loaderErr &&
          loader !== "vanilla" &&
          loaderVersions.length === 0 && (
            <p className="-mt-1 text-xs text-amber-300">
              No {loader} builds for Minecraft {version}. Pick another version or
              loader.
            </p>
          )}

        {/* Per-instance overrides (edit only) */}
        {isEdit && (
          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <label className="flex flex-col gap-2 text-sm">
              <span className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={ramOverride}
                    onChange={(e) => setRamOverride(e.target.checked)}
                    className="accent-[var(--accent)]"
                  />
                  <span className="text-muted">RAM override</span>
                </span>
                {ramOverride && (
                  <span className="font-mono text-xs text-accent-soft">
                    {(ramMb / 1024).toFixed(1)} GB
                  </span>
                )}
              </span>
              {ramOverride && (
                <input
                  type="range"
                  min={1024}
                  max={16384}
                  step={512}
                  value={ramMb}
                  onChange={(e) => setRamMb(Number(e.target.value))}
                  className="accent-[var(--accent)]"
                />
              )}
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={argsOverride}
                  onChange={(e) => setArgsOverride(e.target.checked)}
                  className="accent-[var(--accent)]"
                />
                <span className="text-muted">Java args override</span>
              </span>
              {argsOverride && (
                <input
                  value={javaArgs}
                  onChange={(e) => setJavaArgs(e.target.value)}
                  placeholder="-XX:+UseG1GC ..."
                  className="rounded-lg bg-surface-2 px-3 py-2 font-mono text-xs ring-1 ring-border placeholder:text-muted focus:outline-none focus:ring-accent"
                />
              )}
            </label>
          </div>
        )}

        {error && <p className="text-sm text-red-300">{error}</p>}
      </div>
    </Modal>
  );
}
