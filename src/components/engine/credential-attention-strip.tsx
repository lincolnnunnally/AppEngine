import type { CredentialAttentionItem } from "@/lib/engine/ecosystem-credential-registry";

// Surfaces the credential registry's open OWNER action items on the ops
// dashboard so a missing/needed key is a visible next step, not something you
// only find by opening /credentials. Server component — receives already-resolved
// items (no secret values, only names/locations/actions). Renders nothing when
// there is nothing owed, so it never adds noise.

const PRIORITY_LABEL: Record<string, string> = {
  blocker: "Blocking",
  recommended: "Recommended",
  optional: "Optional"
};

export function CredentialAttentionStrip({ items }: { items: CredentialAttentionItem[] }) {
  if (items.length === 0) {
    return null;
  }

  const blockers = items.filter((item) => item.priority === "blocker");

  return (
    <section className="panel cred-attention" data-testid="credential-attention">
      <div className="handoff-section-heading">
        <div>
          <p className="eyebrow">Attention</p>
          <h1>Keys &amp; credentials needed</h1>
          <p>
            Owner actions that unblock or improve an app&apos;s login/launch. Manage every key on{" "}
            <a href="/integrations">Integrations &amp; secrets</a>.
          </p>
        </div>
        {blockers.length ? <strong className="cred-attention-count">{blockers.length} blocking</strong> : null}
      </div>

      <ul className="cred-attention-list">
        {items.map((item) => (
          <li key={`${item.slug}:${item.envVar}`} className={`cred-attention-item cred-attention-item--${item.priority}`}>
            <div className="cred-attention-head">
              <span className={`cred-attention-badge cred-attention-badge--${item.priority}`}>
                {PRIORITY_LABEL[item.priority] || item.priority}
              </span>
              <span className="cred-attention-app">{item.appName}</span>
              {item.loginCritical ? <span className="cred-badge cred-badge--login">login</span> : null}
            </div>
            <p className="cred-attention-action">{item.action}</p>
            <div className="cred-attention-meta">
              <code>{item.envVar}</code>
              <span>{item.location}</span>
              <a href="/integrations">Open integrations →</a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
