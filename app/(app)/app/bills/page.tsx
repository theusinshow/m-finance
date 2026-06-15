import { BillFormCard } from "@/components/bills/bill-form-card";
import { CreateCurrentMonthCard } from "@/components/dashboard/create-current-month-card";
import { PageHeading } from "@/components/page-heading";
import { requireUser } from "@/lib/auth/guard";
import { getBillCategories, getBillsByMonth } from "@/lib/bills";
import { getAppUserBySupabaseId, getCurrentMonthForUser } from "@/lib/months";

export default async function BillsPage() {
  const user = await requireUser();
  const appUser = await getAppUserBySupabaseId(user.id);
  const currentMonth = appUser ? await getCurrentMonthForUser(appUser.id) : null;
  const categories = appUser ? await getBillCategories(appUser.id) : [];
  const bills = currentMonth ? await getBillsByMonth(currentMonth.id) : [];

  return (
    <div className="space-y-6">
      <PageHeading eyebrow="Despesas" title="Despesas do mês" />

      {!currentMonth ? <CreateCurrentMonthCard /> : null}

      {currentMonth ? <BillFormCard bills={bills} categories={categories} /> : null}
    </div>
  );
}
