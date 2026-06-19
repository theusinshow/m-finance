import { createIncome, deleteIncome, updateIncome } from "@/app/actions/incomes";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { EditDisclosure } from "@/components/ui/edit-disclosure";
import { FormSubmitButton } from "@/components/form-submit-button";
import { ToastForm } from "@/components/toast-form";
import { formatCurrency } from "@/lib/formatters/currency";

type Income = {
  id: string;
  name: string;
  amountCents: number;
  incomeType: "main" | "extra" | "freelance";
  expectedDate: string | null;
  received: boolean;
};

const incomeTypeLabel = {
  main: "Principal",
  extra: "Extra",
  freelance: "Freelance",
};

function formatCentsInput(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function IncomeFormCard({ incomes }: { incomes: Income[] }) {
  return (
    <DashboardCard
      description="Receita principal, extras e freelances previstos para o mês."
      title="Receitas do mês"
    >
      <div className="grid gap-5 xl:grid-cols-[0.85fr_1fr]">
        <ToastForm action={createIncome} successMessage="Receita adicionada." className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-text-secondary" htmlFor="income-name">
              Nome
            </label>
            <input
              className="focus-ring min-h-11 w-full rounded-md border border-border-subtle bg-background-elevated px-3 text-sm text-text-primary placeholder:text-text-muted"
              id="income-name"
              name="name"
              placeholder="Receita principal"
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-text-secondary" htmlFor="income-amount">
                Valor
              </label>
              <input
                className="focus-ring min-h-11 w-full rounded-md border border-border-subtle bg-background-elevated px-3 text-sm text-text-primary placeholder:text-text-muted"
                id="income-amount"
                inputMode="decimal"
                name="amount"
                placeholder="4500,00"
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-text-secondary" htmlFor="income-type">
                Tipo
              </label>
              <select
                className="focus-ring min-h-11 w-full rounded-md border border-border-subtle bg-background-elevated px-3 text-sm text-text-primary"
                id="income-type"
                name="incomeType"
                required
              >
                <option value="main">Principal</option>
                <option value="extra">Extra</option>
                <option value="freelance">Freelance</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-text-secondary" htmlFor="income-date">
              Data prevista
            </label>
            <input
              className="focus-ring min-h-11 w-full rounded-md border border-border-subtle bg-background-elevated px-3 text-sm text-text-primary"
              id="income-date"
              name="expectedDate"
              type="date"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input className="h-4 w-4 accent-accent" name="received" type="checkbox" />
            Já recebido
          </label>

          <FormSubmitButton pendingLabel="Adicionando...">Adicionar receita</FormSubmitButton>
        </ToastForm>

        <div className="space-y-3">
          {incomes.length === 0 ? (
            <div className="rounded-lg border border-border-subtle bg-background-elevated p-4 text-sm text-text-muted">
              Nenhuma receita cadastrada para este mês.
            </div>
          ) : (
            incomes.map((income) => (
              <div
                className="rounded-lg border border-border-subtle bg-background-elevated p-4"
                key={income.id}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-text-primary">{income.name}</p>
                    <p className="mt-1 text-sm text-text-muted">
                      {incomeTypeLabel[income.incomeType]} · {income.received ? "Recebido" : "Previsto"}
                    </p>
                  </div>
                  <p className="num font-semibold text-text-primary">
                    {formatCurrency(income.amountCents)}
                  </p>
                </div>
                <EditDisclosure className="mt-4">
                  <ToastForm action={updateIncome} successMessage="Receita atualizada." className="grid gap-3">
                    <input name="incomeId" type="hidden" value={income.id} />
                    <input
                      className="focus-ring min-h-11 rounded-md border border-border-subtle bg-background-card px-3 text-sm text-text-primary"
                      defaultValue={income.name}
                      name="name"
                      required
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        className="focus-ring min-h-11 rounded-md border border-border-subtle bg-background-card px-3 text-sm text-text-primary"
                        defaultValue={formatCentsInput(income.amountCents)}
                        inputMode="decimal"
                        name="amount"
                        required
                      />
                      <select
                        className="focus-ring min-h-11 rounded-md border border-border-subtle bg-background-card px-3 text-sm text-text-primary"
                        defaultValue={income.incomeType}
                        name="incomeType"
                      >
                        <option value="main">Principal</option>
                        <option value="extra">Extra</option>
                        <option value="freelance">Freelance</option>
                      </select>
                    </div>
                    <input
                      className="focus-ring min-h-11 rounded-md border border-border-subtle bg-background-card px-3 text-sm text-text-primary"
                      defaultValue={income.expectedDate ?? ""}
                      name="expectedDate"
                      type="date"
                    />
                    <label className="flex items-center gap-2 text-sm text-text-secondary">
                      <input className="h-4 w-4 accent-accent" defaultChecked={income.received} name="received" type="checkbox" />
                      Já recebido
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <FormSubmitButton pendingLabel="Salvando...">Salvar</FormSubmitButton>
                    </div>
                  </ToastForm>
                  <ToastForm action={deleteIncome} successMessage="Receita excluída." className="mt-2">
                    <input name="incomeId" type="hidden" value={income.id} />
                    <ConfirmDeleteButton confirmMessage="Excluir esta receita? Essa ação não pode ser desfeita.">
                      Excluir receita
                    </ConfirmDeleteButton>
                  </ToastForm>
                </EditDisclosure>
              </div>
            ))
          )}
        </div>
      </div>
    </DashboardCard>
  );
}
