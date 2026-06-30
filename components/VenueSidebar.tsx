"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/Logo";
import { VenueSidebarNav } from "@/components/VenueSidebarNav";

// Collapsible venue sidebar. Expanded = labelled nav; collapsed = icon rail
// (matches the dashboard mock). Preference persists in localStorage so it
// survives navigation + reloads.
export function VenueSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  // One-time sync of the persisted preference after hydration. Kept in an effect
  // (not a lazy initializer) so server + client first render agree (false),
  // avoiding a hydration mismatch on the sidebar width classes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (localStorage.getItem("vy-sidebar-collapsed") === "1") setCollapsed(true);
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("vy-sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  }

  return (
    <aside className={`vy-sidebar flex flex-col transition-[width] duration-200 ${collapsed ? "w-[76px] p-3" : "w-64 p-5"}`}>
      <div className={`flex items-center mb-1.5 ${collapsed ? "justify-center" : "justify-between"}`}>
        <Link href="/venue" className="flex items-center gap-2.5" title="Venuely">
          <LogoMark size={collapsed ? 36 : 44} />
          {!collapsed && (
            <span className="flex flex-col leading-none">
              <span className="text-2xl font-bold tracking-tight" style={{ color: "var(--poppy)", fontFamily: "'Fraunces', Georgia, serif" }}>
                Venuely.
              </span>
              <span className="text-[10px] tracking-wide" style={{ color: "var(--ink-2)" }}>Weddings Made Easy</span>
            </span>
          )}
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={toggle}
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[color:var(--ink-2)] hover:bg-[color:var(--bone)] transition-colors"
          >
            «
          </button>
        )}
      </div>

      {collapsed && (
        <button
          type="button"
          onClick={toggle}
          title="Expand sidebar"
          aria-label="Expand sidebar"
          className="self-center mb-3 w-9 h-8 rounded-lg flex items-center justify-center text-[color:var(--ink-2)] hover:bg-[color:var(--bone)] transition-colors"
        >
          »
        </button>
      )}

      <VenueSidebarNav collapsed={collapsed} />

      {!collapsed && (
        <button
          type="button"
          onClick={() => { try { window.dispatchEvent(new Event("venuely:start-tour")); } catch {} }}
          className="mt-4 w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-[color:var(--line)] py-2 text-xs font-semibold text-[color:var(--ink-2)] hover:bg-[color:var(--bone)] transition-colors"
          title="Take a guided tour of your dashboard"
        >
          ✨ Take a tour
        </button>
      )}

      <form action="/auth/signout" method="post" className="pt-4 border-t border-[color:var(--line)] mt-4">
        <button
          className={`vy-btn vy-btn-ghost w-full ${collapsed ? "justify-center px-0" : "justify-start"}`}
          title="Sign out"
        >
          {collapsed ? "⎋" : "Sign out"}
        </button>
      </form>
    </aside>
  );
}
