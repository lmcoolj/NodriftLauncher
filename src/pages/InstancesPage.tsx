import { useEffect, useState } from "react";
import { Plus, LayoutGrid, Terminal, AlertTriangle, Boxes } from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { InstanceCard } from "../components/InstanceCard";
import { InstanceModal } from "../components/InstanceModal";
import { ImportModal } from "../components/ImportModal";
import { useInstances } from "../store/instances";
import { useLaunch } from "../store/launch";
import { useAccounts } from "../store/accounts";
import { useSettings } from "../store/settings";
import { useUI } from "../store/ui";
import type { Instance } from "../lib/api";

export function InstancesPage() {
  const { instances, loading, error, selectedId, refresh, remove, duplicate, select } =
    useInstances();
  const { status, activeId, launch, kill, setConsoleOpen, consoleOpen } = useLaunch();
  const active = useAccounts((s) => s.active);
  const setView = useUI((s) => s.setView);
  const openInstance = useUI((s) => s.openInstance);
  const { defaultRamMb, defaultJavaArgs, resolution } = useSettings();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Instance | null>(null);
  const [deleting, setDeleting] = useState<Instance | null>(null);
  const [importPath, setImportPath] = useState<string | null>(null);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const pickModpack = async () => {
    const selected = await openDialog({
      multiple: false,
      filters: [{ name: "Modpack", extensions: ["mrpack", "zip"] }],
    });
    if (typeof selected === "string") setImportPath(selected);
  };

  const launchBusy =
    status === "Installing" || status === "Launching" || status === "Running";

  const onPlay = (inst: Instance) => {
    if (!active) {
      setView("accounts");
      return;
    }
    launch({
      instanceId: inst.id,
      defaultRamMb,
      defaultJavaArgs,
      width: resolution.width,
      height: resolution.height,
    });
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Your instances</h2>
          <p className="text-sm text-muted">
            Same-version instances share one install — only mods & saves differ.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!consoleOpen && (
            <Button variant="ghost" onClick={() => setConsoleOpen(true)}>
              <Terminal size={16} />
              Console
            </Button>
          )}
          <Button variant="ghost" onClick={pickModpack}>
            <Boxes size={16} />
            Import
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={16} />
            New instance
          </Button>
        </div>
      </div>

      {!active && instances.length > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-300 ring-1 ring-amber-500/30">
          <span>You're not signed in — playing requires a Microsoft account.</span>
          <Button variant="ghost" onClick={() => setView("accounts")}>
            Sign in
          </Button>
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-red-500/30">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {instances.length === 0 && !loading ? (
        <div className="grid place-items-center rounded-card border border-dashed border-border py-20 text-center">
          <div className="mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-surface text-accent-soft ring-1 ring-border">
            <LayoutGrid size={26} />
          </div>
          <p className="font-medium">No instances yet</p>
          <p className="mt-1 max-w-xs text-sm text-muted">
            Create your first instance to pick a Minecraft version and mod loader.
          </p>
          <Button className="mt-4" onClick={() => setCreateOpen(true)}>
            <Plus size={16} />
            New instance
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
          {instances.map((inst) => (
            <InstanceCard
              key={inst.id}
              instance={inst}
              selected={selectedId === inst.id}
              busy={launchBusy && activeId === inst.id}
              running={status === "Running" && activeId === inst.id}
              statusLabel={status}
              onSelect={() => openInstance(inst.id)}
              onPlay={() => onPlay(inst)}
              onStop={() => kill(inst.id)}
              onMods={() => {
                select(inst.id);
                setView("browse");
              }}
              onEdit={() => setEditing(inst)}
              onDuplicate={() => duplicate(inst.id)}
              onDelete={() => setDeleting(inst)}
            />
          ))}
        </div>
      )}

      {/* Import */}
      <ImportModal
        open={!!importPath}
        path={importPath}
        onClose={() => setImportPath(null)}
        onImported={(inst) => {
          refresh();
          select(inst.id);
          setImportPath(null);
        }}
      />

      {/* Create */}
      <InstanceModal open={createOpen} onClose={() => setCreateOpen(false)} />

      {/* Edit */}
      <InstanceModal
        open={!!editing}
        editing={editing}
        onClose={() => setEditing(null)}
      />

      {/* Delete confirmation */}
      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete instance"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (deleting) await remove(deleting.id);
                setDeleting(null);
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Permanently delete <strong className="text-text">{deleting?.name}</strong> and
          all its mods, saves, and config? This can't be undone.
        </p>
      </Modal>
    </div>
  );
}
