// Split auth layout: form on the left, animated evidence card on the right (desktop).
import Link from "next/link";
import type { ReactNode } from "react";
import { AuthStory } from "./auth-story";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="relative flex flex-col px-6 py-8 sm:px-10">
        <Link href="/" className="flex items-center gap-2 font-heading text-lg font-bold">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-[15px] text-primary-foreground">R</span> RC3
        </Link>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="dash-card w-full max-w-sm">{children}</div>
        </div>
        <p className="text-center text-xs text-muted-foreground">AI recommends. You decide.</p>
      </div>
      <aside className="relative hidden overflow-hidden border-l border-border bg-[#10132a] py-5 lg:flex lg:items-center lg:justify-center">
        <div aria-hidden className="auth-aurora absolute -right-20 -top-28 h-[400px] w-[400px] rounded-full bg-[#5b3df5] opacity-45 blur-[80px]" />
        <div aria-hidden className="auth-aurora absolute -bottom-36 -left-24 h-[360px] w-[360px] rounded-full bg-[#0f9488] opacity-45 blur-[80px] [animation-delay:-6s]" />
        <AuthStory />
      </aside>
    </div>
  );
}
