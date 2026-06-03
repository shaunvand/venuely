"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

type IconName =
  | "overview" | "venue" | "enquiries" | "weddings" | "calendar" | "import"
  | "marketplace" | "vendors" | "money" | "setup";

type Item = { href: string; label: string; children?: Item[] };
type Group = { label: string; icon: IconName; items: Item[] };

const TOP_LINKS: (Item & { icon: IconName })[] = [
  { href: "/venue", label: "Overview", icon: "overview" },
  { href: "/venue/your-venue", label: "Your Venue", icon: "venue" },
  { href: "/venue/enquiries", label: "Enquiries", icon: "enquiries" },
  { href: "/venue/weddings", label: "Weddings", icon: "weddings" },
  { href: "/venue/calendar", label: "Calendar", icon: "calendar" },
  { href: "/venue/uploads", label: "Smart Import", icon: "import" },
];

const GROUPS: Group[] = [
  {
    label: "Marketplace",
    icon: "marketplace",
    items: [
      { href: "/venue/catalogue", label: "Catalogue" },
      {
        href: "/venue/rentals",
        label: "Rentals",
        children: [
          { href: "/venue/rentals?view=included", label: "Included" },
          { href: "/venue/rentals?view=extras", label: "Extras" },
        ],
      },
      { href: "/venue/accommodation", label: "Accommodation" },
      { href: "/venue/areas", label: "Areas" },
      { href: "/venue/seating", label: "Seating & tables" },
    ],
  },
  {
    label: "Partner vendors",
    icon: "vendors",
    items: [
      { href: "/venue/marketplace/caterers", label: "Caterers" },
      { href: "/venue/marketplace/planners", label: "Planners" },
      { href: "/venue/marketplace/florists", label: "Florists" },
      { href: "/venue/marketplace/djs", label: "DJs" },
      { href: "/venue/marketplace/photographers", label: "Photographers" },
      { href: "/venue/marketplace/decor", label: "Decor" },
      { href: "/venue/marketplace/bar", label: "Bar services" },
    ],
  },
  { label: "Money", icon: "money", items: [{ href: "/venue/payments", label: "Payments" }, { href: "/venue/billing", label: "Payouts & fees" }] },
  { label: "Setup", icon: "setup", items: [{ href: "/venue/setup", label: "Checklist" }, { href: "/venue/settings", label: "Settings" }, { href: "/venue/team", label: "Team" }] },
];

// Minimal stroke icon set (currentColor) keyed by name.
function Icon({ name, className = "w-5 h-5" }: { name: IconName; className?: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<IconName, React.ReactNode> = {
    overview: <path d="M3 11l9-8 9 8M5 10v10h14V10" {...common} />,
    venue: <path d="M4 21V9l8-5 8 5v12M9 21v-6h6v6" {...common} />,
    enquiries: <><rect x="3" y="5" width="18" height="14" rx="2" {...common} /><path d="M3 7l9 6 9-6" {...common} /></>,
    weddings: <path d="M12 21s-7-4.5-9.5-9A5 5 0 0112 5a5 5 0 019.5 7C19 16.5 12 21 12 21z" {...common} />,
    calendar: <><rect x="3" y="4" width="18" height="17" rx="2" {...common} /><path d="M3 9h18M8 2v4M16 2v4" {...common} /></>,
    import: <><path d="M12 15V3M7 8l5-5 5 5" {...common} /><path d="M4 21h16" {...common} /></>,
    marketplace: <><path d="M3 7l1-3h16l1 3M4 7v13h16V7M4 7h16" {...common} /><path d="M9 11h6" {...common} /></>,
    vendors: <><circle cx="9" cy="8" r="3" {...common} /><path d="M3.5 20c0-3 2.5-5.5 5.5-5.5S14.5 17 14.5 20" {...common} /><path d="M16 5.5a3 3 0 010 5.8M20.5 20c0-2.4-1.4-4.5-3.5-5.3" {...common} /></>,
    money: <><rect x="3" y="5" width="18" height="14" rx="2" {...common} /><path d="M3 10h18" {...common} /></>,
    setup: <><circle cx="12" cy="12" r="3" {...common} /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" {...common} /></>,
  };
  return <svg viewBox="0 0 24 24" className={className} aria-hidden>{paths[name]}</svg>;
}

export function VenueSidebarNav({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const view = search.get("view");

  // Collapsed: a flat icon rail (top links + one icon per group → its first item).
  if (collapsed) {
    const rail: { href: string; label: string; icon: IconName }[] = [
      ...TOP_LINKS,
      ...GROUPS.map((g) => ({ href: g.items[0].href, label: g.label, icon: g.icon })),
    ];
    return (
      <nav className="flex flex-col items-center gap-1 flex-1">
        {rail.map((it) => {
          const base = it.href.split("?")[0];
          const active = base === "/venue" ? pathname === "/venue" : pathname.startsWith(base);
          return (
            <Link
              key={it.href}
              href={it.href}
              title={it.label}
              aria-label={it.label}
              className="w-11 h-11 flex items-center justify-center rounded-xl transition-colors hover:bg-[color:var(--bone)]"
              style={active ? { background: "var(--cream)", color: "var(--forest)" } : { color: "var(--ink-2)" }}
            >
              <Icon name={it.icon} />
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col flex-1">
      {TOP_LINKS.map((l) => {
        const active = l.href === "/venue" ? pathname === "/venue" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`vy-side-link flex items-center gap-2.5 ${active ? "active" : ""}`}
          >
            <Icon name={l.icon} className="w-[18px] h-[18px] flex-shrink-0" />
            {l.label}
          </Link>
        );
      })}

      {GROUPS.map((g) => {
        const groupActive = g.items.some(
          (i) => pathname === i.href.split("?")[0] || pathname.startsWith(i.href.split("?")[0] + "/")
        );
        return <NavGroup key={g.label} group={g} defaultOpen={groupActive} pathname={pathname} view={view} />;
      })}
    </nav>
  );
}

function NavGroup({
  group, defaultOpen, pathname, view,
}: { group: Group; defaultOpen: boolean; pathname: string; view: string | null }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between vy-eyebrow px-0 py-1.5 hover:text-stone-900 transition-colors"
      >
        <span className="flex items-center gap-2"><Icon name={group.icon} className="w-4 h-4" />{group.label}</span>
        <span className={`text-[10px] transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
      </button>
      {open && (
        <div className="flex flex-col">
          {group.items.map((i) => {
            const base = i.href.split("?")[0];
            const active = pathname === base || pathname.startsWith(base + "/");
            return (
              <div key={i.href}>
                <Link
                  href={i.href}
                  className={`vy-side-link ${active && !i.children ? "active" : ""} ${
                    active && i.children ? "font-semibold" : ""
                  }`}
                >
                  {i.label}
                </Link>
                {i.children && active && (
                  <div className="flex flex-col ml-3 border-l border-[color:var(--line)] pl-2">
                    {i.children.map((c) => {
                      const cv = new URL(c.href, "http://x").searchParams.get("view");
                      const cActive = pathname === base && view === cv;
                      return (
                        <Link
                          key={c.href}
                          href={c.href}
                          className={`vy-side-link text-sm ${cActive ? "active" : ""}`}
                        >
                          {c.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
