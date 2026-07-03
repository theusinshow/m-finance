import { db } from "@/db/client";
import {
  getWhatsappOwnerUser,
  isAllowedWhatsappSender,
  isAuthorizedWhatsappWebhook,
} from "@/lib/whatsapp/auth";
import { handleWhatsappCommand } from "@/lib/whatsapp/commands";
import {
  createEmptyWhatsappResponse,
  createWhatsappXmlResponse,
} from "@/lib/whatsapp/responses";

export const runtime = "nodejs";

type TwilioWhatsappPayload = {
  From?: string;
  Body?: string;
  MessageSid?: string;
};

function parseTwilioPayload(formData: FormData): TwilioWhatsappPayload {
  return {
    From: String(formData.get("From") ?? ""),
    Body: String(formData.get("Body") ?? ""),
    MessageSid: String(formData.get("MessageSid") ?? ""),
  };
}

/**
 * Twilio WhatsApp inbound webhook.
 *
 * Configure the Twilio sandbox/number webhook as:
 * https://<host>/api/whatsapp/twilio?secret=<WHATSAPP_WEBHOOK_SECRET>
 */
export async function POST(request: Request) {
  if (!isAuthorizedWhatsappWebhook(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!db) {
    return createWhatsappXmlResponse("Banco de dados indisponível no momento.");
  }

  const payload = parseTwilioPayload(await request.formData());

  if (!isAllowedWhatsappSender(payload.From)) {
    return createEmptyWhatsappResponse();
  }

  const user = await getWhatsappOwnerUser();

  if (!user) {
    return createWhatsappXmlResponse(
      "Usuário autorizado não encontrado. Faça login no app antes de usar o WhatsApp.",
    );
  }

  const response = await handleWhatsappCommand({
    message: payload.Body ?? "",
    userId: user.id,
  });

  return createWhatsappXmlResponse(response);
}
