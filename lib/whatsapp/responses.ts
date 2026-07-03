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
  "Comandos de consulta:",
  "• ajuda",
  "• resumo / saldo / gastos",
  "• vencimentos",
  "",
  "Lançamentos (sempre peço confirmação):",
  "• gastei 32 no almoço no nubank pessoal",
  "• comprei 600 na amazon em 6x no itaú",
  "• paguei 120 de luz",
  "• lança 80 de gasolina em dinheiro",
  "",
  "Responda sim ou não para confirmar/cancelar.",
].join("\n");
