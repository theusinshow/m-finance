import {
  getWhatsappDueItems,
  getWhatsappMonthlySummary,
} from "@/lib/finance/whatsapp-summary";
import {
  getActiveWhatsappPendingAction,
  updateWhatsappPendingActionStatus,
} from "@/lib/whatsapp/audit";
import { WHATSAPP_HELP_MESSAGE } from "@/lib/whatsapp/responses";

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

    await updateWhatsappPendingActionStatus(pendingAction.id, "confirmed");
    return [
      "Confirmação registrada.",
      "",
      "A execução da ação entra na próxima etapa da integração.",
    ].join("\n");
  }

  if (["nao", "não", "n", "cancelar", "cancela"].includes(normalized)) {
    const pendingAction = await getActiveWhatsappPendingAction(userId, phone);

    if (!pendingAction) {
      return "Não encontrei nenhuma ação pendente para cancelar.";
    }

    await updateWhatsappPendingActionStatus(pendingAction.id, "cancelled");
    return "Ação pendente cancelada.";
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

  return [
    "Ainda não entendi esse comando.",
    "",
    "Use `ajuda` para ver o que já está disponível.",
  ].join("\n");
}
