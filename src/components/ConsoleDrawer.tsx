import { useEffect, useRef } from "react";
import { Terminal, Trash2, ChevronDown } from "lucide-react";
import { useLaunch } from "../store/launch";

const STATUS_STYLE: Record<string, string> = {
  idle: "bg-surface-2 text-muted",
  Installing: "bg-accent/15 text-accent-soft",
  Launching: "bg-accent/15 text-accent-soft",
  Running: "bg-green-500/15 text-green-300",
  Stopped: "bg-surface-2 text-muted",
  error: "bg-red-500/15 text-red-300",
};

export function ConsoleDrawer() {
  const { log, status, progress, error, consoleOpen, setConsoleOpen, clearLog } =
    useLaunch();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (consoleOpen) endRef.current?.scrollIntoView({ block: "end" });
  }, [log, consoleOpen]);

  if (!consoleOpen) return null;

  const pct =
    progress && progress.total > 0
      ? (progress.current / progress.total) * 100
      : null;

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 flex h-72 flex-col border-t border-border bg-[#161618] shadow-2xl">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2.5 text-sm font-medium">
          <Terminal size={15} className="text-accent-soft" />
          Console
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              STATUS_STYLE[status] ?? STATUS_STYLE.idle
            }`}
          >
            {status === "idle" ? "Ready" : status}
          </span>
          {progress && (
            <span className="text-xs text-muted">
              {progress.current}/{progress.total} files
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearLog}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-text"
          >
            <Trash2 size={13} />
            Clear
          </button>
          <button
            onClick={() => setConsoleOpen(false)}
            className="rounded-md p-1 text-muted transition-colors hover:bg-surface-hover hover:text-text"
          >
            <ChevronDown size={18} />
          </button>
        </div>
      </div>

      {pct !== null && (
        <div className="h-1 w-full bg-surface-2">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 font-mono text-xs leading-relaxed">
        {error && <div className="mb-2 text-red-300">{error}</div>}
        {log.length === 0 ? (
          <span className="text-muted/60">Game output will appear here…</span>
        ) : (
          log.map((line, i) => (
            <div key={i} className="whitespace-pre-wrap break-words text-text/80">
              {line}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
