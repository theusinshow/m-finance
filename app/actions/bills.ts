"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { bills, months } from "@/db/schema";
import { requireUser } from "@/lib/auth/guard";
import { db } from "@/db/client";
import { billSchema } from "@/lib/validators/bill";
import { parseCurrencyToCents } from "@/lib/money";
import { composeMonthDate, parseDueDay } from "@/lib/due-date";
import { getAppUserBySupabaseId, getCurrentMonthForUser } from "@/lib/months";

export async function createBill(formData: FormData) {
  const user = await requireUser();
  const appUser = await getAppUserBySupabaseId(user.id);

  if (!db || !appUser) {
    throw new Error("Banco ou usuário interno não configurado.");
  }

  const currentMonth = await getCurrentMonthForUser(appUser.id);

  if (!currentMonth) {
    throw new Error("Crie o mês atual antes de cadastrar conta.");
  }

  const categoryId = String(formData.get("categoryId") ?? "");
  const payload = billSchema.parse({
    name: formData.get("name"),
    amountCents: parseCurrencyToCents(formData.get("amount")),
    categoryId: categoryId || undefined,
    dueDay: parseDueDay(formData.get("dueDay")),
    isRecurring: formData.get("isRecurring") === "on",
    notes: formData.get("notes") || undefined,
  });

  // No day informed defaults to the end of the month, so the bill never looks
  // overdue just because the user skipped the date.
  const dueDate = composeMonthDate(currentMonth.year, currentMonth.month, payload.dueDay ?? 31);

  await db.insert(bills).values({
    userId: appUser.id,
    monthId: currentMonth.id,
    categoryId: payload.categoryId ?? null,
    name: payload.name,
    amountCents: payload.amountCents,
    dueDate,
    isRecurring: payload.isRecurring,
    status: "pending",
    notes: payload.notes ?? null,
  });

  revalidatePath("/app/dashboard");
  revalidatePath("/app/bills");
  revalidatePath("/app/calendar");
}

export async function markBillAsPaid(formData: FormData) {
  const user = await requireUser();
  const appUser = await getAppUserBySupabaseId(user.id);
  const billId = String(formData.get("billId") ?? "");

  if (!db || !appUser || !billId) {
    throw new Error("Não foi possível marcar a conta como paga.");
  }

  await db
    .update(bills)
    .set({
      status: "paid",
      paidAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(bills.id, billId), eq(bills.userId, appUser.id)));

  revalidatePath("/app/dashboard");
  revalidatePath("/app/bills");
  revalidatePath("/app/calendar");
}

export async function markBillAsPending(formData: FormData) {
  const user = await requireUser();
  const appUser = await getAppUserBySupabaseId(user.id);
  const billId = String(formData.get("billId") ?? "");

  if (!db || !appUser || !billId) {
    throw new Error("Não foi possível reabrir a conta.");
  }

  await db
    .update(bills)
    .set({
      status: "pending",
      paidAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(bills.id, billId), eq(bills.userId, appUser.id)));

  revalidatePath("/app/dashboard");
  revalidatePath("/app/bills");
  revalidatePath("/app/calendar");
}

export async function updateBill(formData: FormData) {
  const user = await requireUser();
  const appUser = await getAppUserBySupabaseId(user.id);
  const billId = String(formData.get("billId") ?? "");

  if (!db || !appUser || !billId) {
    throw new Error("Não foi possível editar a conta.");
  }

  const categoryId = String(formData.get("categoryId") ?? "");
  const payload = billSchema.parse({
    name: formData.get("name"),
    amountCents: parseCurrencyToCents(formData.get("amount")),
    categoryId: categoryId || undefined,
    dueDay: parseDueDay(formData.get("dueDay")),
    isRecurring: formData.get("isRecurring") === "on",
    notes: formData.get("notes") || undefined,
  });

  // Recompose the due date only when a day is provided; otherwise keep the
  // existing one. The day lives inside the bill's own month.
  const [billMonth] = await db
    .select({ month: months.month, year: months.year })
    .from(bills)
    .innerJoin(months, eq(bills.monthId, months.id))
    .where(and(eq(bills.id, billId), eq(bills.userId, appUser.id)))
    .limit(1);

  await db
    .update(bills)
    .set({
      categoryId: payload.categoryId ?? null,
      name: payload.name,
      amountCents: payload.amountCents,
      isRecurring: payload.isRecurring,
      notes: payload.notes ?? null,
      ...(payload.dueDay && billMonth
        ? { dueDate: composeMonthDate(billMonth.year, billMonth.month, payload.dueDay) }
        : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(bills.id, billId), eq(bills.userId, appUser.id)));

  revalidatePath("/app/dashboard");
  revalidatePath("/app/bills");
  revalidatePath("/app/calendar");
}

export async function deleteBill(formData: FormData) {
  const user = await requireUser();
  const appUser = await getAppUserBySupabaseId(user.id);
  const billId = String(formData.get("billId") ?? "");

  if (!db || !appUser || !billId) {
    throw new Error("Não foi possível excluir a conta.");
  }

  await db.delete(bills).where(and(eq(bills.id, billId), eq(bills.userId, appUser.id)));

  revalidatePath("/app/dashboard");
  revalidatePath("/app/bills");
  revalidatePath("/app/calendar");
}
