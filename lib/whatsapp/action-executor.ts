import { z } from "zod";
import { db } from "@/db/client";
import { bills, creditCardExpenses, recurrenceRules } from "@/db/schema";
import { getCardById } from "@/lib/card-expenses";
import { composeMonthDate } from "@/lib/due-date";
import { formatCurrency } from "@/lib/formatters/currency";
import { syncInvoiceTotal } from "@/lib/invoice-sync";
import { ensureConsecutiveMonthsForUser, getCurrentMonthForUser } from "@/lib/months";
import { updateWhatsappPendingActionStatus } from "@/lib/whatsapp/audit";

// Quantos meses à frente uma recorrência criada pelo WhatsApp já materializa
// na primeira confirmação. Espelha a ideia de "series" do app e mantém o usuário
// com as próximas contas já visíveis sem depender de um job mensal.
const RECURRING_PREGENERATE_MONTHS = 12;

const cardExpensePayloadSchema = z.object({
  amountCents: z.number().int().positive(),
  description: z.string().trim().min(1),
  cardId: z.string().uuid(),
  cardName: z.string().trim().min(1),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  paymentType: z.enum(["cash", "installment"]),
  installments: z.number().int().min(2).max(60).nullable(),
});

const billPayloadSchema = z.object({
  amountCents: z.number().int().positive(),
  description: z.string().trim().min(1),
  dueDay: z.number().int().min(1).max(31).nullable(),
  isRecurring: z.boolean(),
});

type PendingAction = {
  id: string;
  userId: string;
  actionType: string;
  payload: unknown;
};

export async function executeWhatsappPendingAction(action: PendingAction) {
  if (action.actionType === "create_bill") {
    return executeCreateBill(action);
  }

  if (action.actionType !== "create_card_expense") {
    return "Essa ação ainda não tem execução implementada.";
  }

  if (!db) {
    return "Banco de dados indisponível no momento.";
  }

  const parsed = cardExpensePayloadSchema.safeParse(action.payload);
  if (!parsed.success) {
    return "A ação pendente está inválida. Cancele e envie o lançamento novamente.";
  }

  const payload = parsed.data;
  const [card, month] = await Promise.all([
    getCardById(action.userId, payload.cardId),
    getCurrentMonthForUser(action.userId),
  ]);

  if (!card) return "Cartão não encontrado. Cancele e envie o lançamento novamente.";
  if (!month) return "Crie o mês atual no app antes de lançar compras pelo WhatsApp.";

  const installmentTotal =
    payload.paymentType === "installment" ? (payload.installments ?? 1) : 1;
  const targetMonths =
    installmentTotal > 1
      ? await ensureConsecutiveMonthsForUser(action.userId, month.month, month.year, installmentTotal)
      : [month];
  const baseAmount = Math.floor(payload.amountCents / installmentTotal);
  const remainder = payload.amountCents - baseAmount * installmentTotal;
  const installmentId = installmentTotal > 1 ? crypto.randomUUID() : null;

  await db.transaction(async (tx) => {
    await tx.insert(creditCardExpenses).values(
      targetMonths.map((targetMonth, index) => ({
        userId: action.userId,
        cardId: payload.cardId,
        monthId: targetMonth.id,
        description: payload.description,
        amountCents: baseAmount + (index < remainder ? 1 : 0),
        purchaseDate: payload.purchaseDate,
        installmentId,
        installmentNumber: installmentId ? index + 1 : null,
        installmentTotal: installmentId ? installmentTotal : null,
      })),
    );

    for (const targetMonth of targetMonths) {
      await syncInvoiceTotal(tx, action.userId, payload.cardId, targetMonth, card.dueDay);
    }
  });

  await updateWhatsappPendingActionStatus(action.id, "confirmed");

  return [
    "Compra lançada.",
    `Cartão: ${card.name}`,
    `Valor: ${formatCurrency(payload.amountCents)}`,
    `Descrição: ${payload.description}`,
    installmentTotal > 1 ? `Parcelas: ${installmentTotal}x` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

async function executeCreateBill(action: PendingAction) {
  if (!db) {
    return "Banco de dados indisponível no momento.";
  }

  const parsed = billPayloadSchema.safeParse(action.payload);
  if (!parsed.success) {
    return "A ação pendente está inválida. Cancele e envie o lançamento novamente.";
  }

  const payload = parsed.data;
  const month = await getCurrentMonthForUser(action.userId);

  if (!month) {
    return "Crie o mês atual no app antes de lançar despesas avulsas pelo WhatsApp.";
  }

  // Sem dia de vencimento, a conta cai no fim do mês para não nascer vencida.
  const dueDay = payload.dueDay ?? 31;

  // Recorrência real: cria a regra em recurrence_rules e materializa os
  // próximos meses como contas vinculadas. Exige dueDay porque a regra precisa
  // de um dia fixo; sem ele, mantemos o comportamento antigo (flag only).
  if (payload.isRecurring && payload.dueDay) {
    const [rule] = await db
      .insert(recurrenceRules)
      .values({
        userId: action.userId,
        name: payload.description,
        defaultAmountCents: payload.amountCents,
        dueDay: payload.dueDay,
        isVariableAmount: false,
        isActive: true,
      })
      .returning();

    if (!rule) {
      return "Não consegui criar a regra de recorrência agora.";
    }

    const targetMonths = await ensureConsecutiveMonthsForUser(
      action.userId,
      month.month,
      month.year,
      RECURRING_PREGENERATE_MONTHS,
    );

    const recurringDueDay = payload.dueDay;
    await db.insert(bills).values(
      targetMonths.map((targetMonth) => ({
        userId: action.userId,
        monthId: targetMonth.id,
        recurrenceRuleId: rule.id,
        name: payload.description,
        amountCents: payload.amountCents,
        dueDate: composeMonthDate(targetMonth.year, targetMonth.month, recurringDueDay),
        isRecurring: true,
        status: "pending" as const,
      })),
    );

    await updateWhatsappPendingActionStatus(action.id, "confirmed");

    return [
      "Despesa recorrente lançada.",
      `Valor: ${formatCurrency(payload.amountCents)}`,
      `Descrição: ${payload.description}`,
      `Vencimento: dia ${payload.dueDay}`,
      `Próximos ${RECURRING_PREGENERATE_MONTHS} meses criados.`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  const dueDate = composeMonthDate(month.year, month.month, dueDay);

  await db.insert(bills).values({
    userId: action.userId,
    monthId: month.id,
    name: payload.description,
    amountCents: payload.amountCents,
    dueDate,
    isRecurring: payload.isRecurring,
    status: "pending",
  });

  await updateWhatsappPendingActionStatus(action.id, "confirmed");

  return [
    "Despesa lançada.",
    `Valor: ${formatCurrency(payload.amountCents)}`,
    `Descrição: ${payload.description}`,
    `Vencimento: ${dueDate.split("-").reverse().join("/")}`,
    payload.isRecurring ? "Recorrente: sim (apenas este mês)" : null,
  ]
    .filter(Boolean)
    .join("\n");
}
