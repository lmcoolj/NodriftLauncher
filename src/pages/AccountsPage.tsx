import { useEffect } from "react";
import { Check, LogIn, Trash2, AlertTriangle, User } from "lucide-react";
import { Button } from "../components/Button";
import { useAccounts } from "../store/accounts";

export function AccountsPage() {
  const { accounts, loading, loggingIn, error, refresh, login, setActive, remove } =
    useAccounts();

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Microsoft Accounts</h2>
          <p className="text-sm text-muted">
            Sign in with your Microsoft / Xbox account to play online.
          </p>
        </div>
        <Button onClick={login} disabled={loggingIn}>
          <LogIn size={16} />
          {loggingIn ? "Waiting for login…" : "Add account"}
        </Button>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-red-500/30">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {accounts.length === 0 && !loading ? (
        <div className="grid place-items-center rounded-card border border-dashed border-border py-16 text-center">
          <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-surface text-accent-soft ring-1 ring-border">
            <User size={24} />
          </div>
          <p className="font-medium">No accounts yet</p>
          <p className="mt-1 max-w-xs text-sm text-muted">
            Add a Microsoft account to launch the game online.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {accounts.map((a) => (
            <li
              key={a.uuid}
              className={[
                "flex items-center gap-3 rounded-card bg-surface px-4 py-3 ring-1 transition-colors",
                a.active ? "ring-accent" : "ring-border hover:bg-surface-hover",
              ].join(" ")}
            >
              <img
                src={`https://mc-heads.net/avatar/${a.uuid}/40`}
                alt=""
                width={40}
                height={40}
                className="rounded-md bg-surface-2"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{a.username}</span>
                  {a.active && (
                    <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent-soft">
                      Active
                    </span>
                  )}
                  {a.expired && (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                      Token expired — refreshes on launch
                    </span>
                  )}
                </div>
                <div className="truncate text-xs text-muted">{a.uuid}</div>
              </div>
              {!a.active && (
                <Button variant="ghost" onClick={() => setActive(a.uuid)}>
                  <Check size={15} />
                  Use
                </Button>
              )}
              <Button variant="danger" onClick={() => remove(a.uuid)}>
                <Trash2 size={15} />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
