"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

/**
 * Summary row with a primary toggle that reveals the create form inline,
 * so the list stays the focus until the user chooses to add something.
 */
export function AddExpensePanel({
  summary,
  children,
}: {
  summary: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        {summary}
        <button
          aria-expanded={open}
          className="clip-notch sheen group focus-ring inline-flex min-h-11 items-center justify-center gap-2 self-start bg-accent px-4 text-sm font-semibold tracking-tight text-text-inverse transition duration-200 hover:bg-accent-hover active:scale-[0.985] sm:self-auto"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          {open ? <X size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
          {open ? "Fechar" : "Cadastrar nova despesa"}
        </button>
      </div>
      {open ? (
        <div className="mt-6 border-t border-border-subtle pt-6">{children}</div>
      ) : null}
    </div>
  );
}
