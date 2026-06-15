"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { billCategories, settings } from "@/db/schema";
import { db } from "@/db/client";
import { requireUser } from "@/lib/auth/guard";
import { getAppUserBySupabaseId } from "@/lib/months";
import { categorySchema, settingsSchema } from "@/lib/validators/settings";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function updateSettings(formData: FormData) {
  const user = await requireUser();
  const appUser = await getAppUserBySupabaseId(user.id);

  if (!db || !appUser) {
    throw new Error("Banco ou usuário interno não configurado.");
  }

  const payload = settingsSchema.parse({
    alertDaysBefore: formData.get("alertDaysBefore"),
  });

  await db
    .insert(settings)
    .values({ userId: appUser.id, alertDaysBefore: payload.alertDaysBefore })
    .onConflictDoUpdate({
      target: settings.userId,
      set: { alertDaysBefore: payload.alertDaysBefore, updatedAt: new Date() },
    });

  revalidatePath("/app/settings");
  revalidatePath("/app/dashboard");
}

export async function createCategory(formData: FormData) {
  const user = await requireUser();
  const appUser = await getAppUserBySupabaseId(user.id);

  if (!db || !appUser) {
    throw new Error("Banco ou usuário interno não configurado.");
  }

  const payload = categorySchema.parse({ name: formData.get("name") });
  const slug = slugify(payload.name);

  if (!slug) {
    throw new Error("Informe um nome de categoria válido.");
  }

  await db
    .insert(billCategories)
    .values({ userId: appUser.id, name: payload.name, slug })
    .onConflictDoUpdate({
      target: [billCategories.userId, billCategories.slug],
      set: { name: payload.name, isArchived: false, updatedAt: new Date() },
    });

  revalidatePath("/app/settings");
  revalidatePath("/app/bills");
}

export async function setCategoryArchived(formData: FormData) {
  const user = await requireUser();
  const appUser = await getAppUserBySupabaseId(user.id);
  const categoryId = String(formData.get("categoryId") ?? "");
  const isArchived = formData.get("isArchived") === "true";

  if (!db || !appUser || !categoryId) {
    throw new Error("Não foi possível atualizar a categoria.");
  }

  await db
    .update(billCategories)
    .set({ isArchived, updatedAt: new Date() })
    .where(and(eq(billCategories.id, categoryId), eq(billCategories.userId, appUser.id)));

  revalidatePath("/app/settings");
  revalidatePath("/app/bills");
}
