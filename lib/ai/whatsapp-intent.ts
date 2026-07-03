import { z } from "zod";
import { env } from "@/lib/env";
import { getDeepSeekClient } from "@/lib/ai/deepseek";

const whatsappIntentSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("create_card_expense"),
    amountCents: z.number().int().positive(),
    description: z.string().trim().min(1),
    cardNameHint: z.string().trim().min(1).nullable(),
    purchaseDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    paymentType: z.enum(["cash", "installment"]),
    installments: z.number().int().min(2).max(60).nullable(),
    confidence: z.number().min(0).max(1),
  }),
  z.object({
    intent: z.literal("unknown"),
    reason: z.string().trim().min(1),
    confidence: z.number().min(0).max(1),
  }),
]);

export type WhatsappIntent = z.infer<typeof whatsappIntentSchema>;

function todayIso() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const exampleJson = {
  intent: "create_card_expense",
  amountCents: 3290,
  description: "almoço",
  cardNameHint: null,
  purchaseDate: "2026-07-03",
  paymentType: "cash",
  installments: null,
  confidence: 0.92,
};

export async function classifyWhatsappIntent(message: string): Promise<WhatsappIntent> {
  const client = getDeepSeekClient();

  if (!client) {
    return {
      intent: "unknown",
      reason: "DeepSeek não configurado.",
      confidence: 0,
    };
  }

  const completion = await client.chat.completions.create({
    model: env.deepseekModel,
    messages: [
      {
        role: "system",
        content: [
          "Você é um extrator de intenção para um app financeiro pessoal chamado M Finance.",
          "Responda somente com JSON válido.",
          "Não execute ações. Apenas classifique a mensagem.",
          "A data de hoje no fuso America/Sao_Paulo é " + todayIso() + ".",
          "Por enquanto só reconheça compras/despesas de cartão de crédito.",
          "Se a mensagem for consulta, saudação, comando, ambígua ou não indicar gasto, retorne intent unknown.",
          "Valores devem ser convertidos para centavos em BRL.",
          "Se o cartão for mencionado, preencha cardNameHint; caso contrário, null.",
          "Se não houver data explícita, use a data de hoje.",
          "Se houver parcelamento, use paymentType installment e installments; caso contrário cash e null.",
          "Exemplo de JSON:",
          JSON.stringify(exampleJson),
        ].join("\n"),
      },
      {
        role: "user",
        content: `Classifique em json esta mensagem do WhatsApp: ${message}`,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 500,
  });

  const content = completion.choices[0]?.message.content;

  if (!content) {
    return {
      intent: "unknown",
      reason: "DeepSeek retornou conteúdo vazio.",
      confidence: 0,
    };
  }

  try {
    return whatsappIntentSchema.parse(JSON.parse(content));
  } catch {
    return {
      intent: "unknown",
      reason: "DeepSeek retornou JSON fora do schema esperado.",
      confidence: 0,
    };
  }
}
