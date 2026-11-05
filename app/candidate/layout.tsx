import { Suspense } from "react";
import { AppShell } from "@/components/app/shell";
import { Loading } from "@/components/app/states";

// Suspense is required: the shell and pages read the URL (usePathname / useParams) under Cache Components.
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Loading className="mx-auto max-w-6xl px-6" />}>
      <AppShell role="candidate">{children}</AppShell>
    </Suspense>
  );
}
