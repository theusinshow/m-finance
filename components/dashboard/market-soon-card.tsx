import { Bitcoin, Newspaper } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/dashboard-card";

/**
 * Placeholder for future market/crypto/news modules. Intentionally carries no
 * numbers until real data sources exist, so nothing on screen is fake.
 */
export function MarketSoonCard() {
  const items = [
    { icon: Bitcoin, title: "Criptomoedas", text: "Acompanhe um resumo da sua carteira." },
    { icon: Newspaper, title: "Mercado & notícias", text: "Manchetes do mundo financeiro." },
  ];

  return (
    <DashboardCard description="Módulos planejados para as próximas versões." title="Mercado">
      <div className="space-y-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              className="flex items-center justify-between gap-4 rounded-lg border border-border-subtle bg-background-elevated p-4"
              key={item.title}
            >
              <div className="flex items-center gap-3">
                <span className="clip-notch flex h-10 w-10 items-center justify-center border border-border-subtle bg-background-card text-text-muted">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold text-text-primary">{item.title}</p>
                  <p className="text-sm text-text-muted">{item.text}</p>
                </div>
              </div>
              <span className="rounded-sm border border-border-subtle px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                Em breve
              </span>
            </div>
          );
        })}
      </div>
    </DashboardCard>
  );
}
