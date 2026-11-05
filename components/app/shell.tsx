"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bell } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { getNotifications, markNotificationRead } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import type { Notification, Role } from "@/lib/types";
import { cn } from "@/lib/utils";

const NAV: Record<Role, { href: string; label: string }[]> = {
  recruiter: [
    { href: "/recruiter", label: "Dashboard" },
    { href: "/recruiter/jobs", label: "Jobs" },
    { href: "/recruiter/interviews", label: "Interviews" },
    { href: "/recruiter/search", label: "Talent search" },
    { href: "/recruiter/duplicates", label: "Duplicates" },
  ],
  candidate: [
    { href: "/candidate", label: "Dashboard" },
    { href: "/candidate/resume", label: "Resume" },
    { href: "/candidate/coach", label: "Coach" },
    { href: "/candidate/ats", label: "ATS resume" },
    { href: "/candidate/jobs", label: "Jobs" },
    { href: "/candidate/applications", label: "Applications" },
    { href: "/candidate/profile", label: "Profile" },
  ],
};

export function AppShell({ role, children }: { role: Role; children: ReactNode }) {
  const path = usePathname();
  const [name, setName] = useState<string | null>(null);
  const isActive = (href: string) => (href === `/${role}` ? path === href : path.startsWith(href));

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("full_name, email").eq("id", user.id).single();
      setName(data?.full_name || data?.email || null);
    });
  }, []);

  return (
    <div className="min-h-screen">
      <CursorSpot />
      <header className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-4 px-4 sm:px-6">
          <Link href={`/${role}`} className="flex items-center gap-2 font-heading font-bold">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-[15px] text-primary-foreground">T</span>
            TalentBridge
          </Link>
          <nav className="flex flex-1 gap-1 overflow-x-auto" aria-label="Sections">
            {NAV[role].map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={isActive(n.href) ? "page" : undefined}
                className={cn(
                  "whitespace-nowrap rounded-[10px] px-4 py-2 text-sm font-medium transition-colors",
                  isActive(n.href) ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <Notifications />
          <span className="hidden text-sm text-muted-foreground md:inline">{name}</span>
          <LogoutButton />
        </div>
      </header>
      <main className="relative z-[1] mx-auto max-w-[1280px] px-4 pb-16 pt-7 sm:px-6">{children}</main>
    </div>
  );
}

function Notifications() {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    getNotifications().then(setItems).catch(() => setItems([]));
  }, []);
  const unread = items.filter((n) => !n.read).length;
  return (
    <div className="relative">
      <button
        aria-label="Notifications"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span aria-label={`${unread} unread`} className="dash-ping absolute right-1 top-1 h-2 w-2 rounded-full bg-absent" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-40 w-80 rounded-xl border border-border bg-surface p-2 shadow-xl">
          {items.length === 0 && <p className="p-3 text-sm text-muted-foreground">No notifications yet.</p>}
          {items.map((n) => (
            <Link
              key={n.id}
              href={n.link ?? "#"}
              onClick={() => {
                setOpen(false);
                if (!n.read) markNotificationRead(n.id).then(() => setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, read: true } : x))));
              }}
              className={cn("block rounded-lg p-2.5 text-sm hover:bg-secondary", !n.read && "text-foreground", n.read && "text-muted-foreground")}
            >
              {n.message}
              <span className="block text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** Soft spotlight that trails the cursor (skipped for reduced motion). */
function CursorSpot() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const move = (e: MouseEvent) => {
      if (ref.current) ref.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, []);
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-0 -ml-[260px] -mt-[260px] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,hsl(var(--primary)/0.16),transparent_65%)] transition-transform duration-700 ease-out motion-reduce:hidden"
      style={{ transform: "translate(-600px, -600px)" }}
    />
  );
}
