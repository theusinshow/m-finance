import { CheckCircle2 } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { CreateCurrentMonthCard } from "@/components/dashboard/create-current-month-card";
import { EmptyState } from "@/components/empty-state";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import { CompactCalendarCard } from "@/components/dashboard/compact-calendar-card";
import { FinancialSummaryCard } from "@/components/dashboard/financial-summary-card";
import { IncomeFormCard } from "@/components/dashboard/income-form-card";
import { InvoiceSummaryCard } from "@/components/dashboard/invoice-summary-card";
import { MonthGenerationReviewCard } from "@/components/dashboard/month-generation-review-card";
import { QuickActionButton } from "@/components/quick-action-button";
import { StatusBadge } from "@/components/status-badge";
import { UpcomingBillsList } from "@/components/dashboard/upcoming-bills-list";
import { BalanceDisplay } from "@/components/dashboard/balance-display";
import { StatusBreakdownChart } from "@/components/dashboard/status-breakdown-chart";
import { MarketSoonCard } from "@/components/dashboard/market-soon-card";
import { Reveal } from "@/components/ui/reveal";
import { calculateInternalAlerts } from "@/lib/calculations/alerts";
import { getDashboardSummary } from "@/lib/calculations/dashboard";
import { formatCurrency } from "@/lib/formatters/currency";
import { formatMonthLabel } from "@/lib/formatters/date";
import { requireUser } from "@/lib/auth/guard";
import { getAppUserBySupabaseId } from "@/lib/months";
import { getActiveMonthForUser, isViewingCurrentMonth } from "@/lib/active-month";
import { getIncomesByMonth } from "@/lib/incomes";
import { getBillCategories, getBillsByMonth, getRecurringBillsByMonth } from "@/lib/bills";
import { getInvoicesByMonth } from "@/lib/cards";
import { getNextMonthForUser } from "@/lib/months";
import { getSettingsForUser } from "@/lib/settings";

export default async function DashboardPage() {
  const user = await requireUser();
  const appUser = await getAppUserBySupabaseId(user.id);
  const currentMonth = appUser ? await getActiveMonthForUser(appUser.id) : null;
  const viewingCurrent = await isViewingCurrentMonth();
  const nextMonth = appUser ? await getNextMonthForUser(appUser.id) : null;
  const realIncomes = currentMonth ? await getIncomesByMonth(currentMonth.id) : [];
  const realBills = currentMonth ? await getBillsByMonth(currentMonth.id) : [];
  const recurringBills = currentMonth ? await getRecurringBillsByMonth(currentMonth.id) : [];
  const realInvoices = currentMonth ? await getInvoicesByMonth(currentMonth.id) : [];
  const categories = appUser ? await getBillCategories(appUser.id) : [];
  const settings = appUser ? await getSettingsForUser(appUser.id) : null;
  const summary = getDashboardSummary({
    incomes: realIncomes,
    bills: realBills,
    invoices: realInvoices,
  });
  const totalOutstandingCents = summary.totalPendingCents + summary.totalOverdueCents;
  const totalCommittedCents = summary.totalBillsCents + summary.totalInvoicesCents;
  const allSettled = totalCommittedCents > 0 && totalOutstandingCents === 0;
  const alerts = calculateInternalAlerts([
    ...realBills.map((bill) => ({
      id: bill.id,
      type: "bill" as const,
      title: bill.name,
      amountCents: bill.amountCents,
      dueDate: bill.dueDate,
      status: bill.status,
    })),
    ...realInvoices.map((invoice) => ({
      id: invoice.id,
      type: "invoice" as const,
      title: invoice.name,
      amountCents: invoice.amountCents,
      dueDate: invoice.dueDate,
      status: invoice.status,
    })),
  ], { daysBefore: settings?.alertDaysBefore ?? 3 });

  return (
    <div className="space-y-6">
      {!currentMonth && viewingCurrent ? <CreateCurrentMonthCard /> : null}

      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <DashboardCard accent className="min-h-64">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-4 flex items-center gap-3">
                <StatusBadge status={summary.monthHealth} />
                <span className="text-sm text-text-muted">
                  {currentMonth
                    ? formatMonthLabel(new Date(currentMonth.year, currentMonth.month - 1, 1))
                    : formatMonthLabel()}
                </span>
              </div>
              <BalanceDisplay cents={totalOutstandingCents} label="Falta pagar neste mês" />

              {allSettled ? (
                <p className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-status-positive">
                  <CheckCircle2 size={16} aria-hidden="true" />
                  Tudo pago neste mês. Nada vencendo por aqui.
                </p>
              ) : (
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
                  {summary.totalOverdueCents > 0 ? (
                    <span className="num font-semibold text-accent">
                      {formatCurrency(summary.totalOverdueCents)} vencido
                    </span>
                  ) : null}
                  <span className="num text-text-secondary">
                    {formatCurrency(summary.totalPendingCents)} a vencer
                  </span>
                  <span className="num text-text-muted">
                    {formatCurrency(summary.totalPaidCents)} pago de{" "}
                    {formatCurrency(totalCommittedCents)}
                  </span>
                </div>
              )}

              <p className="mt-4 max-w-xl text-sm leading-6 text-text-muted">
                Sobra estimada de {formatCurrency(summary.estimatedRemainingCents)} depois de tudo
                pago (receita menos despesas e faturas do mês).
              </p>
            </div>
            <div className="flex flex-col gap-3 lg:w-72">
              <QuickActionButton href="/app/bills" label="Adicionar despesa" />
              <QuickActionButton
                href="/app/cards"
                label="Adicionar fatura do cartão"
                variant="secondary"
              />
              <QuickActionButton href="/app/calendar" label="Ver calendário" variant="secondary" />
            </div>
          </div>
        </DashboardCard>

        <AlertsPanel alerts={alerts} />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Reveal delay={0}>
          <FinancialSummaryCard
            label="Receita prevista"
            value={formatCurrency(summary.totalIncomeCents)}
            description="Principal + extras"
          />
        </Reveal>
        <Reveal delay={70}>
          <FinancialSummaryCard
            label="Total comprometido"
            value={formatCurrency(summary.totalBillsCents + summary.totalInvoicesCents)}
            description="Despesas + faturas"
          />
        </Reveal>
        <Reveal delay={140}>
          <FinancialSummaryCard
            label="Total pendente"
            value={formatCurrency(summary.totalPendingCents)}
            description="Ainda aberto no mês"
          />
        </Reveal>
        <Reveal delay={210}>
          <FinancialSummaryCard
            label="Total vencido"
            value={formatCurrency(summary.totalOverdueCents)}
            description="Prioridade imediata"
            tone="danger"
          />
        </Reveal>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <DashboardCard
          description="Como o comprometimento do mês está dividido."
          title="Distribuição do mês"
        >
          <StatusBreakdownChart
            overdueCents={summary.totalOverdueCents}
            paidCents={summary.totalPaidCents}
            pendingCents={summary.totalPendingCents}
          />
        </DashboardCard>
        <MarketSoonCard />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <UpcomingBillsList bills={realBills} />
        <InvoiceSummaryCard invoices={realInvoices} />
      </section>

      {currentMonth ? <IncomeFormCard incomes={realIncomes} /> : null}

      {currentMonth && viewingCurrent && !nextMonth ? (
        <MonthGenerationReviewCard categories={categories} recurringBills={recurringBills} />
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <CompactCalendarCard
          events={[
            ...realBills.map((bill) => ({
              id: bill.id,
              type: "bill" as const,
              dueDate: bill.dueDate,
              status: bill.status,
            })),
            ...realInvoices.map((invoice) => ({
              id: invoice.id,
              type: "invoice" as const,
              dueDate: invoice.dueDate,
              status: invoice.status,
            })),
          ]}
        />
        <EmptyState
          title="Histórico pronto para uso"
          description="Quando quiser preservar o estado do mês, salve um snapshot em Histórico."
          actionLabel="Abrir histórico"
          actionHref="/app/history"
        />
      </section>
    </div>
  );
}
