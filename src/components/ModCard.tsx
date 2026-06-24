import { Check, Trash2, Loader2, Plus, Package } from "lucide-react";
import type { SearchHit } from "../lib/api";

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

export function ModCard({
  hit,
  installed,
  busy,
  onInstall,
  onRemove,
  onOpen,
}: {
  hit: SearchHit;
  installed: boolean;
  busy: boolean;
  onInstall: () => void;
  onRemove: () => void;
  onOpen: () => void;
}) {
  return (
    <div className="flex flex-col rounded-card bg-surface p-4 ring-1 ring-border transition-colors hover:bg-surface-hover">
      <button onClick={onOpen} className="flex gap-3 text-left">
        {hit.icon_url ? (
          <img
            src={hit.icon_url}
            alt=""
            className="h-12 w-12 shrink-0 rounded-lg bg-surface-2 object-cover ring-1 ring-border"
          />
        ) : (
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted ring-1 ring-border">
            <Package size={20} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium hover:text-accent-soft">{hit.title}</div>
          <div className="truncate text-xs text-muted">
            by {hit.author} · {compact(hit.downloads)} downloads
          </div>
        </div>
      </button>

      <button
        onClick={onOpen}
        className="mt-3 line-clamp-3 flex-1 text-left text-sm text-muted"
      >
        {hit.description}
      </button>

      <div className="mt-3">
        {installed ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-green-500/15 px-3 py-2 text-sm font-medium text-green-300">
              <Check size={15} />
              Installed
            </span>
            <button
              onClick={onRemove}
              disabled={busy}
              className="rounded-lg p-2 text-red-300 ring-1 ring-red-500/30 transition-colors hover:bg-red-500/10 disabled:opacity-50"
              title="Remove"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
            </button>
          </div>
        ) : (
          <button
            onClick={onInstall}
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-contrast shadow-md shadow-accent/20 transition-all hover:brightness-110 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Plus size={15} />
            )}
            {busy ? "Installing…" : "Install"}
          </button>
        )}
      </div>
    </div>
  );
}

export { compact };
