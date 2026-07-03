import { createBudget } from "@/app/actions/budgets";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { FormSubmitButton } from "@/components/form-submit-button";
import { ValidatedForm, ValidatedInput, ValidatedSelect } from "@/components/ui/validated-form";
import type { BillCategory } from "@/lib/bills";
import type { CreditCard } from "@/lib/cards";

const fieldClass =
  "focus-ring min-h-11 w-full rounded-md border border-border-subtle bg-background-elevated px-3 text-sm text-text-primary placeholder:text-text-muted";

export function BudgetFormCard({
  categories,
  cards,
}: {
  categories: BillCategory[];
  cards: CreditCard[];
}) {
  return (
    <DashboardCard
      description="Defina tetos de gasto por categoria, cartão ou total do mês."
      title="Novo orçamento"
    >
      <ValidatedForm
        action={createBudget}
        successMessage="Orçamento criado."
        resetOnSuccess
        className="grid gap-4 lg:grid-cols-2"
      >
        <div>
          <label
            className="mb-2 block text-sm font-medium text-text-secondary"
            htmlFor="budget-type"
          >
            Tipo
          </label>
          <ValidatedSelect className={fieldClass} defaultValue="total" id="budget-type" name="budgetType">
            <option value="total">Gasto total do mês</option>
            <option value="category">Por categoria</option>
            <option value="card">Por cartão</option>
          </ValidatedSelect>
        </div>

        <div>
          <label
            className="mb-2 block text-sm font-medium text-text-secondary"
            htmlFor="budget-limit"
          >
            Limite (R$)
          </label>
          <ValidatedInput
            className={fieldClass}
            id="budget-limit"
            inputMode="decimal"
            name="limit"
            placeholder="2000,00"
            required
          />
        </div>

        <div id="budget-category-field" className="hidden">
          <label
            className="mb-2 block text-sm font-medium text-text-secondary"
            htmlFor="budget-category"
          >
            Categoria
          </label>
          <ValidatedSelect className={fieldClass} id="budget-category" name="categoryId">
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </ValidatedSelect>
        </div>

        <div id="budget-card-field" className="hidden">
          <label
            className="mb-2 block text-sm font-medium text-text-secondary"
            htmlFor="budget-card"
          >
            Cartão
          </label>
          <ValidatedSelect className={fieldClass} id="budget-card" name="cardId">
            {cards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.name} ({card.cardType === "business" ? "PJ" : "pessoal"})
              </option>
            ))}
          </ValidatedSelect>
        </div>

        <div className="lg:col-span-2">
          <FormSubmitButton pendingLabel="Criando...">Criar orçamento</FormSubmitButton>
        </div>
      </ValidatedForm>

      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              var select = document.getElementById('budget-type');
              var catField = document.getElementById('budget-category-field');
              var cardField = document.getElementById('budget-card-field');
              function toggle() {
                var val = select.value;
                catField.classList.toggle('hidden', val !== 'category');
                cardField.classList.toggle('hidden', val !== 'card');
              }
              select.addEventListener('change', toggle);
              toggle();
            })();
          `,
        }}
      />
    </DashboardCard>
  );
}
