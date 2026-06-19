import type { GoalPriority } from "@/db/schema";
import { cn } from "@/lib/utils";

const priorityMap: Record<GoalPriority, { label: string; className: string }> = {
  low: {
    label: "Baixa",
    className: "border-border-default bg-background-elevated text-text-muted",
  },
  medium: {
    label: "Média",
    className: "border-status-fair/30 bg-status-fair/10 text-status-fair",
  },
  high: {
    label: "Alta",
    className: "border-accent-border bg-accent-soft text-accent",
  },
};

export function PriorityBadge({ priority }: { priority: GoalPriority }) {
  const config = priorityMap[priority];

  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-md border px-2.5 text-xs font-semibold",
        config.className,
      )}
    >
      {config.label}
    </span>
  );
}
