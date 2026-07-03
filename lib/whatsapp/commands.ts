import { classifyWhatsappIntent } from "@/lib/ai/whatsapp-intent";
import { getCreditCards } from "@/lib/cards";
import {
  getWhatsappDueItems,
  getWhatsappMonthlySummary,
} from "@/lib/finance/whatsapp-summary";
import {
  getActiveWhatsappPendingAction,
  updateWhatsappPendingActionStatus,
} from "@/lib/whatsapp/audit";
import { executeWhatsappPendingAction } from "@/lib/whatsapp/action-executor";
import { tryHeuristicBill, tryHeuristicCardExpense } from "@/lib/whatsapp/heuristics";
import {
  createPendingActionFromIntent,
  resolvePendingCardExpense,
} from "@/lib/whatsapp/pending-intents";
import { WHATSAPP_HELP_MESSAGE } from "@/lib/whatsapp/responses";

const CONFIRMABLE_ACTIONS = new Set(["create_card_expense", "create_bill"]);

export async function handleWhatsappCommand({
  message,
  phone,
  userId,
}: {
  message: string;
  phone: string;
  userId: string;
}) {
  const normalized = message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  if (["sim", "s", "confirmar", "confirma"].includes(normalized)) {
    const pendingAction = await getActiveWhatsappPendingAction(userId, phone);

    if (!pendingAction) {
      return "Não encontrei nenhuma ação pendente para confirmar.";
    }

    if (pendingAction.actionType === "resolve_card_expense") {
      return "Ainda preciso que você responda com o cartão antes de confirmar.";
    }

    if (!CONFIRMABLE_ACTIONS.has(pendingAction.actionType)) {
      return "Essa ação ainda não pode ser confirmada por aqui.";
    }

    return executeWhatsappPendingAction(pendingAction);
  }

  if (["nao", "não", "n", "cancelar", "cancela"].includes(normalized)) {
    const pendingAction = await getActiveWhatsappPendingAction(userId, phone);

    if (!pendingAction) {
      return "Não encontrei nenhuma ação pendente para cancelar.";
    }

    await updateWhatsappPendingActionStatus(pendingAction.id, "cancelled");
    return "Ação pendente cancelada.";
  }

  const pendingAction = await getActiveWhatsappPendingAction(userId, phone);
  if (pendingAction?.actionType === "resolve_card_expense") {
    return resolvePendingCardExpense({ pendingAction, message });
  }

  if (!normalized || normalized === "ajuda" || normalized === "help") {
    return WHATSAPP_HELP_MESSAGE;
  }

  if (["resumo", "saldo", "gastos"].includes(normalized)) {
    return getWhatsappMonthlySummary(userId);
  }

  if (["vencimentos", "contas", "pendencias"].includes(normalized)) {
    return getWhatsappDueItems(userId);
  }

  // Camada barata e determinística primeiro: resolve os padrões mais comuns de
  // despesa de cartão e de despesa avulsa sem gastar tokens da DeepSeek. Se
  // nenhuma das duas tiver confiança, cai no classificador de IA. Os cartões
  // ativos são carregados uma única vez e reaproveitados por todos os passos.
  const cards = await getCreditCards(userId);
  const heuristicIntent =
    (await tryHeuristicCardExpense(message, cards)) ??
    (await tryHeuristicBill(message, cards));
  const intent =
    heuristicIntent ?? (await classifyWhatsappIntent(message, { cards }));
  const pendingActionResult = await createPendingActionFromIntent({
    intent,
    message,
    phone,
    userId,
  });

  if (pendingActionResult) {
    return pendingActionResult.response;
  }

  return [
    "Ainda não entendi esse comando.",
    "",
    "Use `ajuda` para ver o que já está disponível.",
  ].join("\n");
}
