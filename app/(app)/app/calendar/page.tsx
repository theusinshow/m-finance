import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { EmptyState } from "@/components/empty-state";
import { CreateCurrentMonthCard } from "@/components/dashboard/create-current-month-card";
import { markBillAsPaid } from "@/app/actions/bills";
import { markInvoiceAsPaid } from "@/app/actions/invoices";
import { PageHeading } from "@/components/page-heading";
import { FormSubmitButton } from "@/components/form-submit-button";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth/guard";
import { getBillsByMonth } from "@/lib/bills";
import { getInvoicesByMonth } from "@/lib/cards";
import { formatCurrency } from "@/lib/formatters/currency";
import { getAppUserBySupabaseId, getCurrentMonthForUser } from "@/lib/months";
import { cn } from "@/lib/utils";

function getDaysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

function getFirstWeekdayOffset(month: number, year: number) {
  const jsDay = new Date(year, month - 1, 1).getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

function getDayFromDate(date: string) {
  return new Date(`${date}T12:00:00`).getDate();
}

export default async function CalendarPage() {
  const user = await requireUser();
  const appUser = await getAppUserBySupabaseId(user.id);
  const currentMonth = appUser ? await getCurrentMonthForUser(appUser.id) : null;
  const bills = currentMonth ? await getBillsByMonth(currentMonth.id) : [];
  const invoices = currentMonth ? await getInvoicesByMonth(currentMonth.id) : [];
  const daysInMonth = currentMonth ? getDaysInMonth(currentMonth.month, currentMonth.year) : 0;
  const firstOffset = currentMonth ? getFirstWeekdayOffset(currentMonth.month, currentMonth.year) : 0;
  const now = new Date();
  const todayDay =
    currentMonth && now.getFullYear() === currentMonth.year && now.getMonth() + 1 === currentMonth.month
      ? now.getDate()
      : -1;
  const events = [
    ...bills.map((bill) => ({
      id: bill.id,
      type: "bill" as const,
      title: bill.name,
      amountCents: bill.amountCents,
      dueDate: bill.dueDate,
      status: bill.status,
      label: bill.categoryName ?? "Conta",
    })),
    ...invoices.map((invoice) => ({
      id: invoice.id,
      type: "invoice" as const,
      title: invoice.name,
      amountCents: invoice.amountCents,
      dueDate: invoice.dueDate,
      status: invoice.status,
      label: invoice.cardType === "business" ? "Fatura PJ" : "Fatura",
    })),
  ].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return (
    <div className="space-y-6">
      <PageHeading eyebrow="Calendário financeiro" title="Vencimentos do mês" />

      {!currentMonth ? <CreateCurrentMonthCard /> : null}

      {currentMonth ? (
        <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
          <DashboardCard>
            <div className="grid grid-cols-7 gap-2">
              {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => (
                <div className="pb-2 text-center text-xs font-semibold text-text-muted" key={day}>
                  {day}
                </div>
              ))}
              {Array.from({ length: firstOffset }, (_, index) => (
                <div key={`empty-${index}`} />
              ))}
              {Array.from({ length: daysInMonth }, (_, index) => {
                const day = index + 1;
                const dayEvents = events.filter((event) => getDayFromDate(event.dueDate) === day);
                const hasOverdue = dayEvents.some((event) => event.status === "overdue");
                const hasPending = dayEvents.some((event) => event.status === "pending");
                const isToday = day === todayDay;

                return (
                  <div
                    className={cn(
                      "min-h-28 rounded-md border border-border-subtle bg-background-elevated p-3 transition duration-200",
                      isToday && "border-accent-border bg-accent-soft",
                    )}
                    key={day}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "text-sm font-semibold text-text-secondary",
                          isToday && "text-accent",
                        )}
                      >
                        {day}
                      </span>
                      {dayEvents.length > 0 ? (
                        <span className="rounded-sm border border-border-subtle px-1.5 py-0.5 text-[10px] font-semibold text-text-muted">
                          {dayEvents.length}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {dayEvents.slice(0, 2).map((event) => (
                        <div
                          className="truncate rounded-sm border border-border-subtle bg-background-card px-2 py-1 text-xs text-text-secondary"
                          key={`${event.type}-${event.id}`}
                          title={event.title}
                        >
                          {event.type === "invoice" ? "Fatura" : "Conta"}: {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 ? (
                        <p className="text-xs text-text-muted">+{dayEvents.length - 2} eventos</p>
                      ) : null}
                    </div>
                    {hasOverdue ? (
                      <span className="mt-3 block h-1 rounded-full bg-accent" />
                    ) : hasPending ? (
                      <span className="mt-3 block h-1 rounded-full bg-status-fair" />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </DashboardCard>

          <DashboardCard title="Eventos do mês">
            <div className="space-y-3">
              {events.length === 0 ? (
                <p className="rounded-lg border border-border-subtle bg-background-elevated p-4 text-sm text-text-muted">
                  Nenhum vencimento cadastrado para este mês.
                </p>
              ) : (
                events.map((event) => (
                  <div
                    className="rounded-lg border border-border-subtle bg-background-elevated p-4"
                    key={`${event.type}-${event.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-text-primary">{event.title}</p>
                        <p className="mt-1 text-sm text-text-muted">
                          {event.label} · dia {getDayFromDate(event.dueDate)}
                        </p>
                      </div>
                      <StatusBadge status={event.status} />
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="num font-semibold text-text-primary">
                        {formatCurrency(event.amountCents)}
                      </p>
                      {event.status !== "paid" ? (
                        <form action={event.type === "bill" ? markBillAsPaid : markInvoiceAsPaid}>
                          <input
                            name={event.type === "bill" ? "billId" : "invoiceId"}
                            type="hidden"
                            value={event.id}
                          />
                          <FormSubmitButton pendingLabel="Marcando..." variant="secondary">
                            Marcar como pago
                          </FormSubmitButton>
                        </form>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </DashboardCard>
        </section>
      ) : (
        <EmptyState
          title="Calendário aguardando mês"
          description="Crie o mês atual para visualizar vencimentos reais de contas e faturas."
        />
      )}
    </div>
  );
}
