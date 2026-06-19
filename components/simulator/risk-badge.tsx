import { TriangleMark } from "@/components/brand/triangle-mark";
import type { RiskLevel } from "@/db/schema";
import { cn } from "@/lib/utils";

const riskMap: Record<RiskLevel, { label: string; className: string }> = {
  safe: {
    label: "Seguro",
    className: "border-status-positive/30 bg-status-positive/10 text-status-positive",
  },
  controlled: {
    label: "Controlado",
    className: "border-status-fair/30 bg-status-fair/10 text-status-fair",
  },
  tight: {
    label: "Apertado",
    className: "border-status-tight/30 bg-status-tight/10 text-status-tight",
  },
  critical: {
    label: "Crítico",
    className: "border-accent-border bg-accent-soft text-accent",
  },
};

export function RiskBadge({ risk, size = "sm" }: { risk: RiskLevel; size?: "sm" | "lg" }) {
  const config = riskMap[risk];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border font-semibold",
        size === "lg" ? "h-9 px-3.5 text-sm" : "h-7 px-2.5 text-xs",
        config.className,
      )}
    >
      <TriangleMark className="text-current" size={size === "lg" ? 11 : 9} variant="solid" />
      {config.label}
    </span>
  );
}
