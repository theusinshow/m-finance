import {
  getWhatsappDueItems,
  getWhatsappMonthlySummary,
} from "@/lib/finance/whatsapp-summary";
import { WHATSAPP_HELP_MESSAGE } from "@/lib/whatsapp/responses";

export async function handleWhatsappCommand({
  message,
  userId,
}: {
  message: string;
  userId: string;
}) {
  const normalized = message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

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
