import { Link } from "@tanstack/react-router";
import { BookOpenCheck } from "lucide-react";
import type { ReactNode } from "react";

export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="surface-brand relative hidden flex-col justify-between overflow-hidden p-10 text-primary-foreground lg:flex">
        <Link to="/" className="flex items-center gap-2 text-lg font-display font-semibold">
          <BookOpenCheck className="size-6" />
          AccountAI
        </Link>
        <div className="max-w-md space-y-4">
          <h2 className="font-display text-3xl font-semibold leading-tight">
            Your books, explained in plain language.
          </h2>
          <p className="text-sm text-primary-foreground/80">
            Ask about VAT, expenses and performance the way you'd ask a colleague — the assistant
            pulls real transactions and shows exactly what it used to answer.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/60">
          Demo data is generated automatically for every new workspace.
        </p>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1.5">
            <Link
              to="/"
              className="mb-6 flex items-center gap-2 font-display text-lg font-semibold lg:hidden"
            >
              <BookOpenCheck className="size-5 text-accent" />
              AccountAI
            </Link>
            <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {children}
          {footer}
        </div>
      </div>
    </div>
  );
}
