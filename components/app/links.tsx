import { Github, Globe, Linkedin, Mail } from "lucide-react";
import { profileLinks, type LinkKind } from "@/lib/links";
import { cn } from "@/lib/utils";

const ICON: Record<LinkKind, typeof Github> = { linkedin: Linkedin, github: Github, portfolio: Globe };
const NAME: Record<LinkKind, string> = { linkedin: "LinkedIn", github: "GitHub", portfolio: "Portfolio" };
const TONE: Record<LinkKind, string> = {
  linkedin: "hover:border-[#0A66C2] hover:text-[#5AA2E8]",
  github: "hover:border-foreground/60 hover:text-foreground",
  portfolio: "hover:border-primary hover:text-primary",
};

/** Quick-open buttons for a candidate's LinkedIn / GitHub / portfolio (+ optional email). */
export function ProfileLinks({ links, email, compact, className }: { links: string[] | null | undefined; email?: string | null; compact?: boolean; className?: string }) {
  const items = profileLinks(links);
  if (!items.length && !email) return compact ? null : <span className="text-xs text-muted-foreground">No profile links in resume</span>;
  const base = "inline-flex items-center gap-1.5 rounded-lg border border-border text-muted-foreground transition-colors";
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {items.map((l) => {
        const Icon = ICON[l.kind];
        return (
          <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer nofollow" title={`${NAME[l.kind]}: ${l.url}`}
            onClick={(e) => e.stopPropagation()}
            className={cn(base, TONE[l.kind], compact ? "h-7 w-7 justify-center" : "px-2.5 py-1 text-xs")}>
            <Icon className="h-3.5 w-3.5" />
            {!compact && <span className="max-w-[140px] truncate">{l.kind === "portfolio" ? l.label : NAME[l.kind]}</span>}
            <span className="sr-only">{NAME[l.kind]}</span>
          </a>
        );
      })}
      {email && (
        <a href={`mailto:${email}`} title={`Email ${email}`} onClick={(e) => e.stopPropagation()}
          className={cn(base, "hover:border-matched hover:text-matched", compact ? "h-7 w-7 justify-center" : "px-2.5 py-1 text-xs")}>
          <Mail className="h-3.5 w-3.5" />{!compact && <span>Email</span>}<span className="sr-only">Email</span>
        </a>
      )}
    </div>
  );
}
