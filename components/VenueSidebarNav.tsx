"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

type Item = { href: string; label: string; children?: Item[] };
type Group = { label: string; items: Item[] };

const TOP_LINKS: Item[] = [
  { href: "/venue", label: "Overview" },
  { href: "/venue/your-venue", label: "Your Venue" },
  { href: "/venue/weddings", label: "Weddings" },
  { href: "/venue/uploads", label: "Smart Import" },
];

const GROUPS: Group[] = [
  {
    label: "Marketplace",
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
    ],
  },
  {
    label: "Partner vendors",
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
  { label: "Money", items: [{ href: "/venue/payments", label: "Payments" }] },
  { label: "Setup", items: [{ href: "/venue/settings", label: "Settings" }] },
];

export function VenueSidebarNav() {
  const pathname = usePathname();
  const search = useSearchParams();
  const view = search.get("view");

  return (
    <nav className="flex flex-col flex-1">
      {TOP_LINKS.map((l) => {
        const active = l.href === "/venue" ? pathname === "/venue" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`vy-side-link ${active ? "font-semibold text-[color:var(--forest)]" : ""}`}
          >
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
        <span>{group.label}</span>
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
                  className={`vy-side-link ${active && !i.children ? "font-semibold text-[color:var(--forest)]" : ""} ${
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
                          className={`vy-side-link text-sm ${cActive ? "font-semibold text-[color:var(--forest)]" : ""}`}
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
