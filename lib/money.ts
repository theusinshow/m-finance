export function parseCurrencyToCents(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  const normalized = raw.replace(/\./g, "").replace(",", ".");
  const amount = Number(normalized);

  if (!Number.isFinite(amount)) {
    return 0;
  }

  return Math.round(amount * 100);
}
