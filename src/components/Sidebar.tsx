import { LayoutGrid, Compass, User, Settings as Cog } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useUI, type View } from "../store/ui";

const NAV: { view: View; label: string; icon: LucideIcon }[] = [
  { view: "instances", label: "Instances", icon: LayoutGrid },
  { view: "browse", label: "Browse Mods", icon: Compass },
  { view: "accounts", label: "Accounts", icon: User },
  { view: "settings", label: "Settings", icon: Cog },
];

export function Sidebar() {
  const { view, setView } = useUI();

  return (
    <aside className="no-select flex h-full w-60 shrink-0 flex-col border-r border-border bg-surface-2">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 pb-4 pt-6">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-accent-contrast shadow-lg shadow-accent/20">
          <span className="text-lg font-black leading-none">N</span>
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">Nodrift</div>
          <div className="text-xs text-muted">Launcher</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
        {NAV.map(({ view: v, label, icon: Icon }) => {
          const active = view === v;
          return (
            <button
              key={v}
              onClick={() => setView(v)}
              className={[
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                active
                  ? "bg-accent text-accent-contrast shadow-md shadow-accent/20"
                  : "text-muted hover:bg-surface-hover hover:text-text",
              ].join(" ")}
            >
              <Icon
                size={18}
                className={active ? "" : "transition-transform group-hover:scale-110"}
              />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="px-5 py-4 text-[11px] text-muted">v0.1.0 · dev</div>
    </aside>
  );
}
