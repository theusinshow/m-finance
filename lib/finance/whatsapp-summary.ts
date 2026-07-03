import { getBillsByMonth } from "@/lib/bills";
import { getInvoicesByMonth } from "@/lib/cards";
import { getDashboardSummary } from "@/lib/calculations/dashboard";
import { formatCurrency } from "@/lib/formatters/currency";
import { getIncomesByMonth } from "@/lib/incomes";
import { getCurrentMonthForUser } from "@/lib/months";

function formatDate(value: string) {
  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function formatMonthName(month: number, year: number) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(year, month - 1, 1));
}

export async function getWhatsappMonthlySummary(userId: string) {
  const month = await getCurrentMonthForUser(userId);

  if (!month) {
    return "Ainda não existe mês atual criado no M Finance. Crie o mês atual pelo app antes de consultar pelo WhatsApp.";
  }

  const [incomes, bills, invoices] = await Promise.all([
    getIncomesByMonth(month.id),
    getBillsByMonth(month.id),
    getInvoicesByMonth(month.id),
  ]);

  const summary = getDashboardSummary({ incomes, bills, invoices });
  const label = formatMonthName(month.month, month.year);

  return [
    `Resumo de ${label}`,
    "",
    `Receitas: ${formatCurrency(summary.totalIncomeCents)}`,
    `Contas: ${formatCurrency(summary.totalBillsCents)}`,
    `Faturas: ${formatCurrency(summary.totalInvoicesCents)}`,
    `Pago: ${formatCurrency(summary.totalPaidCents)}`,
    `Pendente: ${formatCurrency(summary.totalPendingCents)}`,
    `Vencido: ${formatCurrency(summary.totalOverdueCents)}`,
    `Saldo estimado: ${formatCurrency(summary.estimatedRemainingCents)}`,
  ].join("\n");
}

export async function getWhatsappDueItems(userId: string) {
  const month = await getCurrentMonthForUser(userId);

  if (!month) {
    return "Ainda não existe mês atual criado no M Finance.";
  }

  const [bills, invoices] = await Promise.all([
    getBillsByMonth(month.id),
    getInvoicesByMonth(month.id),
  ]);

  const items = [
    ...bills.map((bill) => ({
      type: "Conta",
      name: bill.name,
      amountCents: bill.amountCents,
      dueDate: bill.dueDate,
      status: bill.status,
    })),
    ...invoices.map((invoice) => ({
      type: "Fatura",
      name: invoice.name,
      amountCents: invoice.amountCents,
      dueDate: invoice.dueDate,
      status: invoice.status,
    })),
  ]
    .filter((item) => item.status !== "paid")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 8);

  if (items.length === 0) {
    return "Nenhum vencimento pendente no mês atual.";
  }

  return [
    "Próximos vencimentos:",
    "",
    ...items.map(
      (item) =>
        `• ${item.type}: ${item.name} — ${formatCurrency(item.amountCents)} — ${formatDate(item.dueDate)} (${item.status === "overdue" ? "vencido" : "pendente"})`,
    ),
  ].join("\n");
}
