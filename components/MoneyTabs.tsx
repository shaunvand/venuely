import Link from "next/link";

// Shared sub-nav so the two money pages read as ONE "Money" area with two clear
// sub-sections, instead of two unrelated sidebar links a new venue can't tell apart.
const TABS = [
  { key: "payments", label: "Payments", href: "/venue/payments", hint: "What each couple owes you and what they've paid — record payments & send reminders." },
  { key: "payouts", label: "Payouts & fees", href: "/venue/billing", hint: "Your bank account for card payouts, plus Venuely's platform fees." },
] as const;

export function MoneyTabs({ active }: { active: "payments" | "payouts" }) {
  return (
    <div className="space-y-2">
      <div className="vy-eyebrow">Money</div>
      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => {
          const on = t.key === active;
          return (
            <Link
              key={t.key}
              href={t.href}
              title={t.hint}
              className="px-4 py-2 rounded-full text-sm font-medium transition"
              style={{ background: on ? "var(--poppy)" : "#fff", color: on ? "#fff" : "var(--ink)", border: `1px solid ${on ? "var(--poppy)" : "var(--line)"}` }}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
      <p className="text-xs" style={{ color: "var(--ink-2)" }}>{TABS.find((t) => t.key === active)?.hint}</p>
    </div>
  );
}
