import { z } from "zod";
import { db } from "@/db/client";
import { creditCardExpenses } from "@/db/schema";
import { getCardById } from "@/lib/card-expenses";
import { formatCurrency } from "@/lib/formatters/currency";
import { syncInvoiceTotal } from "@/lib/invoice-sync";
import { ensureConsecutiveMonthsForUser, getCurrentMonthForUser } from "@/lib/months";
import { updateWhatsappPendingActionStatus } from "@/lib/whatsapp/audit";

const cardExpensePayloadSchema = z.object({
  amountCents: z.number().int().positive(),
  description: z.string().trim().min(1),
  cardId: z.string().uuid(),
  cardName: z.string().trim().min(1),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  paymentType: z.enum(["cash", "installment"]),
  installments: z.number().int().min(2).max(60).nullable(),
});

type PendingAction = {
  id: string;
  userId: string;
  actionType: "create_card_expense" | "create_bill";
  payload: unknown;
};

export async function executeWhatsappPendingAction(action: PendingAction) {
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
