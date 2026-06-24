import { useEffect, useState } from "react";
import { Check, FolderOpen, RotateCcw } from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Button } from "../components/Button";
import { useSettings } from "../store/settings";
import { getAppSettings, setAppSettings } from "../lib/api";

const ACCENTS = [
  "#8b5cf6",
  "#a78bfa",
  "#6366f1",
  "#3b82f6",
  "#06b6d4",
  "#22c55e",
  "#f59e0b",
  "#ec4899",
  "#ef4444",
];

const RES_PRESETS = [
  { w: 1280, h: 720 },
  { w: 1600, h: 900 },
  { w: 1920, h: 1080 },
];

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-card bg-surface p-5 ring-1 ring-border">
      <h3 className="font-semibold">{title}</h3>
      <p className="mb-4 mt-0.5 text-sm text-muted">{desc}</p>
      {children}
    </div>
  );
}

export function SettingsPage() {
  const s = useSettings();
  const [instanceDir, setInstanceDir] = useState<string>("");
  const [dirSaved, setDirSaved] = useState(false);

  useEffect(() => {
    getAppSettings()
      .then((cfg) => setInstanceDir(cfg.instance_dir ?? ""))
      .catch(() => {});
  }, []);

  const saveDir = async (dir: string) => {
    setInstanceDir(dir);
    await setAppSettings({ instance_dir: dir || null });
    setDirSaved(true);
    setTimeout(() => setDirSaved(false), 1500);
  };

  const chooseDir = async () => {
    const picked = await openDialog({ directory: true, multiple: false });
    if (typeof picked === "string") saveDir(picked);
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      {/* Accent */}
      <Section title="Accent color" desc="Recolors the whole launcher live.">
        <div className="flex flex-wrap items-center gap-2">
          {ACCENTS.map((c) => (
            <button
              key={c}
              onClick={() => s.set("accent", c)}
              className="grid h-9 w-9 place-items-center rounded-lg ring-2 transition-transform hover:scale-110"
              style={{
                background: c,
                // @ts-expect-error css var
                "--tw-ring-color": s.accent.toLowerCase() === c ? "#fff" : "transparent",
              }}
            >
              {s.accent.toLowerCase() === c && (
                <Check size={16} className="text-white drop-shadow" />
              )}
            </button>
          ))}
          <label className="ml-1 flex items-center gap-2 text-sm text-muted">
            Custom
            <input
              type="color"
              value={s.accent}
              onChange={(e) => s.set("accent", e.target.value)}
              className="h-9 w-12 cursor-pointer rounded-lg bg-surface-2 ring-1 ring-border"
            />
          </label>
        </div>
      </Section>

      {/* Default RAM */}
      <Section
        title="Default memory"
        desc="RAM given to instances without their own override."
      >
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={1024}
            max={16384}
            step={512}
            value={s.defaultRamMb}
            onChange={(e) => s.set("defaultRamMb", Number(e.target.value))}
            className="flex-1 accent-[var(--accent)]"
          />
          <span className="w-16 text-right font-mono text-sm text-accent-soft">
            {(s.defaultRamMb / 1024).toFixed(1)} GB
          </span>
        </div>
      </Section>

      {/* Default Java args */}
      <Section
        title="Default Java arguments"
        desc="JVM flags for instances without their own override."
      >
        <input
          value={s.defaultJavaArgs}
          onChange={(e) => s.set("defaultJavaArgs", e.target.value)}
          spellCheck={false}
          className="w-full rounded-lg bg-surface-2 px-3 py-2 font-mono text-xs ring-1 ring-border focus:outline-none focus:ring-accent"
        />
      </Section>

      {/* Resolution */}
      <Section title="Game window size" desc="Resolution the game launches at.">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm text-muted">
            W
            <input
              type="number"
              value={s.resolution.width}
              onChange={(e) =>
                s.set("resolution", { ...s.resolution, width: Number(e.target.value) })
              }
              className="w-24 rounded-lg bg-surface-2 px-3 py-2 ring-1 ring-border focus:outline-none focus:ring-accent"
            />
          </label>
          <label className="flex items-center gap-1.5 text-sm text-muted">
            H
            <input
              type="number"
              value={s.resolution.height}
              onChange={(e) =>
                s.set("resolution", { ...s.resolution, height: Number(e.target.value) })
              }
              className="w-24 rounded-lg bg-surface-2 px-3 py-2 ring-1 ring-border focus:outline-none focus:ring-accent"
            />
          </label>
          <div className="flex gap-1.5">
            {RES_PRESETS.map((r) => (
              <button
                key={r.w}
                onClick={() => s.set("resolution", { width: r.w, height: r.h })}
                className="rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs text-muted ring-1 ring-border transition-colors hover:bg-surface-hover hover:text-text"
              >
                {r.w}×{r.h}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* Instance directory */}
      <Section
        title="Instance directory"
        desc="Where instances are stored. Changing it affects new lookups; existing instances stay where they are."
      >
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted ring-1 ring-border">
            {instanceDir || "Default (app data folder)"}
          </code>
          <Button variant="ghost" onClick={chooseDir}>
            <FolderOpen size={15} />
            Choose…
          </Button>
          {instanceDir && (
            <Button variant="ghost" onClick={() => saveDir("")}>
              <RotateCcw size={15} />
              Reset
            </Button>
          )}
        </div>
        {dirSaved && (
          <p className="mt-2 text-xs text-green-300">Saved — restart to apply everywhere.</p>
        )}
      </Section>

      <button
        onClick={s.reset}
        className="self-start text-xs text-muted underline-offset-2 hover:text-text hover:underline"
      >
        Reset appearance & launch defaults
      </button>
    </div>
  );
}
