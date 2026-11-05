"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
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
  ],
  candidate: [
    { href: "/candidate", label: "Dashboard" },
    { href: "/candidate/resume", label: "Resume" },
    { href: "/candidate/jobs", label: "Jobs" },
    { href: "/candidate/applications", label: "Applications" },
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
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link href={`/${role}`} className="flex items-center gap-2 font-heading font-bold">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-sm text-primary-foreground">R</span>
            RC3
          </Link>
          <nav className="flex flex-1 gap-1 overflow-x-auto">
            {NAV[role].map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors",
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
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
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
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
            {unread}
          </span>
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
