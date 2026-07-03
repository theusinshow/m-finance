import type { WhatsappIntent } from "@/lib/ai/whatsapp-intent";

// Forma mínima de cartão que a heurística precisa. Recebida de fora para não
// duplicar a consulta ao banco a cada mensagem.
type HeuristicCard = {
  id: string;
  name: string;
  cardType: "personal" | "business";
};

// Verbos que tipicamente abrem um lançamento de gasto. Normalizados (sem
// acento) para casar com a versão normalizada da mensagem do usuário.
const CARD_VERB_TRIGGERS = new Set([
  "gastei",
  "gasto",
  "gastou",
  "gasta",
  "gastar",
  "gastamos",
  "comprei",
  "comprar",
  "compra",
  "compras",
  "lanca",
  "lancar",
  "lance",
  "registra",
  "registrar",
  "registre",
  "registro",
  "coloca",
  "colocar",
  "coloque",
  "bota",
  "botar",
  "bote",
  "adiciona",
  "adicionar",
  "adicione",
  "paguei",
  "pague",
  "pagar",
  "pagou",
  "paga",
]);

// Marcadores que indicam pagamento fora do cartão de crédito. Quando presentes
// a heurística de cartão desiste e devolve null (caindo no fluxo de despesa
// avulsa ou na IA).
const NON_CARD_MARKERS =
  /\b(?:em\s+dinheiro|em\s+especie|via\s+pix|pix|debito|a\s+debito|no\s+debito|sem\s+cartao|conta\s+de|conta\s+da|conta\s+do|fatura)\b/;

// Sinais explícitos de que o usuário quer uma despesa avulsa (fora do cartão).
const BILL_EXPLICIT_MARKERS =
  /\b(?:em\s+dinheiro|em\s+especie|via\s+pix|pix|debito|a\s+debito|no\s+debito|sem\s+cartao|conta\s+de|conta\s+da|conta\s+do|despesa\s+solta|despesa\s+avulsa|boleto)\b/;

// Sinais de recorrência: "todo mês", "assinatura", "mensalidade", etc.
const RECURRING_MARKERS =
  /\b(?:todo\s+mes|todos\s+os\s+meses|mensalmente|mensalidade|assinatura|recorrente|recorrencia|mensal)\b/;

// Captura o trecho "no/na/pelo [cartão] X" parando antes de preposições,
// marcadores de parcelamento etc. O grupo 1 é o nome alvo (cardNameHint ou
// descrição, dependendo do casamento com os cartões reais).
const PREP_SEGMENT_REGEX =
  /\b(?:no|na|nos|nas|pelo|pela|pelos|pelas|num|numa)(?:\s+(?:cartao|cartoes))?\s+([a-z0-9]+(?:\s+(?!no|na|nos|nas|pelo|pela|pelos|pelas|num|numa|em|de|da|do|das|dos|para|com|parcelad[oa]?|vezes?|cartao|cartoes)[a-z0-9]+){0,3})/g;

// Palavras removidas ao isolar a descrição: preposições, "cartão" e ruído de
// moeda. A remoção acontece depois do verbo, do valor e do cartão já terem saído.
const DESCRIPTION_STOP_WORDS =
  /\b(?:no|na|nos|nas|pelo|pela|pelos|pelas|num|numa|de|da|do|das|dos|em|para|com|cartao|cartoes|compra|compras|valores?|reais?|rs)\b/g;

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function todayIso() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Lê o primeiro valor monetário da mensagem original (preservando separadores)
// e devolve o total em centavos. Espelja parseCurrencyToCents do lib/money.
function parseAmountCents(text: string): number | null {
  const match = /(?:r\$?\s*)?(\d+(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/i.exec(text);
  if (!match) return null;
  const raw = match[1];
  const lastSep = Math.max(raw.lastIndexOf(","), raw.lastIndexOf("."));
  let normalizedAmount: string;
  if (lastSep === -1) {
    normalizedAmount = raw;
  } else {
    const decimalPart = raw.slice(lastSep + 1);
    if (decimalPart.length >= 1 && decimalPart.length <= 2) {
      const intPart = raw.slice(0, lastSep).replace(/[.,]/g, "");
      normalizedAmount = `${intPart}.${decimalPart}`;
    } else {
      normalizedAmount = raw.replace(/[.,]/g, "");
    }
  }
  const amount = Number(normalizedAmount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

// "6x", "em 6x", "parcelado em 10 vezes", "em 10 vezes".
function parseInstallments(normalized: string): number | null {
  let match = /(\d+)\s*x\b/.exec(normalized);
  if (match) {
    const total = Number(match[1]);
    if (total >= 2 && total <= 60) return total;
  }
  match = /(?:parcelad[oa]?\s+em\s+|em\s+)(\d+)\s+vez(?:es)?\b/.exec(normalized);
  if (match) {
    const total = Number(match[1]);
    if (total >= 2 && total <= 60) return total;
  }
  return null;
}

function scoreCardMatch(segment: string, card: HeuristicCard): number {
  const cardName = normalize(card.name);
  if (!segment || !cardName) return 0;
  if (segment === cardName) return 100;

  const segmentTokens = segment.split(" ").filter(Boolean);
  const cardTokens = cardName.split(" ").filter(Boolean);
  let shared = 0;
  for (const token of segmentTokens) {
    if (cardTokens.includes(token)) shared += 1;
  }
  // Qualificadores comuns no português coloquial continuam ajudando mesmo quando
  // a IA/devolve só a marca base.
  if (segmentTokens.includes("pj") && card.cardType === "business") shared += 1;
  if (segmentTokens.includes("pessoal") && card.cardType === "personal") shared += 1;
  if (segmentTokens.includes("empresa") && card.cardType === "business") shared += 1;
  if (segmentTokens.includes("business") && card.cardType === "business") shared += 1;

  return shared * 10;
}

// Percorre cada trecho "no X" e devolve o que melhor casa com um cartão ativo.
function findCardSegment(normalized: string, cards: HeuristicCard[]): string | null {
  let bestSegment: string | null = null;
  let bestScore = 0;
  let match: RegExpExecArray | null;
  PREP_SEGMENT_REGEX.lastIndex = 0;
  while ((match = PREP_SEGMENT_REGEX.exec(normalized)) !== null) {
    const segment = match[1].trim();
    if (!segment) continue;
    let bestCardScore = 0;
    for (const card of cards) {
      const score = scoreCardMatch(segment, card);
      if (score > bestCardScore) bestCardScore = score;
    }
    if (bestCardScore >= 10 && bestCardScore > bestScore) {
      bestScore = bestCardScore;
      bestSegment = segment;
    }
  }
  return bestSegment;
}

// Recupera a forma original (com acentos) de um trecho normalizado para a
// descrição ficar bonita no resumo de confirmação.
function findOriginalChunk(original: string, normalizedTarget: string): string | null {
  const targetTokens = normalizedTarget.split(" ").filter(Boolean);
  if (targetTokens.length === 0) return null;
  const originalTokens = original.split(/[\s,]+/).filter(Boolean);
  for (let i = 0; i <= originalTokens.length - targetTokens.length; i++) {
    const chunk = originalTokens.slice(i, i + targetTokens.length);
    if (
      chunk.length === targetTokens.length &&
      chunk.map(normalize).join(" ") === normalizedTarget
    ) {
      return chunk.join(" ");
    }
  }
  return null;
}

function extractDescription(
  original: string,
  normalized: string,
  cardSegment: string | null,
): string | null {
  let text = normalized;
  // Remove cláusulas de parcelamento antes de tirar números soltos.
  text = text.replace(/\b(?:em\s+)?\d+\s*x\b/g, " ");
  text = text.replace(/\b(?:parcelad[oa]?\s+em\s+|em\s+)\d+\s+vez(?:es)?\b/g, " ");
  // Remove o trecho do cartão já identificado.
  if (cardSegment) {
    text = text.replace(
      new RegExp(
        `\\b(?:no|na|nos|nas|pelo|pela|pelos|pelas|num|numa)(?:\\s+(?:cartao|cartoes))?\\s+${escapeRegex(cardSegment)}\\b`,
      ),
      " ",
    );
  }
  // Remove verbos de gatilho.
  text = text.replace(
    /\b(?:gastei|gasto|gastou|gasta|gastar|gastamos|comprei|comprar|compra|compras|lanca|lancar|lance|registra|registrar|registre|registro|coloca|colocar|coloque|bota|botar|bote|adiciona|adicionar|adicione|paguei|pague|pagar|pagou|paga)\b/g,
    " ",
  );
  // Remove preposições e ruído de moeda.
  text = text.replace(DESCRIPTION_STOP_WORDS, " ");
  // Remove números avulsos (restos do valor).
  text = text.replace(/\b\d+\b/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  if (!text) return null;
  return findOriginalChunk(original, text) ?? text;
}

/**
 * Camada determinística e barata que tenta classificar uma despesa de cartão
 * antes de chamar a DeepSeek. Devolve uma intenção completa quando confia no
 * resultado, ou null para cair no fluxo de IA existente.
 *
 * Casos cobertos:
 * - "gastei 32 no almoço no nubank pessoal"
 * - "comprei 600 no mercado pago em 6x no nubank pessoal"
 * - "gastei 1200 na amazon parcelado em 10 vezes no itaú"
 * - "paguei 35 no almoço pelo nubank pj"
 * - "coloca 20 de estacionamento no cartão itaú"
 * - "lança 89,90 no mercado pago"
 */
export async function tryHeuristicCardExpense(
  message: string,
  cards: HeuristicCard[],
): Promise<WhatsappIntent | null> {
  if (!message.trim()) return null;
  const normalized = normalize(message);
  const tokens = normalized.split(" ").filter(Boolean);
  if (tokens.length === 0) return null;

  const hasTrigger = tokens.some((token) => CARD_VERB_TRIGGERS.has(token));
  if (!hasTrigger) return null;

  // Tira de cena claramente despesas fora do cartão de crédito.
  if (NON_CARD_MARKERS.test(normalized)) return null;

  const amountCents = parseAmountCents(message);
  if (!amountCents) return null;

  const installments = parseInstallments(normalized);
  const cardSegment = findCardSegment(normalized, cards);
  const hasCardWord = /\bcartao\b|\bcartoes\b/.test(normalized);

  // Sem cartão identificado e sem menção explícita a "cartão" deixamos a IA ou
  // o fluxo de despesa avulsa decidir.
  if (!cardSegment && !hasCardWord) return null;

  const description = extractDescription(message, normalized, cardSegment);

  return {
    intent: "create_card_expense",
    amountCents,
    description: description ?? "compra",
    cardNameHint: cardSegment,
    purchaseDate: todayIso(),
    paymentType: installments ? "installment" : "cash",
    installments,
    confidence: 0.8,
  };
}

// "dia 15", "vencimento dia 15", "vence dia 15".
function parseDueDay(normalized: string): number | null {
  const match = /\bdia\s+(\d{1,2})\b/.exec(normalized);
  if (!match) return null;
  const day = Number(match[1]);
  if (!Number.isFinite(day) || day < 1 || day > 31) return null;
  return day;
}

// Lista de palavras que param a captura da descrição da despesa avulsa.
const BILL_DESC_STOP_WORDS =
  "no|na|nos|nas|pelo|pela|pelos|pelas|num|numa|de|da|do|das|dos|em|para|com|como|sem|dia|vencimento|vence|todo|todos|os|mes|meses|mensalmente|mensalidade|assinatura|recorrente|recorrencia|mensal|reais?|rs|cartao|cartoes|dinheiro|especie|pix|debito|boleto|solta|avulsa|conta|vezes?|parcelad[oa]?";

function extractBillDescription(original: string, normalized: string): string | null {
  // Prefere "de X" / "conta de X" (paguei 120 de luz, conta de água).
  const deMatch = new RegExp(
    `\\b(?:conta\\s+)?de\\s+([a-z0-9]+(?:\\s+(?!${BILL_DESC_STOP_WORDS})[a-z0-9]+){0,3})`,
  ).exec(normalized);
  if (deMatch) {
    const desc = deMatch[1].trim();
    if (desc) return findOriginalChunk(original, desc) ?? desc;
  }
  // Plano B: "no/na X" (gastei 40 em dinheiro no almoço).
  const noMatch = new RegExp(
    `\\b(?:no|na|num|numa)\\s+([a-z0-9]+(?:\\s+(?!${BILL_DESC_STOP_WORDS})[a-z0-9]+){0,3})`,
  ).exec(normalized);
  if (noMatch) {
    const desc = noMatch[1].trim();
    if (desc) return findOriginalChunk(original, desc) ?? desc;
  }
  return null;
}

/**
 * Camada determinística para despesas avulsas (fora do cartão). Só devolve uma
 * intenção quando há um sinal explícito (em dinheiro/pix/débito/conta de/recorrente);
 * frases ambíguas sem marcador caem na IA para evitar falsos positivos.
 *
 * Casos cobertos:
 * - "gastei 40 em dinheiro no almoço"
 * - "paguei 120 de conta de luz"
 * - "lança 80 de gasolina como despesa solta"
 * - "coloca 50 de mercado sem cartão"
 * - "todo mês tenho 49,90 de spotify dia 10"
 */
export async function tryHeuristicBill(
  message: string,
  cards: HeuristicCard[],
): Promise<WhatsappIntent | null> {
  if (!message.trim()) return null;
  const normalized = normalize(message);
  const tokens = normalized.split(" ").filter(Boolean);
  if (tokens.length === 0) return null;

  const hasTrigger = tokens.some((token) => CARD_VERB_TRIGGERS.has(token));
  if (!hasTrigger) return null;

  const hasBillMarker = BILL_EXPLICIT_MARKERS.test(normalized);
  const hasRecurring = RECURRING_MARKERS.test(normalized);

  // Sem sinal explícito de despesa avulsa nem recorrência, deixamos a IA decidir
  // (a frase pode ser cartão ambíguo).
  if (!hasBillMarker && !hasRecurring) return null;

  // Se um cartão foi claramente identificado e não há marcador de despesa solta,
  // o fluxo de cartão já deveria ter tratado — não dual-classificamos.
  const cardSegment = findCardSegment(normalized, cards);
  if (cardSegment && !hasBillMarker) return null;

  const amountCents = parseAmountCents(message);
  if (!amountCents) return null;

  const description = extractBillDescription(message, normalized);
  if (!description) return null;

  return {
    intent: "create_bill",
    amountCents,
    description,
    dueDay: parseDueDay(normalized),
    isRecurring: hasRecurring,
    confidence: 0.8,
  };
}
