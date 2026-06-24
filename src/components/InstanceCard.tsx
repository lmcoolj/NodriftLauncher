import { useState } from "react";
import {
  Play,
  Square,
  MoreVertical,
  Pencil,
  Copy,
  Trash2,
  Loader2,
  Package,
} from "lucide-react";
import type { Instance } from "../lib/api";

const LOADER_LABEL: Record<string, string> = {
  fabric: "Fabric",
  quilt: "Quilt",
  forge: "Forge",
  neoforge: "NeoForge",
};

export function InstanceCard({
  instance,
  selected,
  busy,
  running,
  statusLabel,
  onSelect,
  onPlay,
  onStop,
  onMods,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  instance: Instance;
  selected: boolean;
  busy: boolean;
  running: boolean;
  statusLabel?: string;
  onSelect: () => void;
  onPlay: () => void;
  onStop: () => void;
  onMods: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const modCount = instance.mods?.length ?? 0;

  return (
    <div
      onClick={onSelect}
      className={[
        "group relative flex cursor-pointer flex-col rounded-card bg-surface p-4 ring-1 transition-all duration-150",
        selected
          ? "ring-accent"
          : "ring-border hover:bg-surface-hover hover:ring-border",
      ].join(" ")}
    >
      {/* Header: icon + menu */}
      <div className="flex items-start justify-between">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-surface-2 text-2xl ring-1 ring-border">
          {instance.icon ?? "🟪"}
        </div>

        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((o) => !o);
            }}
            className="rounded-md p-1.5 text-muted opacity-0 transition-all hover:bg-surface-2 hover:text-text group-hover:opacity-100"
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                }}
              />
              <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-lg bg-surface-2 py-1 shadow-xl ring-1 ring-border">
                {instance.loader && (
                  <MenuItem icon={Package} label="Download mods" onClick={() => { setMenuOpen(false); onMods(); }} />
                )}
                <MenuItem icon={Pencil} label="Edit" onClick={() => { setMenuOpen(false); onEdit(); }} />
                <MenuItem icon={Copy} label="Duplicate" onClick={() => { setMenuOpen(false); onDuplicate(); }} />
                <MenuItem
                  icon={Trash2}
                  label="Delete"
                  danger
                  onClick={() => { setMenuOpen(false); onDelete(); }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="mt-3 min-w-0">
        <div className="truncate font-medium">{instance.name}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <span className="rounded-full bg-surface-2 px-2 py-0.5">{instance.mc_version}</span>
          {instance.loader && (
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-accent-soft">
              {LOADER_LABEL[instance.loader.kind] ?? instance.loader.kind}
            </span>
          )}
          {modCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <Package size={11} />
              {modCount}
            </span>
          )}
        </div>
      </div>

      {/* Play / Stop */}
      {running ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStop();
          }}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-red-500/90 px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:bg-red-500"
        >
          <Square size={15} fill="currentColor" />
          Stop
        </button>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlay();
          }}
          disabled={busy}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-contrast shadow-md shadow-accent/20 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          {busy ? statusLabel ?? "Working…" : "Play"}
        </button>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof Pencil;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={[
        "flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors",
        danger
          ? "text-red-300 hover:bg-red-500/10"
          : "text-text hover:bg-surface-hover",
      ].join(" ")}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}
