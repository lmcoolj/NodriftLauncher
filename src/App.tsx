import { useEffect } from "react";
import { Compass, Settings as Cog } from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { Placeholder } from "./components/Placeholder";
import { ConsoleDrawer } from "./components/ConsoleDrawer";
import { AccountsPage } from "./pages/AccountsPage";
import { InstancesPage } from "./pages/InstancesPage";
import { useUI } from "./store/ui";
import { useLaunch } from "./store/launch";

const TITLES: Record<string, string> = {
  instances: "Instances",
  browse: "Browse Mods",
  accounts: "Accounts",
  settings: "Settings",
};

function App() {
  const view = useUI((s) => s.view);
  const initLaunch = useLaunch((s) => s.init);

  useEffect(() => {
    initLaunch();
  }, [initLaunch]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-text">
      <Sidebar />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="no-select flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
          <h1 className="text-base font-semibold">{TITLES[view]}</h1>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-6">
          {view === "instances" && <InstancesPage />}
          {view === "accounts" && <AccountsPage />}
          {view === "browse" && (
            <Placeholder
              icon={Compass}
              title="Browse Modrinth"
              subtitle="Search and install mods filtered to your selected instance's version and loader."
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

        <ConsoleDrawer />
      </div>
    </div>
  );
}

export default App;
