"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { incomes } from "@/db/schema";
import { requireUser } from "@/lib/auth/guard";
import { db } from "@/db/client";
import { incomeSchema } from "@/lib/validators/income";
import { getAppUserBySupabaseId, getCurrentMonthForUser } from "@/lib/months";
import { parseCurrencyToCents } from "@/lib/money";

export async function createIncome(formData: FormData) {
  const user = await requireUser();
  const appUser = await getAppUserBySupabaseId(user.id);

  if (!db || !appUser) {
    throw new Error("Banco ou usuário interno não configurado.");
  }

  const currentMonth = await getCurrentMonthForUser(appUser.id);

  if (!currentMonth) {
    throw new Error("Crie o mês atual antes de cadastrar receita.");
  }

  const payload = incomeSchema.parse({
    name: formData.get("name"),
    amountCents: parseCurrencyToCents(formData.get("amount")),
    incomeType: formData.get("incomeType"),
    expectedDate: String(formData.get("expectedDate") ?? "") || undefined,
    received: formData.get("received") === "on",
  });

  await db.insert(incomes).values({
    userId: appUser.id,
    monthId: currentMonth.id,
    name: payload.name,
    amountCents: payload.amountCents,
    incomeType: payload.incomeType,
    expectedDate: payload.expectedDate ?? null,
    received: payload.received,
  });

  revalidatePath("/app/dashboard");
}

export async function updateIncome(formData: FormData) {
  const user = await requireUser();
  const appUser = await getAppUserBySupabaseId(user.id);
  const incomeId = String(formData.get("incomeId") ?? "");

  if (!db || !appUser || !incomeId) {
    throw new Error("Não foi possível editar a receita.");
  }

  const payload = incomeSchema.parse({
    name: formData.get("name"),
    amountCents: parseCurrencyToCents(formData.get("amount")),
    incomeType: formData.get("incomeType"),
    expectedDate: String(formData.get("expectedDate") ?? "") || undefined,
    received: formData.get("received") === "on",
  });

  await db
    .update(incomes)
    .set({
      name: payload.name,
      amountCents: payload.amountCents,
      incomeType: payload.incomeType,
      expectedDate: payload.expectedDate ?? null,
      received: payload.received,
      updatedAt: new Date(),
    })
    .where(and(eq(incomes.id, incomeId), eq(incomes.userId, appUser.id)));

  revalidatePath("/app/dashboard");
}

export async function deleteIncome(formData: FormData) {
  const user = await requireUser();
  const appUser = await getAppUserBySupabaseId(user.id);
  const incomeId = String(formData.get("incomeId") ?? "");

  if (!db || !appUser || !incomeId) {
    throw new Error("Não foi possível excluir a receita.");
  }

  await db.delete(incomes).where(and(eq(incomes.id, incomeId), eq(incomes.userId, appUser.id)));

  revalidatePath("/app/dashboard");
}
