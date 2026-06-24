import { LayoutGrid, Compass, User, Settings as Cog } from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { Placeholder } from "./components/Placeholder";
import { useUI } from "./store/ui";

const TITLES: Record<string, string> = {
  instances: "Instances",
  browse: "Browse Mods",
  accounts: "Accounts",
  settings: "Settings",
};

function App() {
  const view = useUI((s) => s.view);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-text">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="no-select flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
          <h1 className="text-base font-semibold">{TITLES[view]}</h1>
        </header>

        {/* Page body */}
        <main className="min-h-0 flex-1 overflow-y-auto p-6">
          {view === "instances" && (
            <Placeholder
              icon={LayoutGrid}
              title="No instances yet"
              subtitle="Once launching works, you'll create and manage Minecraft instances here."
            />
          )}
          {view === "browse" && (
            <Placeholder
              icon={Compass}
              title="Browse Modrinth"
              subtitle="Search and install mods filtered to your selected instance's version and loader."
            />
          )}
          {view === "accounts" && (
            <Placeholder
              icon={User}
              title="Microsoft Accounts"
              subtitle="Sign in with your Microsoft / Xbox account to play online. Multi-account support included."
            />
          )}
          {view === "settings" && (
            <Placeholder
              icon={Cog}
              title="Settings"
              subtitle="Customize accent color, default Java args, RAM, resolution, and the instance directory."
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
