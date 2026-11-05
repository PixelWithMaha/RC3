import * as React from "react";
import { cn } from "@/lib/utils";

/** Native select styled like shadcn inputs (keeps bundle and a11y simple). */
const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-9 w-full rounded-md border border-input bg-surface px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Select.displayName = "Select";
export { Select };
