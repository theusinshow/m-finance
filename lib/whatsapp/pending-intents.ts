import { getCreditCards } from "@/lib/cards";
import { formatCurrency } from "@/lib/formatters/currency";
import type { WhatsappIntent } from "@/lib/ai/whatsapp-intent";
import { createWhatsappPendingAction } from "@/lib/whatsapp/audit";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenize(value: string) {
  return normalize(value).split(" ").filter(Boolean);
}

function formatDate(value: string | null) {
  if (!value) return "hoje";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

async function resolveCard(userId: string, cardNameHint: string | null, originalMessage: string) {
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

  const lookupText = normalize([cardNameHint, originalMessage].filter(Boolean).join(" "));
  const lookupTokens = new Set(tokenize(lookupText));
  const hint = normalize(cardNameHint);

  const scoredCards = cards
    .map((card) => {
      const cardName = normalize(card.name);
      const cardTokens = tokenize(card.name);
      let score = 0;

      if (cardName === hint) score += 100;
      if (lookupText.includes(cardName)) score += 80;
      if (hint && cardName.includes(hint)) score += 40;
      if (hint && hint.includes(cardName)) score += 40;

      for (const token of cardTokens) {
        if (lookupTokens.has(token)) score += token.length > 2 ? 10 : 2;
      }

      // Common local shorthand: "PJ" maps to business cards and "pessoal" to
      // personal cards even when the AI only returns the base brand as hint.
      if (lookupTokens.has("pj") && card.cardType === "business") score += 30;
      if (lookupTokens.has("pessoal") && card.cardType === "personal") score += 30;
      if (lookupTokens.has("empresa") && card.cardType === "business") score += 20;
      if (lookupTokens.has("business") && card.cardType === "business") score += 20;

      return { card, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const best = scoredCards[0];
  const second = scoredCards[1];

  if (best && (!second || best.score > second.score)) {
    return { card: best.card, reason: null };
  }

  return {
    card: null,
    reason:
      scoredCards.length > 1
        ? `Encontrei mais de um cartão para "${cardNameHint}". Seja mais específico.`
        : `Não encontrei cartão ativo parecido com "${cardNameHint}". Ativos: ${cards.map((card) => card.name).join(", ")}.`,
  };
}

export async function createPendingActionFromIntent({
  intent,
  message,
  phone,
  userId,
}: {
  intent: WhatsappIntent;
  message: string;
  phone: string;
  userId: string;
}) {
  if (intent.intent !== "create_card_expense") {
    return null;
  }

  const { card, reason } = await resolveCard(userId, intent.cardNameHint, message);

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
