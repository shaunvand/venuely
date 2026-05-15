"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type Item = { href: string; label: string };
type Group = { label: string; items: Item[] };

const GROUPS: Group[] = [
  {
    label: "Get started",
    items: [
      { href: "/venue/weddings", label: "Weddings" },
      { href: "/venue/uploads", label: "Smart Import" },
    ],
  },
  {
    label: "Marketplace",
    items: [
      { href: "/venue/catalogue", label: "Catalogue" },
      { href: "/venue/rentals", label: "Rentals" },
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
  {
    label: "Money",
    items: [{ href: "/venue/payments", label: "Payments" }],
  },
  {
    label: "Setup",
    items: [{ href: "/venue/settings", label: "Settings" }],
  },
];

export function VenueSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col flex-1">
      <div className="vy-side-section">Overview</div>
      <Link
        href="/venue"
        className={`vy-side-link ${pathname === "/venue" ? "font-semibold text-[color:var(--forest)]" : ""}`}
      >
        Overview
      </Link>

      {GROUPS.map((g) => {
        const groupActive = g.items.some((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
        return <NavGroup key={g.label} group={g} defaultOpen={groupActive} pathname={pathname} />;
      })}
    </nav>
  );
}

function NavGroup({ group, defaultOpen, pathname }: { group: Group; defaultOpen: boolean; pathname: string }) {
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
            const active = pathname === i.href || pathname.startsWith(i.href + "/");
            return (
              <Link
                key={i.href}
                href={i.href}
                className={`vy-side-link ${active ? "font-semibold text-[color:var(--forest)]" : ""}`}
              >
                {i.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
