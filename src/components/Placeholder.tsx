import type { LucideIcon } from "lucide-react";

export function Placeholder({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="grid h-full place-items-center">
      <div className="flex max-w-sm flex-col items-center text-center">
        <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-surface text-accent-soft ring-1 ring-border">
          <Icon size={28} />
        </div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
        <span className="mt-4 rounded-full bg-surface px-3 py-1 text-xs text-muted ring-1 ring-border">
          Coming up next
        </span>
      </div>
    </div>
  );
}
