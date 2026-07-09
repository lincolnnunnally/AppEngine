"use client";

import { useEffect, useState } from "react";

// "Your keys" — the user's environment vault. Add a key once and every app they
// build gets it automatically; scope a key to one app to override just that app.
// Values are write-only: shown never, replaced any time.
// `home` marks the canonical embed on /integrations (owner); the footer pointer
// to /integrations only renders on other pages, so the home never links to itself.
type Entry = { key: string; appScope: string; updatedAt: string | null };
type CatalogItem = { key: string; usedFor: string; whereToFind: string; scope?: "universal" | "per_app" };
type AppOption = { label: string; slug: string };

export function EnvVault({ apps, home = false }: { apps: AppOption[]; home?: boolean }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [available, setAvailable] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [selectedKey, setSelectedKey] = useState("");
  const [customKey, setCustomKey] = useState("");
  const [value, setValue] = useState("");
  const [appScope, setAppScope] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  async function refresh() {
    try {
      const response = await fetch("/api/account/env");
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        available?: boolean;
        entries?: Entry[];
        catalog?: CatalogItem[];
      };
      if (data.ok) {
        setEntries(data.entries || []);
        setCatalog(data.catalog || []);
        setAvailable(data.available !== false);
      }
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeKey = selectedKey === "custom" ? customKey : selectedKey;
  const help = catalog.find((item) => item.key === selectedKey);
  const universalCatalog = catalog.filter((item) => item.scope !== "per_app");
  const perAppCatalog = catalog.filter((item) => item.scope === "per_app");

  // Picking a known key pre-sets where it applies: universal keys default to
  // "every app"; per-app keys clear the scope so the owner picks the one app.
  function onSelectKey(key: string) {
    setSelectedKey(key);
    const picked = catalog.find((item) => item.key === key);
    if (picked?.scope === "universal") setAppScope("");
    else if (picked?.scope === "per_app") setAppScope("");
  }

  async function save() {
    setBusy(true);
    setNotice(null);
    setWarning(null);
    try {
      const response = await fetch("/api/account/env", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: activeKey, value, appScope })
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string; warning?: string };
      setNotice(data.message || (data.ok ? "Saved." : "Couldn't save that key."));
      setWarning(data.warning || null);
      if (data.ok) {
        setValue("");
        setCustomKey("");
        setSelectedKey("");
        setAppScope("");
        await refresh();
      }
    } catch {
      setNotice("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const [bulkText, setBulkText] = useState("");
  const [bulkNotice, setBulkNotice] = useState<string | null>(null);
  const [bulkSkipped, setBulkSkipped] = useState<Array<{ line: number; reason: string }>>([]);
  const [bulkWarnings, setBulkWarnings] = useState<string[]>([]);

  async function importBulk(content: string) {
    if (!content.trim()) return;
    setBusy(true);
    setBulkNotice(null);
    setBulkSkipped([]);
    setBulkWarnings([]);
    try {
      const response = await fetch("/api/account/env/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content })
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        skipped?: Array<{ line: number; reason: string }>;
        warnings?: string[];
      };
      setBulkNotice(data.message || (data.ok ? "Imported." : "Couldn't import that."));
      setBulkSkipped(data.skipped || []);
      setBulkWarnings(data.warnings || []);
      if (data.ok) {
        setBulkText("");
        await refresh();
      }
    } catch {
      setBulkNotice("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function onFilePicked(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => importBulk(String(reader.result || ""));
    reader.readAsText(file);
    event.target.value = "";
  }

  async function remove(entry: Entry) {
    setBusy(true);
    setNotice(null);
    try {
      await fetch("/api/account/env", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: entry.key, appScope: entry.appScope })
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  function appLabel(slug: string): string {
    return apps.find((app) => app.slug === slug)?.label || slug;
  }

  if (!loaded) {
    return <p className="account-app-meta">Loading your keys…</p>;
  }

  if (!available) {
    return <p className="account-app-meta">Key storage isn't turned on yet — your keys will live here once it is.</p>;
  }

  return (
    <div className="env-vault">
      <div className="env-vault-form">
        <div className="env-vault-row">
          <select
            className="convo-input env-vault-select"
            value={selectedKey}
            onChange={(event) => onSelectKey(event.target.value)}
            disabled={busy}
            aria-label="Which key are you adding?"
          >
            <option value="">Which key are you adding?</option>
            <optgroup label="Universal — set once, used by every app">
              {universalCatalog.map((item) => (
                <option key={item.key} value={item.key}>{item.key} — {item.usedFor}</option>
              ))}
            </optgroup>
            <optgroup label="Per-app — usually different for each app">
              {perAppCatalog.map((item) => (
                <option key={item.key} value={item.key}>{item.key} — {item.usedFor}</option>
              ))}
            </optgroup>
            <option value="custom">Something else — type any key name</option>
          </select>
          {selectedKey === "custom" ? (
            <input
              className="convo-input"
              value={customKey}
              placeholder="e.g. TWILIO_AUTH_TOKEN"
              onChange={(event) => setCustomKey(event.target.value.toUpperCase())}
              disabled={busy}
              aria-label="Custom key name"
            />
          ) : null}
        </div>

        {help ? (
          <p className="env-vault-help">
            <strong>{help.scope === "per_app" ? "Usually per-app." : "Set once for every app."}</strong>{" "}
            <strong>Where to find it:</strong> {help.whereToFind}
          </p>
        ) : null}

        <div className="env-vault-row">
          <input
            className="convo-input"
            type="password"
            value={value}
            placeholder="Paste the value — we store it encrypted and never show it again"
            onChange={(event) => setValue(event.target.value)}
            disabled={busy}
            aria-label="Key value"
          />
        </div>

        {apps.length > 0 ? (
          <div className="env-vault-scope-choose">
            <span className="env-vault-scope-label">Where this key applies:</span>
            <select
              className="convo-input env-vault-select"
              value={appScope}
              onChange={(event) => setAppScope(event.target.value)}
              disabled={busy}
              aria-label="Where this key applies"
            >
              <option value="">Every app (universal — set once)</option>
              {apps.map((app) => (
                <option key={app.slug} value={app.slug}>Just this app: {app.label}</option>
              ))}
            </select>
          </div>
        ) : null}

        <button
          type="button"
          className="soft-launch-action"
          onClick={save}
          disabled={busy || !activeKey.trim() || !value.trim()}
        >
          {busy ? "Saving…" : "Save key"}
        </button>
        {notice ? <p className="note">{notice}</p> : null}
        {warning ? <p className="note env-vault-warning">⚠️ {warning}</p> : null}
        {home ? (
          <p className="env-vault-help">
            Not sure which key an app needs? The app sections further down this page list every key each app needs
            and whether it&apos;s set.
          </p>
        ) : (
          <p className="env-vault-help">
            Not sure which key an app needs, or where it goes?{" "}
            <a href="/integrations">Integrations &amp; secrets</a> lists every key each app needs and whether it&apos;s set.
          </p>
        )}
      </div>

      <details className="env-vault-bulk">
        <summary>Add many at once</summary>
        <p className="env-vault-help">
          Upload a file or paste a list — one key per line as <code>KEY=VALUE</code> or <code>KEY,VALUE</code>.
          Using Excel or Numbers? Export your sheet as CSV first (File → Export To → CSV) with keys in the
          first column and values in the second. An optional third column scopes a key to one app.
        </p>
        <div className="env-vault-row">
          <label className="soft-launch-action env-vault-upload">
            {busy ? "Working…" : "Upload a file (.csv or .env)"}
            <input type="file" accept=".csv,.env,.txt,text/plain,text/csv" onChange={onFilePicked} disabled={busy} hidden />
          </label>
        </div>
        <textarea
          className="convo-input"
          rows={4}
          value={bulkText}
          placeholder={"RESEND_API_KEY=re_123\nSTRIPE_SECRET_KEY,sk_live_456"}
          onChange={(event) => setBulkText(event.target.value)}
          disabled={busy}
          aria-label="Paste keys to import"
        />
        <button
          type="button"
          className="soft-launch-action"
          onClick={() => importBulk(bulkText)}
          disabled={busy || !bulkText.trim()}
        >
          {busy ? "Importing…" : "Import pasted keys"}
        </button>
        {bulkNotice ? <p className="note">{bulkNotice}</p> : null}
        {bulkWarnings.length > 0 ? (
          <ul className="env-vault-skips env-vault-warning">
            {bulkWarnings.slice(0, 8).map((item) => (
              <li key={item}>⚠️ {item}</li>
            ))}
            {bulkWarnings.length > 8 ? <li>…and {bulkWarnings.length - 8} more.</li> : null}
          </ul>
        ) : null}
        {bulkSkipped.length > 0 ? (
          <ul className="env-vault-skips">
            {bulkSkipped.slice(0, 8).map((skip) => (
              <li key={skip.line}>Line {skip.line}: {skip.reason}</li>
            ))}
            {bulkSkipped.length > 8 ? <li>…and {bulkSkipped.length - 8} more.</li> : null}
          </ul>
        ) : null}
      </details>

      {entries.length > 0 ? (
        <div className="env-vault-saved">
          {[
            { heading: "Universal — every app", rows: entries.filter((entry) => !entry.appScope) },
            { heading: "Per-app", rows: entries.filter((entry) => entry.appScope) }
          ]
            .filter((group) => group.rows.length > 0)
            .map((group) => (
              <div key={group.heading} className="env-vault-saved-group">
                <p className="env-vault-saved-heading">{group.heading}</p>
                <ul className="env-vault-list">
                  {group.rows.map((entry) => (
                    <li className="env-vault-item" key={`${entry.key}:${entry.appScope}`}>
                      <code>{entry.key}</code>
                      <span className="env-vault-scope">{entry.appScope ? `Just ${appLabel(entry.appScope)}` : "Every app"}</span>
                      <span className="env-vault-secret">••••••••</span>
                      <button type="button" className="account-link-button" onClick={() => remove(entry)} disabled={busy}>
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      ) : (
        <p className="account-app-meta">No keys saved yet. Keys you add here are applied to your apps automatically on their next build or update.</p>
      )}
    </div>
  );
}
