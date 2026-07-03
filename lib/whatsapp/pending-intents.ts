import { getCreditCards } from "@/lib/cards";
import { formatCurrency } from "@/lib/formatters/currency";
import type { WhatsappIntent } from "@/lib/ai/whatsapp-intent";
import { createWhatsappPendingAction } from "@/lib/whatsapp/audit";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatDate(value: string | null) {
  if (!value) return "hoje";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

async function resolveCard(userId: string, cardNameHint: string | null) {
  const cards = await getCreditCards(userId);

  if (cards.length === 0) {
    return { card: null, reason: "Nenhum cartão ativo encontrado no app." };
  }

  if (!cardNameHint) {
    if (cards.length === 1) {
      return { card: cards[0], reason: null };
    }

    return {
      card: null,
      reason: `Qual cartão devo usar? Ativos: ${cards.map((card) => card.name).join(", ")}.`,
    };
  }

  const hint = normalize(cardNameHint);
  const matchedCards = cards.filter((card) => normalize(card.name).includes(hint));

  if (matchedCards.length === 1) {
    return { card: matchedCards[0], reason: null };
  }

  return {
    card: null,
    reason:
      matchedCards.length > 1
        ? `Encontrei mais de um cartão para "${cardNameHint}". Seja mais específico.`
        : `Não encontrei cartão ativo parecido com "${cardNameHint}". Ativos: ${cards.map((card) => card.name).join(", ")}.`,
  };
}

export async function createPendingActionFromIntent({
  intent,
  phone,
  userId,
}: {
  intent: WhatsappIntent;
  phone: string;
  userId: string;
}) {
  if (intent.intent !== "create_card_expense") {
    return null;
  }

  const { card, reason } = await resolveCard(userId, intent.cardNameHint);

  if (!card) {
    return {
      created: false as const,
      response: reason ?? "Não consegui identificar o cartão para esse lançamento.",
    };
  }

  const summary = [
    "Confirmar lançamento?",
    "",
    `Compra no cartão: ${formatCurrency(intent.amountCents)}`,
    `Descrição: ${intent.description}`,
    `Cartão: ${card.name}`,
    `Data: ${formatDate(intent.purchaseDate)}`,
    intent.paymentType === "installment" && intent.installments
      ? `Parcelamento: ${intent.installments}x`
      : null,
    "",
    "Responda sim ou não.",
  ]
    .filter(Boolean)
    .join("\n");

  const pendingAction = await createWhatsappPendingAction({
    userId,
    phone,
    actionType: "create_card_expense",
    summary,
    payload: {
      amountCents: intent.amountCents,
      description: intent.description,
      cardId: card.id,
      cardName: card.name,
      purchaseDate: intent.purchaseDate,
      paymentType: intent.paymentType,
      installments: intent.installments,
      confidence: intent.confidence,
    },
  });

  if (!pendingAction) {
    return {
      created: false as const,
      response: "Não consegui criar a ação pendente agora.",
    };
  }

  return {
    created: true as const,
    response: summary,
  };
}
