import { TriangleMark } from "@/components/brand/triangle-mark";
import { cn } from "@/lib/utils";

type Status = "positive" | "fair" | "tight" | "negative" | "pending" | "paid" | "overdue";

const statusMap: Record<Status, { label: string; className: string }> = {
  positive: {
    label: "Positivo",
    className: "border-status-positive/30 bg-status-positive/10 text-status-positive",
  },
  fair: {
    label: "Justo",
    className: "border-status-fair/30 bg-status-fair/10 text-status-fair",
  },
  tight: {
    label: "Apertado",
    className: "border-status-tight/30 bg-status-tight/10 text-status-tight",
  },
  negative: {
    label: "Negativo",
    className: "border-accent-border bg-accent-soft text-accent",
  },
  pending: {
    label: "Pendente",
    className: "border-border-default bg-background-elevated text-text-secondary",
  },
  paid: {
    label: "Pago",
    className: "border-status-positive/30 bg-status-positive/10 text-status-positive",
  },
  overdue: {
    label: "Vencido",
    className: "border-accent-border bg-accent-soft text-accent",
  },
};

export function StatusBadge({ status }: { status: Status }) {
  const config = statusMap[status];

  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold",
        config.className,
      )}
    >
      <TriangleMark className="text-current" size={9} variant="solid" />
      {config.label}
    </span>
  );
}
