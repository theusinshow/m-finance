import { AppShell } from "@/components/app-shell/app-shell";
import { ensureAppUser } from "@/lib/auth/bootstrap";
import { requireUser } from "@/lib/auth/guard";
import { getMonthSwitcherData } from "@/lib/active-month";

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireUser();
  const appUser = await ensureAppUser(user);
  const { options, activeValue } = appUser
    ? await getMonthSwitcherData(appUser.id)
    : { options: [], activeValue: "" };

  return (
    <AppShell activeMonthValue={activeValue} monthOptions={options} user={user}>
      {children}
    </AppShell>
  );
}
