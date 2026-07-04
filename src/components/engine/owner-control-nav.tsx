"use client";

import { useEffect, useState } from "react";

// A sticky jump-menu for the owner control center — the page is long, so this
// lets Lincoln land on the section he wants instead of scrolling past everything.
// Clicking a link jumps to that section (native anchor + scroll-margin in CSS);
// a scroll-spy highlights whichever section is currently in view so it always
// says where you are.
export type OwnerControlSection = { id: string; label: string };

export function OwnerControlNav({ sections }: { sections: OwnerControlSection[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    const targets = sections
      .map((section) => document.getElementById(section.id))
      .filter((element): element is HTMLElement => Boolean(element));
    if (!targets.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible?.target?.id) setActive(visible.target.id);
      },
      // Trigger when a section reaches the upper third, below the sticky nav.
      { rootMargin: "-96px 0px -60% 0px", threshold: 0 }
    );
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [sections]);

  if (sections.length < 2) return null;

  return (
    <nav className="owner-control-nav" aria-label="Jump to a section">
      {sections.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          // Highlight on click for instant feedback; the scroll-spy above then
          // keeps it in sync as the owner scrolls (and covers keyboard/manual
          // scrolling). Either alone keeps the active state correct.
          onClick={() => setActive(section.id)}
          className={`owner-control-nav-link${active === section.id ? " active" : ""}`}
          aria-current={active === section.id ? "true" : undefined}
        >
          {section.label}
        </a>
      ))}
    </nav>
  );
}
