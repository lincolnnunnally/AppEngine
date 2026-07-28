// growth-loop — the detection engine that turns telemetry into work.
//
// This is the only home of the growth rules. It lives here, rather than in the
// CI job that files the issues, for one reason: the AppEngine repo is public,
// and reaching lpl_events needs the service-role key. Inside a Supabase function
// that key is ambient; in a public repo's Actions secrets it would be the
// highest-privilege credential in the ecosystem sitting in the riskiest place.
//
// So CI holds only GROWTH_LOOP_SECRET, which opens exactly this endpoint and
// nothing else, and the database credential never leaves Supabase.
//
//   POST /growth-loop  { "mode": "analyze" }   -> findings, writes nothing
//   POST /growth-loop  { "mode": "run" }       -> persists, returns unfiled ones
//   POST /growth-loop  { "mode": "mark_filed", "id": 12, "url": "..." }
//
// Header: x-growth-secret: <GROWTH_LOOP_SECRET>

import { createClient } from 'jsr:@supabase/supabase-js@2';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const SECRET = Deno.env.get('GROWTH_LOOP_SECRET');

// An app is not judged until it has been measured for a full week. Without this
// every app looks dead the day telemetry ships, and the first run files one
// meaningless "no visitors" issue per repo.
const MIN_MEASURED_DAYS = 7;
const MIN_VISITORS_FOR_RATE = 30;
const MIN_VISITORS_FOR_REGRESSION = 50;
const SIGNUP_RATE_FLOOR = 0.02;
const ACTIVATION_RATE_FLOOR = 0.4;
const REGRESSION_DROP = 0.4;
const MIN_SIGNUPS_FOR_ACTIVATION = 10;

type Health = {
  app_slug: string;
  display_name: string;
  prod_url: string;
  repo: string | null;
  is_commercial: boolean;
  activation_event: string | null;
  measured_days: number;
  visitors_7d: number;
  visitors_prev_7d: number;
  signups_7d: number;
  activated_7d: number;
  signup_rate_7d: number | null;
  activation_rate_7d: number | null;
};

type Finding = {
  app_slug: string;
  repo: string | null;
  is_commercial: boolean;
  kind: string;
  severity: string;
  title: string;
  fingerprint: string;
  evidence: Record<string, unknown>;
  body: string;
  labels: string[];
};

const pct = (n: number | null) => (n === null ? 'n/a' : `${(n * 100).toFixed(1)}%`);

function detect(app: Health, week: string): Finding[] {
  const out: Finding[] = [];
  const base = {
    app_slug: app.app_slug,
    repo: app.repo,
    is_commercial: app.is_commercial,
  };

  if (app.measured_days < MIN_MEASURED_DAYS) return out;

  // 1. Nobody is arriving. For a commercial app this is the whole problem.
  if (app.visitors_7d === 0) {
    out.push({
      ...base,
      kind: 'zero_traffic',
      severity: app.is_commercial ? 'high' : 'medium',
      title: `${app.display_name}: no visitors in 7 days`,
      // Fingerprinted by week: it can re-raise while still true, never twice
      // in the same week.
      fingerprint: `zero_traffic:${app.app_slug}:${week}`,
      evidence: { visitors_7d: 0, prod_url: app.prod_url, is_commercial: app.is_commercial },
      labels: ['ai:growth'],
      body: [
        `**${app.display_name}** recorded zero visitors in the last 7 days.`,
        ``,
        `- Production URL: ${app.prod_url}`,
        `- Commercial: ${app.is_commercial ? 'yes — this app is meant to earn' : 'no'}`,
        ``,
        `This is an acquisition problem, not a product problem. The app already has`,
        `a sitemap and a robots policy, so the useful next steps create demand`,
        `rather than convert it:`,
        ``,
        `1. Submit the sitemap to Google Search Console for this domain.`,
        `2. Build the programmatic SEO pages this app's own data supports.`,
        `3. Pick the one place these people already gather, and show up there.`,
        ``,
        `_No product change should ship off this issue — there is no traffic yet to measure it against._`,
      ].join('\n'),
    });
    return out; // every rule below needs traffic to mean anything
  }

  // 2. People arrive and leave without signing up.
  if (app.visitors_7d >= MIN_VISITORS_FOR_RATE && (app.signup_rate_7d ?? 0) < SIGNUP_RATE_FLOOR) {
    out.push({
      ...base,
      kind: 'funnel_dropoff',
      severity: app.is_commercial ? 'high' : 'medium',
      title: `${app.display_name}: ${pct(app.signup_rate_7d)} of visitors sign up`,
      fingerprint: `signup_rate:${app.app_slug}:${week}`,
      evidence: {
        visitors_7d: app.visitors_7d,
        signups_7d: app.signups_7d,
        signup_rate_7d: app.signup_rate_7d,
      },
      labels: ['ai:growth', 'ai:plan'],
      body: [
        `**${app.display_name}** converted ${app.signups_7d} of ${app.visitors_7d} visitors`,
        `(${pct(app.signup_rate_7d)}) over the last 7 days.`,
        ``,
        `Traffic is arriving, so this is a product problem and worth fixing. Look at`,
        `the landing page promise, how many fields stand between someone and an`,
        `account, and whether anything of value is visible before the signup wall.`,
        ``,
        `Where visitors actually went:`,
        '```sql',
        `select path, count(distinct anon_id) as visitors`,
        `from lpl_events`,
        `where app_slug = '${app.app_slug}' and event_name = 'page_view'`,
        `  and created_at > now() - interval '7 days'`,
        `group by 1 order by 2 desc;`,
        '```',
      ].join('\n'),
    });
  }

  // 3. People sign up and never reach the thing the app is for.
  if (app.signups_7d >= MIN_SIGNUPS_FOR_ACTIVATION && (app.activation_rate_7d ?? 0) < ACTIVATION_RATE_FLOOR) {
    out.push({
      ...base,
      kind: 'funnel_dropoff',
      severity: 'high',
      title: `${app.display_name}: only ${pct(app.activation_rate_7d)} of signups activate`,
      fingerprint: `activation_rate:${app.app_slug}:${week}`,
      evidence: {
        signups_7d: app.signups_7d,
        activated_7d: app.activated_7d,
        activation_rate_7d: app.activation_rate_7d,
      },
      labels: ['ai:growth', 'ai:plan'],
      body: [
        `**${app.display_name}**: ${app.activated_7d} of ${app.signups_7d} new accounts`,
        `reached \`activated\` (${pct(app.activation_rate_7d)}) in the last 7 days.`,
        ``,
        `People are choosing this app and then not getting the thing it promised —`,
        `the most expensive kind of failure, because the acquisition cost is already`,
        `paid. Focus on the first session: what must be true before the app is`,
        `useful, and how much of that can be removed, pre-filled, or deferred.`,
      ].join('\n'),
    });
  }

  // 4. Something that was working stopped working.
  if (
    app.visitors_prev_7d >= MIN_VISITORS_FOR_REGRESSION &&
    app.visitors_7d < app.visitors_prev_7d * (1 - REGRESSION_DROP)
  ) {
    const drop = 1 - app.visitors_7d / app.visitors_prev_7d;
    out.push({
      ...base,
      kind: 'regression',
      severity: 'high',
      title: `${app.display_name}: traffic down ${pct(drop)} week over week`,
      fingerprint: `traffic_regression:${app.app_slug}:${week}`,
      evidence: { visitors_7d: app.visitors_7d, visitors_prev_7d: app.visitors_prev_7d, drop },
      labels: ['ai:fix', 'ai:monitor'],
      body: [
        `**${app.display_name}** went from ${app.visitors_prev_7d} to ${app.visitors_7d}`,
        `weekly visitors — a ${pct(drop)} drop.`,
        ``,
        `Check cheapest first: a failed or reverted deploy, a broken route, an`,
        `expired domain or certificate, then whatever changed in this app's`,
        `acquisition channel.`,
      ].join('\n'),
    });
  }

  // 5. The loop cannot measure this app properly — a gap in our own setup.
  if (!app.activation_event) {
    out.push({
      ...base,
      kind: 'opportunity',
      severity: 'low',
      title: `${app.display_name}: no activation event defined`,
      fingerprint: `no_activation_event:${app.app_slug}`,
      evidence: { app_slug: app.app_slug },
      labels: ['ai:plan'],
      body: [
        `**${app.display_name}** has traffic but no \`activation_event\` in`,
        `\`lpl_app_registry\`, so the loop can watch people arrive and sign up but`,
        `cannot tell whether the app ever actually worked for them.`,
        ``,
        `Decide the single first action that means this app delivered, call`,
        `\`funnel.activated()\` at that point, and record its name in the registry.`,
      ].join('\n'),
    });
  }

  return out;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  if (!SECRET || req.headers.get('x-growth-secret') !== SECRET) {
    return json({ error: 'forbidden' }, 403);
  }

  const { mode = 'analyze', id, url } = await req.json().catch(() => ({}));

  if (mode === 'mark_filed') {
    if (!id) return json({ error: 'id required' }, 400);
    const { error } = await admin
      .from('lpl_growth_findings')
      .update({ status: 'filed', github_issue_url: url ?? null, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  const { data: health, error } = await admin.from('lpl_app_health').select('*');
  if (error) return json({ error: error.message }, 500);

  const week = new Date().toISOString().slice(0, 10);
  const findings = (health as Health[])
    .flatMap((app) => detect(app, week))
    // Commercial apps first, then by severity: spend the issue budget where a
    // fix can actually turn into money.
    .sort((a, b) => {
      const sev: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return (a.is_commercial ? 0 : 1) - (b.is_commercial ? 0 : 1) || sev[a.severity] - sev[b.severity];
    });

  const summary = {
    apps: health.length,
    measured: (health as Health[]).filter((a) => a.measured_days >= MIN_MEASURED_DAYS).length,
    with_traffic: (health as Health[]).filter((a) => a.visitors_7d > 0).length,
  };

  if (mode === 'analyze') return json({ summary, findings });

  if (mode !== 'run') return json({ error: `unknown mode "${mode}"` }, 400);
  if (findings.length === 0) return json({ summary, findings: [] });

  // The unique index on fingerprint is what makes this safe to run on a
  // schedule: a finding already recorded is ignored, never duplicated.
  const { data: inserted, error: insertError } = await admin
    .from('lpl_growth_findings')
    .upsert(
      findings.map((f) => ({
        app_slug: f.app_slug,
        kind: f.kind,
        severity: f.severity,
        title: f.title,
        evidence: f.evidence,
        fingerprint: f.fingerprint,
        status: 'open',
      })),
      { onConflict: 'fingerprint', ignoreDuplicates: true },
    )
    .select('id, fingerprint');

  if (insertError) return json({ error: insertError.message }, 500);

  // Hand back only what is genuinely new, joined to the text CI needs to file it.
  const byFingerprint = new Map(findings.map((f) => [f.fingerprint, f]));
  const unfiled = (inserted ?? []).map((row) => ({
    id: row.id,
    ...byFingerprint.get(row.fingerprint)!,
  }));

  return json({ summary, findings: unfiled });
});
