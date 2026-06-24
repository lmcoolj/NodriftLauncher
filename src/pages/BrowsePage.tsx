import { useEffect, useMemo, useState } from "react";
import { Search, Compass, AlertTriangle, Loader2, Plus } from "lucide-react";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { ModCard } from "../components/ModCard";
import {
  modrinthSearch,
  modrinthResolve,
  modrinthInstall,
  removeMod,
  type SearchHit,
  type InstallPlan,
} from "../lib/api";
import { useInstances } from "../store/instances";
import { useUI } from "../store/ui";

export function BrowsePage() {
  const { instances, selectedId, select, apply } = useInstances();
  const setView = useUI((s) => s.setView);

  const instance = useMemo(
    () => instances.find((i) => i.id === selectedId) ?? instances[0] ?? null,
    [instances, selectedId]
  );

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [plan, setPlan] = useState<{ data: InstallPlan; mainTitle: string } | null>(null);
  const [installingPlan, setInstallingPlan] = useState(false);

  const installed = useMemo(
    () => new Set(instance?.mods.map((m) => m.project_id) ?? []),
    [instance]
  );
  const hasLoader = !!instance?.loader;

  const runSearch = async (q: string, offset: number, append: boolean) => {
    if (!instance || !hasLoader) return;
    setLoading(true);
    setError(null);
    try {
      const res = await modrinthSearch(
        q,
        instance.mc_version,
        instance.loader!.kind,
        offset
      );
      setTotal(res.total_hits);
      setHits((prev) => (append ? [...prev, ...res.hits] : res.hits));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  // Re-search when the target instance changes.
  useEffect(() => {
    if (instance && hasLoader) runSearch(query, 0, false);
    else setHits([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance?.id]);

  const startInstall = async (projectId: string, title: string) => {
    if (!instance) return;
    setBusyId(projectId);
    setError(null);
    try {
      const data = await modrinthResolve(instance.id, projectId);
      const deps = data.items.filter((i) => i.is_dependency);
      if (deps.length > 0) {
        setPlan({ data, mainTitle: title });
        setBusyId(null); // decision happens in the modal
      } else {
        apply(await modrinthInstall(instance.id, data.items));
        setBusyId(null);
      }
    } catch (e) {
      setError(String(e));
      setBusyId(null);
    }
  };

  const confirmPlan = async () => {
    if (!instance || !plan) return;
    setInstallingPlan(true);
    try {
      apply(await modrinthInstall(instance.id, plan.data.items));
      setPlan(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setInstallingPlan(false);
    }
  };

  const uninstall = async (projectId: string) => {
    if (!instance) return;
    setBusyId(projectId);
    try {
      apply(await removeMod(instance.id, projectId));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusyId(null);
    }
  };

  if (instances.length === 0) {
    return (
      <EmptyNotice
        title="No instances yet"
        subtitle="Create an instance first — mods install into a specific instance."
        action={<Button onClick={() => setView("instances")}>Go to Instances</Button>}
      />
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Target instance + search */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">Install into</span>
          <select
            value={instance?.id}
            onChange={(e) => select(e.target.value)}
            className="rounded-lg bg-surface-2 px-3 py-2 ring-1 ring-border focus:outline-none focus:ring-accent"
          >
            {instances.map((i) => (
              <option key={i.id} value={i.id}>
                {i.icon ? `${i.icon} ` : ""}
                {i.name} · {i.mc_version}
                {i.loader ? ` · ${i.loader.kind}` : ""}
              </option>
            ))}
          </select>
        </label>

        <form
          className="flex min-w-[240px] flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            runSearch(query, 0, false);
          }}
        >
          <div className="relative flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Modrinth…"
              disabled={!hasLoader}
              className="w-full rounded-lg bg-surface-2 py-2 pl-9 pr-3 ring-1 ring-border placeholder:text-muted focus:outline-none focus:ring-accent disabled:opacity-50"
            />
          </div>
          <Button type="submit" disabled={!hasLoader}>
            Search
          </Button>
        </form>
      </div>

      {hasLoader && (
        <p className="mb-4 text-xs text-muted">
          Showing only mods compatible with{" "}
          <span className="text-accent-soft">
            {instance!.loader!.kind} {instance!.mc_version}
          </span>
          {total > 0 ? ` · ${total.toLocaleString()} results` : ""}
        </p>
      )}

      {!hasLoader && (
        <EmptyNotice
          title="This instance has no mod loader"
          subtitle="Mods need Fabric, Quilt, Forge, or NeoForge. Pick another instance above, or edit this one to add a loader."
        />
      )}

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-red-500/30">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {hasLoader && (
        <>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
            {hits.map((hit) => (
              <ModCard
                key={hit.project_id}
                hit={hit}
                installed={installed.has(hit.project_id)}
                busy={busyId === hit.project_id}
                onInstall={() => startInstall(hit.project_id, hit.title)}
                onRemove={() => uninstall(hit.project_id)}
              />
            ))}
          </div>

          {loading && (
            <div className="mt-6 flex justify-center text-muted">
              <Loader2 className="animate-spin" />
            </div>
          )}

          {!loading && hits.length === 0 && (
            <p className="mt-10 text-center text-sm text-muted">No mods found.</p>
          )}

          {!loading && hits.length < total && (
            <div className="mt-6 flex justify-center">
              <Button
                variant="ghost"
                onClick={() => runSearch(query, hits.length, true)}
              >
                Load more
              </Button>
            </div>
          )}
        </>
      )}

      {/* Dependency confirmation */}
      <Modal
        open={!!plan}
        onClose={() => !installingPlan && setPlan(null)}
        title="Install with dependencies"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPlan(null)} disabled={installingPlan}>
              Cancel
            </Button>
            <Button onClick={confirmPlan} disabled={installingPlan}>
              {installingPlan ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Plus size={16} />
              )}
              Install all
            </Button>
          </>
        }
      >
        {plan && (
          <div className="text-sm">
            <p className="text-muted">
              <span className="font-medium text-text">{plan.mainTitle}</span> needs
              these dependencies, which will also be installed:
            </p>
            <ul className="mt-3 flex flex-col gap-1.5">
              {plan.data.items
                .filter((i) => i.is_dependency)
                .map((d) => (
                  <li
                    key={d.project_id}
                    className="rounded-lg bg-surface-2 px-3 py-2 ring-1 ring-border"
                  >
                    {d.title}
                  </li>
                ))}
            </ul>
          </div>
        )}
      </Modal>
    </div>
  );
}

function EmptyNotice({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid place-items-center rounded-card border border-dashed border-border py-16 text-center">
      <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-surface text-accent-soft ring-1 ring-border">
        <Compass size={24} />
      </div>
      <p className="font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted">{subtitle}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
