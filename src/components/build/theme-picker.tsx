"use client";

import { THEME_OPTIONS } from "@/lib/engine/themes";

// Visual "pick your look" gallery for the build flow. A non-technical person picks
// by sight; the default "Auto-match" lets the engine choose a fitting theme from
// their idea, so doing nothing still yields an intentional look.
export function ThemePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="theme-picker">
      <p className="eyebrow">Choose a look</p>
      <div className="theme-grid">
        <button
          type="button"
          className={`theme-card${value === "auto" ? " theme-card--selected" : ""}`}
          onClick={() => onChange("auto")}
          aria-pressed={value === "auto"}
        >
          <span className="theme-auto-swatch" aria-hidden="true">✦</span>
          <span className="theme-card-name">Auto-match</span>
          <span className="theme-card-desc">We pick a look that fits your idea.</span>
        </button>

        {THEME_OPTIONS.map((theme) => (
          <button
            type="button"
            key={theme.id}
            className={`theme-card${value === theme.id ? " theme-card--selected" : ""}`}
            onClick={() => onChange(theme.id)}
            aria-pressed={value === theme.id}
          >
            <span className="theme-swatch" style={{ background: theme.swatch.paper, borderColor: theme.swatch.line }} aria-hidden="true">
              <span className="theme-swatch-bar" style={{ background: theme.swatch.panel, borderColor: theme.swatch.line }}>
                <span className="theme-swatch-line" style={{ background: theme.swatch.ink }} />
                <span className="theme-swatch-dot" style={{ background: theme.swatch.accent }} />
              </span>
              <span className="theme-swatch-btn" style={{ background: theme.swatch.accent }} />
            </span>
            <span className="theme-card-name">{theme.name}</span>
            <span className="theme-card-desc">{theme.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
