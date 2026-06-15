"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/formatters/currency";

type Slice = { name: string; value: number; color: string };

/**
 * Donut of paid / pending / overdue for the month, built from the values the
 * dashboard already computes. No external data, no API.
 */
export function StatusBreakdownChart({
  paidCents,
  pendingCents,
  overdueCents,
}: {
  paidCents: number;
  pendingCents: number;
  overdueCents: number;
}) {
  const slices: Slice[] = [
    { name: "Pago", value: paidCents, color: "#54D18A" },
    { name: "Pendente", value: pendingCents, color: "#8A8780" },
    { name: "Vencido", value: overdueCents, color: "#FB3640" },
  ];
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const data = slices.filter((slice) => slice.value > 0);

  if (total === 0) {
    return (
      <div className="rounded-lg border border-border-subtle bg-background-elevated p-4 text-sm text-text-muted">
        Sem despesas ou faturas neste mês para distribuir.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-6">
      <div className="relative h-40 w-40 shrink-0">
        <ResponsiveContainer height="100%" width="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={52}
              outerRadius={72}
              paddingAngle={data.length > 1 ? 2 : 0}
              stroke="none"
            >
              {data.map((slice) => (
                <Cell fill={slice.color} key={slice.name} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
            Total
          </span>
          <span className="num text-sm font-semibold text-text-primary">
            {formatCurrency(total)}
          </span>
        </div>
      </div>

      <ul className="w-full space-y-2.5">
        {slices.map((slice) => {
          const pct = total > 0 ? Math.round((slice.value / total) * 100) : 0;
          return (
            <li className="flex items-center justify-between gap-3" key={slice.name}>
              <span className="flex items-center gap-2 text-sm text-text-secondary">
                <span
                  aria-hidden="true"
                  className="tri-mark h-2.5 w-2.5"
                  style={{ backgroundColor: slice.color }}
                />
                {slice.name}
                <span className="text-text-muted">{pct}%</span>
              </span>
              <span className="num text-sm font-semibold text-text-primary">
                {formatCurrency(slice.value)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
