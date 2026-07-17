import { TriangleMark } from "@/components/brand/triangle-mark";
import { cn } from "@/lib/utils";

export function DashboardCard({
  children,
  className,
  title,
  description,
  accent = false,
  action,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
  accent?: boolean;
  /** Conteúdo alinhado à direita do título (métricas, ações secundárias). */
  action?: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "relative rounded-xl border border-border-subtle bg-background-card/95 p-5 shadow-xl shadow-black/15 ring-1 ring-white/[0.02] transition duration-300 hover:border-border-default hover:shadow-2xl hover:shadow-black/25",
        accent && "clip-notch-lg",
        className,
      )}
    >
      {accent ? (
        <span
          aria-hidden="true"
          className="absolute right-0 top-0 h-[1.1rem] w-[1.1rem] bg-accent/60"
          style={{ clipPath: "polygon(100% 0, 0 0, 100% 100%)" }}
        />
      ) : null}
      {title ? (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-text-muted">
              <TriangleMark className="shrink-0 text-accent/70" size={10} variant="solid" />
              {title}
            </h2>
            {description ? (
              <p className="mt-1.5 text-sm leading-5 text-text-muted">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
