"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { CurrencyCountUp } from "@/components/ui/currency-count-up";

const STORAGE_KEY = "mf-balance-hidden";

/**
 * Hero balance with a privacy toggle. The hidden preference persists locally
 * and is read in the initial state so the value never flashes before masking.
 */
export function BalanceDisplay({ cents }: { cents: number }) {
  const [hidden, setHidden] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY) === "1",
  );

  function toggle() {
    setHidden((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-text-muted">
          Sobra prevista
        </p>
        <button
          aria-label={hidden ? "Mostrar saldo" : "Esconder saldo"}
          className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition duration-200 hover:bg-background-elevated hover:text-text-primary"
          onClick={toggle}
          type="button"
        >
          {hidden ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
        </button>
      </div>
      <h1
        className="mt-3 text-5xl font-semibold leading-none text-text-primary md:text-6xl"
        suppressHydrationWarning
      >
        {hidden ? (
          <span className="num text-text-muted">R$ ••••••</span>
        ) : (
          <CurrencyCountUp cents={cents} />
        )}
      </h1>
    </div>
  );
}
