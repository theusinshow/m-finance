"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { monthlySnapshots } from "@/db/schema";
import { db } from "@/db/client";
import { requireUser } from "@/lib/auth/guard";
import { getDashboardSummary } from "@/lib/calculations/dashboard";
import { getBillsByMonth } from "@/lib/bills";
import { getInvoicesByMonth } from "@/lib/cards";
import { getIncomesByMonth } from "@/lib/incomes";
import { getAppUserBySupabaseId, getCurrentMonthForUser } from "@/lib/months";

export async function saveCurrentMonthSnapshot() {
  const user = await requireUser();
  const appUser = await getAppUserBySupabaseId(user.id);

  if (!db || !appUser) {
    throw new Error("Banco ou usuário interno não configurado.");
  }

  const currentMonth = await getCurrentMonthForUser(appUser.id);

  if (!currentMonth) {
    throw new Error("Crie o mês atual antes de salvar histórico.");
  }

  const incomes = await getIncomesByMonth(currentMonth.id);
  const bills = await getBillsByMonth(currentMonth.id);
  const invoices = await getInvoicesByMonth(currentMonth.id);
  const summary = getDashboardSummary({ incomes, bills, invoices });

  const existing = await db
    .select({ id: monthlySnapshots.id })
    .from(monthlySnapshots)
    .where(and(eq(monthlySnapshots.userId, appUser.id), eq(monthlySnapshots.monthId, currentMonth.id)))
    .limit(1);

  const values = {
    userId: appUser.id,
    monthId: currentMonth.id,
    totalIncomeCents: summary.totalIncomeCents,
    totalBillsCents: summary.totalBillsCents,
    totalInvoicesCents: summary.totalInvoicesCents,
    totalPaidCents: summary.totalPaidCents,
    totalPendingCents: summary.totalPendingCents,
    totalOverdueCents: summary.totalOverdueCents,
    estimatedRemainingCents: summary.estimatedRemainingCents,
    monthHealth: summary.monthHealth,
    updatedAt: new Date(),
  };

  if (existing[0]) {
    await db.update(monthlySnapshots).set(values).where(eq(monthlySnapshots.id, existing[0].id));
  } else {
    await db.insert(monthlySnapshots).values(values);
  }

  revalidatePath("/app/history");
  revalidatePath("/app/dashboard");
}
