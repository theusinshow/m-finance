"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { creditCardExpenses, creditCardInvoices } from "@/db/schema";
import { db } from "@/db/client";
import { requireUser } from "@/lib/auth/guard";
import { getAppUserBySupabaseId } from "@/lib/months";
import { getActiveMonthForUser } from "@/lib/active-month";
import { getCardById } from "@/lib/card-expenses";
import { parseCurrencyToCents } from "@/lib/money";
import { composeMonthDate } from "@/lib/due-date";
import { cardExpenseSchema } from "@/lib/validators/card-expense";
import {
  errorState,
  fieldErrorsFromZod,
  successState,
  type FormState,
} from "@/lib/form-state";

type Tx = Parameters<Parameters<NonNullable<typeof db>["transaction"]>[0]>[0];
type MonthRecord = { id: string; month: number; year: number };

/**
 * Keeps the card's invoice for a month in sync with the sum of its expense
 * items: derives the total when items exist, removes the invoice when none do.
 */
async function syncInvoiceTotal(
  tx: Tx,
  userId: string,
  cardId: string,
  month: MonthRecord,
  dueDay: number,
) {
  const [row] = await tx
    .select({
      total: sql<number>`coalesce(sum(${creditCardExpenses.amountCents}), 0)::int`,
    })
    .from(creditCardExpenses)
    .where(
      and(
        eq(creditCardExpenses.userId, userId),
        eq(creditCardExpenses.cardId, cardId),
        eq(creditCardExpenses.monthId, month.id),
      ),
    );

  const total = Number(row?.total ?? 0);

  if (total > 0) {
    await tx
      .insert(creditCardInvoices)
      .values({
        userId,
        cardId,
        monthId: month.id,
        amountCents: total,
        dueDate: composeMonthDate(month.year, month.month, dueDay),
        status: "pending",
      })
      .onConflictDoUpdate({
        target: [creditCardInvoices.cardId, creditCardInvoices.monthId],
        set: { amountCents: total, updatedAt: new Date() },
      });
  } else {
    await tx
      .delete(creditCardInvoices)
      .where(
        and(
          eq(creditCardInvoices.userId, userId),
          eq(creditCardInvoices.cardId, cardId),
          eq(creditCardInvoices.monthId, month.id),
        ),
      );
  }
}

function revalidateCardSurfaces(cardId: string) {
  revalidatePath(`/app/cards/${cardId}`);
  revalidatePath("/app/cards");
  revalidatePath("/app/dashboard");
  revalidatePath("/app/calendar");
}

export async function addCardExpense(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const appUser = await getAppUserBySupabaseId(user.id);
  const cardId = String(formData.get("cardId") ?? "");

  if (!db || !appUser || !cardId) {
    return errorState("Não foi possível registrar a compra.");
  }

  const month = await getActiveMonthForUser(appUser.id);
  if (!month) {
    return errorState("Crie o mês atual antes de lançar compras.");
  }

  const card = await getCardById(appUser.id, cardId);
  if (!card) {
    return errorState("Cartão não encontrado.");
  }

  const parsed = cardExpenseSchema.safeParse({
    description: formData.get("description"),
    amountCents: parseCurrencyToCents(formData.get("amount")),
    purchaseDate: String(formData.get("purchaseDate") ?? "") || undefined,
  });

  if (!parsed.success) {
    return errorState(
      "Revise os campos destacados.",
      fieldErrorsFromZod(parsed.error, { amountCents: "amount" }),
    );
  }

  const payload = parsed.data;

  await db.transaction(async (tx) => {
    await tx.insert(creditCardExpenses).values({
      userId: appUser.id,
      cardId,
      monthId: month.id,
      description: payload.description,
      amountCents: payload.amountCents,
      purchaseDate: payload.purchaseDate ?? null,
    });
    await syncInvoiceTotal(tx, appUser.id, cardId, month, card.dueDay);
  });

  revalidateCardSurfaces(cardId);
  return successState("Compra lançada.");
}

export async function deleteCardExpense(formData: FormData) {
  const user = await requireUser();
  const appUser = await getAppUserBySupabaseId(user.id);
  const expenseId = String(formData.get("expenseId") ?? "");
  const cardId = String(formData.get("cardId") ?? "");

  if (!db || !appUser || !expenseId || !cardId) {
    throw new Error("Não foi possível excluir a compra.");
  }

  const card = await getCardById(appUser.id, cardId);
  const month = await getActiveMonthForUser(appUser.id);

  await db.transaction(async (tx) => {
    await tx
      .delete(creditCardExpenses)
      .where(
        and(eq(creditCardExpenses.id, expenseId), eq(creditCardExpenses.userId, appUser.id)),
      );
    if (card && month) {
      await syncInvoiceTotal(tx, appUser.id, cardId, month, card.dueDay);
    }
  });

  revalidateCardSurfaces(cardId);
}
