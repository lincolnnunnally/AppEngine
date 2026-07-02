"use client";

import { useEffect, useState } from "react";

// "Your keys" — the user's environment vault. Add a key once and every app they
// build gets it automatically; scope a key to one app to override just that app.
// Values are write-only: shown never, replaced any time.
type Entry = { key: string; appScope: string; updatedAt: string | null };
type CatalogItem = { key: string; usedFor: string; whereToFind: string };
type AppOption = { label: string; slug: string };

export function EnvVault({ apps }: { apps: AppOption[] }) {
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

  async function save() {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/account/env", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: activeKey, value, appScope })
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      setNotice(data.message || (data.ok ? "Saved." : "Couldn't save that key."));
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

  async function importBulk(content: string) {
    if (!content.trim()) return;
    setBusy(true);
    setBulkNotice(null);
    setBulkSkipped([]);
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
      };
      setBulkNotice(data.message || (data.ok ? "Imported." : "Couldn't import that."));
      setBulkSkipped(data.skipped || []);
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
            onChange={(event) => setSelectedKey(event.target.value)}
            disabled={busy}
            aria-label="Which key are you adding?"
          >
            <option value="">Which key are you adding?</option>
            {catalog.map((item) => (
              <option key={item.key} value={item.key}>{item.key} — {item.usedFor}</option>
            ))}
            <option value="custom">Something else (custom key)</option>
          </select>
          {selectedKey === "custom" ? (
            <input
              className="convo-input"
              value={customKey}
              placeholder="MY_API_KEY"
              onChange={(event) => setCustomKey(event.target.value.toUpperCase())}
              disabled={busy}
              aria-label="Custom key name"
            />
          ) : null}
        </div>

        {help ? (
          <p className="env-vault-help">
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
          {apps.length > 0 ? (
            <select
              className="convo-input env-vault-select"
              value={appScope}
              onChange={(event) => setAppScope(event.target.value)}
              disabled={busy}
              aria-label="Which apps use this key?"
            >
              <option value="">All my apps</option>
              {apps.map((app) => (
                <option key={app.slug} value={app.slug}>Only: {app.label}</option>
              ))}
            </select>
          ) : null}
        </div>

        <button
          type="button"
          className="soft-launch-action"
          onClick={save}
          disabled={busy || !activeKey.trim() || !value.trim()}
        >
          {busy ? "Saving…" : "Save key"}
        </button>
        {notice ? <p className="note">{notice}</p> : null}
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
        <ul className="env-vault-list">
          {entries.map((entry) => (
            <li className="env-vault-item" key={`${entry.key}:${entry.appScope}`}>
              <code>{entry.key}</code>
              <span className="env-vault-scope">{entry.appScope ? `Only ${appLabel(entry.appScope)}` : "All apps"}</span>
              <span className="env-vault-secret">••••••••</span>
              <button type="button" className="account-link-button" onClick={() => remove(entry)} disabled={busy}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="account-app-meta">No keys saved yet. Keys you add here are applied to your apps automatically on their next build or update.</p>
      )}
    </div>
  );
}
