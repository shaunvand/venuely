"use client";

import { useEffect, useRef } from "react";

// No React state — IntersectionObserver toggles the class directly on the DOM node.
// SSR renders the element WITHOUT the reveal class so content is visible if JS fails.
// `useEffect` adds the reveal class, then IO upgrades it to in-view when scrolled into range.
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.add("reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setTimeout(() => el.classList.add("in-view"), delay);
            io.unobserve(el);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);

  return (
    // min-w-0: Reveal blocks sit as grid/flex children all over the landing page —
    // without this, large OS font scaling inflates their min-content width and
    // stretches whole grid columns past the viewport (clipped text on mobile).
    <div ref={ref} className={`min-w-0 ${className}`}>
      {children}
    </div>
  );
}
