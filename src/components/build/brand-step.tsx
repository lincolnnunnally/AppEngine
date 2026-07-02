"use client";

// "Make it yours" step in the build flow: an optional brand color + logo. A
// non-technical person taps a swatch (or picks any color); leaving it on "Auto"
// keeps the theme's color and auto-generates a simple monogram logo from the app name.
const PRESETS = ["#127c73", "#2563eb", "#4f46e5", "#7c3aed", "#e11d48", "#f26a4b", "#e6a93a", "#1e9e6a"];

export function BrandStep({
  accentColor,
  logoUrl,
  onAccent,
  onLogo
}: {
  accentColor: string;
  logoUrl: string;
  onAccent: (value: string) => void;
  onLogo: (value: string) => void;
}) {
  return (
    <div className="brand-step">
      <p className="eyebrow">Make it yours (optional)</p>
      <div className="brand-colors">
        <button
          type="button"
          className={`brand-swatch brand-swatch--auto${accentColor ? "" : " brand-swatch--selected"}`}
          onClick={() => onAccent("")}
        >
          Auto
        </button>
        {PRESETS.map((color) => (
          <button
            type="button"
            key={color}
            className={`brand-swatch${accentColor.toLowerCase() === color ? " brand-swatch--selected" : ""}`}
            style={{ background: color }}
            onClick={() => onAccent(color)}
            aria-label={`Brand color ${color}`}
          />
        ))}
        <label className="brand-swatch brand-swatch--custom" title="Pick any color">
          <input
            type="color"
            value={accentColor || "#127c73"}
            onChange={(event) => onAccent(event.target.value)}
            aria-label="Pick a custom brand color"
          />
        </label>
      </div>
      <input
        className="convo-input"
        value={logoUrl}
        placeholder="Logo image URL (optional) — leave blank for an auto logo"
        onChange={(event) => onLogo(event.target.value)}
        aria-label="Logo image URL"
      />
    </div>
  );
}
