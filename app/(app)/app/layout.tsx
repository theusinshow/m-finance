import { AppShell } from "@/components/app-shell/app-shell";
import { ensureAppUser } from "@/lib/auth/bootstrap";
import { requireUser } from "@/lib/auth/guard";

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireUser();
  await ensureAppUser(user);

  return <AppShell user={user}>{children}</AppShell>;
}
