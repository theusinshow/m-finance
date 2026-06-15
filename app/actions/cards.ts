"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { creditCards } from "@/db/schema";
import { db } from "@/db/client";
import { requireUser } from "@/lib/auth/guard";
import { getAppUserBySupabaseId } from "@/lib/months";
import { cardSchema } from "@/lib/validators/card";

function revalidateCardSurfaces() {
  revalidatePath("/app/cards");
  revalidatePath("/app/settings");
  revalidatePath("/app/dashboard");
}

export async function createCard(formData: FormData) {
  const user = await requireUser();
  const appUser = await getAppUserBySupabaseId(user.id);

  if (!db || !appUser) {
    throw new Error("Banco ou usuário interno não configurado.");
  }

  const payload = cardSchema.parse({
    name: formData.get("name"),
    cardType: formData.get("cardType"),
    dueDay: formData.get("dueDay"),
  });

  await db.insert(creditCards).values({
    userId: appUser.id,
    name: payload.name,
    cardType: payload.cardType,
    dueDay: payload.dueDay,
  });

  revalidateCardSurfaces();
}

export async function updateCard(formData: FormData) {
  const user = await requireUser();
  const appUser = await getAppUserBySupabaseId(user.id);
  const cardId = String(formData.get("cardId") ?? "");

  if (!db || !appUser || !cardId) {
    throw new Error("Não foi possível editar o cartão.");
  }

  const payload = cardSchema.parse({
    name: formData.get("name"),
    cardType: formData.get("cardType"),
    dueDay: formData.get("dueDay"),
  });

  await db
    .update(creditCards)
    .set({
      name: payload.name,
      cardType: payload.cardType,
      dueDay: payload.dueDay,
      updatedAt: new Date(),
    })
    .where(and(eq(creditCards.id, cardId), eq(creditCards.userId, appUser.id)));

  revalidateCardSurfaces();
}

export async function setCardActive(formData: FormData) {
  const user = await requireUser();
  const appUser = await getAppUserBySupabaseId(user.id);
  const cardId = String(formData.get("cardId") ?? "");
  const isActive = formData.get("isActive") === "true";

  if (!db || !appUser || !cardId) {
    throw new Error("Não foi possível atualizar o cartão.");
  }

  await db
    .update(creditCards)
    .set({ isActive, updatedAt: new Date() })
    .where(and(eq(creditCards.id, cardId), eq(creditCards.userId, appUser.id)));

  revalidateCardSurfaces();
}
