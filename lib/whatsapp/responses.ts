import twilio from "twilio";

export function createWhatsappXmlResponse(message: string) {
  const response = new twilio.twiml.MessagingResponse();
  response.message(message);

  return new Response(response.toString(), {
    status: 200,
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
    },
  });
}

export function createEmptyWhatsappResponse(status = 200) {
  return new Response("", { status });
}

export const WHATSAPP_HELP_MESSAGE = [
  "M Finance no WhatsApp",
  "",
  "Comandos disponíveis:",
  "• ajuda",
  "• resumo",
  "• saldo",
  "• gastos",
  "• vencimentos",
  "",
  "Por enquanto eu só consulto dados. Lançamentos por mensagem entram na próxima etapa com confirmação.",
].join("\n");
