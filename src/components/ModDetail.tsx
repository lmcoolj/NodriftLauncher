import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  Plus,
  Check,
  Trash2,
  Loader2,
  Package,
  Download,
  Heart,
  ExternalLink,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Button } from "./Button";
import { compact } from "./ModCard";
import { modrinthProject, type ProjectDetail } from "../lib/api";

export function ModDetail({
  projectId,
  installed,
  busy,
  onInstall,
  onRemove,
  onBack,
}: {
  projectId: string;
  installed: boolean;
  busy: boolean;
  onInstall: () => void;
  onRemove: () => void;
  onBack: () => void;
}) {
  const [p, setP] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setP(null);
    setError(null);
    modrinthProject(projectId)
      .then(setP)
      .catch((e) => setError(String(e)));
  }, [projectId]);

  const links = p
    ? [
        { label: "Source", url: p.source_url },
        { label: "Issues", url: p.issues_url },
        { label: "Wiki", url: p.wiki_url },
      ].filter((l) => l.url)
    : [];

  return (
    <div className="mx-auto max-w-3xl">
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-text"
      >
        <ArrowLeft size={16} />
        Back to search
      </button>

      {error && <p className="text-sm text-red-300">{error}</p>}

      {!p && !error && (
        <div className="flex items-center gap-2 py-10 text-muted">
          <Loader2 className="animate-spin" /> Loading…
        </div>
      )}

      {p && (
        <>
          <div className="flex items-start gap-4">
            {p.icon_url ? (
              <img
                src={p.icon_url}
                alt=""
                className="h-20 w-20 shrink-0 rounded-2xl bg-surface-2 object-cover ring-1 ring-border"
              />
            ) : (
              <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-surface-2 text-muted ring-1 ring-border">
                <Package size={28} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold">{p.title}</h2>
              <p className="mt-1 text-sm text-muted">{p.description}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
                <span className="inline-flex items-center gap-1">
                  <Download size={12} />
                  {compact(p.downloads)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Heart size={12} />
                  {compact(p.followers)}
                </span>
                {p.categories.slice(0, 5).map((c) => (
                  <span key={c} className="rounded-full bg-surface-2 px-2 py-0.5">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {installed ? (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-500/15 px-4 py-2 text-sm font-medium text-green-300">
                  <Check size={15} />
                  Installed
                </span>
                <Button variant="danger" onClick={onRemove} disabled={busy}>
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  Remove
                </Button>
              </>
            ) : (
              <Button onClick={onInstall} disabled={busy}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                {busy ? "Installing…" : "Install"}
              </Button>
            )}
            {links.map((l) => (
              <Button key={l.label} variant="ghost" onClick={() => openUrl(l.url!)}>
                <ExternalLink size={14} />
                {l.label}
              </Button>
            ))}
          </div>

          {/* Gallery */}
          {p.gallery.length > 0 && (
            <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
              {p.gallery.map((url) => (
                <img
                  key={url}
                  src={url}
                  alt=""
                  className="h-44 rounded-card ring-1 ring-border"
                />
              ))}
            </div>
          )}

          {/* Body */}
          <div className="markdown mt-6 border-t border-border pt-5">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{p.body}</ReactMarkdown>
          </div>
        </>
      )}
    </div>
  );
}
