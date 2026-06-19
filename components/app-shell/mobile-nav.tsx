"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Calculator,
  CreditCard,
  History,
  LayoutDashboard,
  ReceiptText,
  Target,
} from "lucide-react";
import { TriangleMark } from "@/components/brand/triangle-mark";
import { cn } from "@/lib/utils";

const items = [
  { href: "/app/dashboard", label: "Início", icon: LayoutDashboard },
  { href: "/app/calendar", label: "Calendário", icon: CalendarDays },
  { href: "/app/bills", label: "Despesas", icon: ReceiptText },
  { href: "/app/cards", label: "Cartões", icon: CreditCard },
  { href: "/app/simulator", label: "Simular", icon: Calculator },
  { href: "/app/goals", label: "Metas", icon: Target },
  { href: "/app/history", label: "Histórico", icon: History },
] as const;

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex snap-x overflow-x-auto border-t border-border-subtle bg-background-primary/95 px-1 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;

        return (
          <Link
            className={cn(
              "focus-ring relative flex min-h-14 shrink-0 basis-[19%] snap-start flex-col items-center justify-center gap-1 rounded-md px-1 text-[11px] font-medium text-text-muted transition duration-200",
              active && "bg-background-elevated text-text-primary shadow-lg shadow-black/10",
            )}
            href={item.href}
            key={item.href}
          >
            {active ? (
              <TriangleMark
                className="absolute top-1 text-accent"
                size={7}
                variant="solid"
              />
            ) : null}
            <Icon size={18} aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
