// ECOSYSTEM AUTH — self-serve password reset (STANDING MODULE, shared by every app).
//
// One deployment on the shared LPL Supabase project serves password reset for the
// whole fleet. It does NOT depend on GoTrue's (rate-limited) built-in SMTP — it mints
// its own single-use token, emails a branded link via Resend, hosts the reset page
// itself, and completes the change with the service role. Any app (Next, Vite, CRA,
// FastAPI frontend) plugs in with just TWO touches:
//   1. a "Forgot password?" control that POSTs {app, email} here (JSON), and
//   2. nothing else — the reset page is served BY this function.
//
// Deployed with verify_jwt:false ON PURPOSE: the reset link is opened straight from an
// email (no Authorization header), so the gateway cannot require a JWT. The security
// boundary is the single-use, hashed, 1-hour token — never the JWT.
//
// Secrets/inputs (already provisioned):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (auto-injected)
//   RESEND_API_KEY                            (supabase secrets set)
//   public.ecosystem_password_resets table + public.ecosystem_get_user_by_email(email)
//
// To onboard a new app: add one line to APP_CONFIG. Nothing else.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const FROM = 'United Under God <no-reply@emails.unitedundergod.org>';
const REPLY_TO = 'support@unitedundergod.org';
const TOKEN_TTL_MIN = 60;
const FUNCTION_PATH = '/functions/v1/ecosystem-auth-reset';

// The ONLY per-app config. name = shown in email + reset page; loginUrl = where the
// "back to sign in" button goes after a successful reset.
const APP_CONFIG: Record<string, { name: string; loginUrl: string }> = {
  'kids-need-dads': { name: 'Kids Need Dads', loginUrl: 'https://kidsneeddad.com' },
  'best-life': { name: 'Best Life', loginUrl: 'https://bestlife.unitedundergod.org' },
  'aligned-souls': { name: 'Aligned Souls', loginUrl: 'https://alignedsouls.unitedundergod.org' },
  'kindred': { name: 'Kindred', loginUrl: 'https://kindred.unitedundergod.org' },
  'laser': { name: 'Laser Engraving', loginUrl: 'https://laser.unitedundergod.org' },
  // Website builder. One app, three front doors — the key picks which brand the
  // customer sees, because a church must never receive an email or a sign-in
  // link that says "AI Website Design".
  'ai-website-design': { name: 'AI Website Design', loginUrl: 'https://ai-website.design/signin' },
  'easypeazy-website': { name: 'Easy Peazy', loginUrl: 'https://my.easypeazy.site/signin' },
  'churchconnect-website': { name: 'ChurchConnect', loginUrl: 'https://my.churchconnect.cloud/signin' },
  'uug-website': { name: 'United Under God', loginUrl: 'https://my.unitedundergod.org/signin' },
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, X-Client-Info, X-Application-Name',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const html = (body: string, status = 200) =>
  new Response(body, { status, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function admin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function sha256Hex(raw: string) {
  const data = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function page(appName: string, inner: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(appName)} — Reset password</title>
<style>
:root{color-scheme:light dark}
*{box-sizing:border-box}
body{margin:0;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:#0f172a;color:#e2e8f0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
.card{width:100%;max-width:420px;background:#1e293b;border:1px solid #334155;border-radius:16px;padding:32px;box-shadow:0 20px 40px rgba(0,0,0,.35)}
h1{font-size:20px;margin:0 0 4px}
p.sub{margin:0 0 20px;color:#94a3b8;font-size:14px}
label{display:block;font-size:13px;color:#cbd5e1;margin:14px 0 6px}
input[type=password]{width:100%;padding:12px 14px;border-radius:10px;border:1px solid #475569;background:#0f172a;color:#f1f5f9;font-size:15px}
button{width:100%;margin-top:20px;padding:12px 14px;border:0;border-radius:10px;background:#f97316;color:#fff;font-size:15px;font-weight:600;cursor:pointer}
button:hover{background:#ea580c}
a.back{display:inline-block;margin-top:18px;color:#f97316;text-decoration:none;font-size:14px}
.err{background:#7f1d1d;color:#fecaca;padding:10px 12px;border-radius:8px;font-size:14px;margin-bottom:12px}
.ok{background:#14532d;color:#bbf7d0;padding:10px 12px;border-radius:8px;font-size:14px;margin-bottom:12px}
</style></head><body><div class="card">${inner}</div></body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });

  const url = new URL(req.url);
  const sb = admin();

  // ---- GET ?selfcheck=1: can this function actually SEND? ----
  //
  // A Resend key that works is not enough — the FROM address's domain must also
  // be verified on the account, and when it isn't, Resend rejects every single
  // message at the API. That failure is completely silent from outside: this
  // function still returns {ok:true} (deliberately, so it can't be used to
  // enumerate accounts), the token row is still written, and the customer just
  // never receives anything. Easy Peazy sent NOTHING for its entire life that
  // way, password resets included, because its sender was on an unverified
  // domain.
  //
  // Since this one function is the reset path for the whole fleet, a bad sender
  // here breaks every app at once. So it checks itself, and reports only
  // status — no key, no secret — which means the PUBLIC fleet-health monitor
  // can probe real credential health without ever holding a credential.
  if (req.method === 'GET' && url.searchParams.get('selfcheck') === '1') {
    const key = Deno.env.get('RESEND_API_KEY') || '';
    const sender = (FROM.match(/<([^>]+)>/)?.[1] || FROM).trim();
    const senderDomain = sender.split('@')[1] || '';
    const out: Record<string, unknown> = {
      ok: false,
      sender,
      senderDomain,
      resendKey: key ? 'set' : 'missing',
      domainVerified: 'unknown',
      apps: Object.keys(APP_CONFIG),
    };
    if (!key) return json(out, 200);
    try {
      const res = await fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!res.ok) {
        out.domainVerified = 'unknown';
        out.detail = `resend ${res.status}`;
        return json(out, 200);
      }
      const body = await res.json();
      const rows: Array<{ name?: string; status?: string }> = body?.data ?? body ?? [];
      const match = rows.find((d) => (d.name || '').toLowerCase() === senderDomain.toLowerCase());
      out.domainVerified = match?.status === 'verified';
      out.ok = out.domainVerified === true;
      if (!out.ok) {
        out.detail = match
          ? `${senderDomain} is ${match.status}, not verified`
          : `${senderDomain} is not on the Resend account — every email from this function is being rejected`;
      }
    } catch (e) {
      out.detail = String((e as Error)?.message || e).slice(0, 200);
    }
    return json(out, 200);
  }

  // ---- GET: render the reset-password form from the email link ----
  if (req.method === 'GET') {
    const token = url.searchParams.get('token') || '';
    const app = url.searchParams.get('app') || '';
    const cfg = APP_CONFIG[app];
    if (!cfg || !token) return html(page('Reset password', `<h1>Invalid link</h1><p class="sub">This password reset link is malformed. Please request a new one.</p>`), 400);
    const row = await validToken(sb, token, app);
    if (!row) {
      return html(page(cfg.name, `<h1>Link expired</h1><p class="sub">This reset link is invalid or has expired. Request a new one from the sign-in page.</p><a class="back" href="${esc(cfg.loginUrl)}">← Back to ${esc(cfg.name)}</a>`), 400);
    }
    return html(page(cfg.name, `
      <h1>Set a new password</h1>
      <p class="sub">${esc(cfg.name)} · ${esc(row.email)}</p>
      <form method="POST" action="${FUNCTION_PATH}">
        <input type="hidden" name="token" value="${esc(token)}">
        <input type="hidden" name="app" value="${esc(app)}">
        <label for="pw">New password</label>
        <input id="pw" name="password" type="password" minlength="8" required placeholder="At least 8 characters">
        <label for="pw2">Confirm password</label>
        <input id="pw2" name="password2" type="password" minlength="8" required placeholder="Re-enter password">
        <button type="submit">Reset password</button>
      </form>`));
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const ctype = req.headers.get('content-type') || '';

  // ---- POST form: complete the password change ----
  if (ctype.includes('application/x-www-form-urlencoded')) {
    const form = await req.formData();
    const token = String(form.get('token') || '');
    const app = String(form.get('app') || '');
    const password = String(form.get('password') || '');
    const password2 = String(form.get('password2') || '');
    const cfg = APP_CONFIG[app] || { name: 'Your account', loginUrl: '/' };
    if (password.length < 8) return html(page(cfg.name, `<div class="err">Password must be at least 8 characters.</div><a class="back" href="javascript:history.back()">← Try again</a>`), 400);
    if (password !== password2) return html(page(cfg.name, `<div class="err">Passwords did not match.</div><a class="back" href="javascript:history.back()">← Try again</a>`), 400);
    const row = await validToken(sb, token, app);
    if (!row) return html(page(cfg.name, `<h1>Link expired</h1><p class="sub">This reset link is invalid or has already been used. Request a new one.</p><a class="back" href="${esc(cfg.loginUrl)}">← Back to ${esc(cfg.name)}</a>`), 400);

    const { error: updErr } = await sb.auth.admin.updateUserById(row.user_id, { password });
    if (updErr) return html(page(cfg.name, `<div class="err">Could not update the password: ${esc(updErr.message)}</div>`), 500);
    await sb.from('ecosystem_password_resets').update({ used_at: new Date().toISOString() }).eq('id', row.id);

    return html(page(cfg.name, `<div class="ok">Your password has been reset.</div><h1>All set</h1><p class="sub">You can now sign in to ${esc(cfg.name)} with your new password.</p><a class="back" href="${esc(cfg.loginUrl)}">Go to ${esc(cfg.name)} →</a>`));
  }

  // ---- POST JSON {app, email}: send the reset email (always non-enumerating) ----
  let payload: { app?: string; email?: string };
  try { payload = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }
  const app = String(payload.app || '');
  const email = String(payload.email || '').trim().toLowerCase();
  const cfg = APP_CONFIG[app];
  if (!cfg) return json({ error: 'Unknown app' }, 400);
  if (!EMAIL_RE.test(email)) return json({ error: 'Please enter a valid email address.' }, 400);

  // Look up the user; never reveal whether they exist.
  const { data: userId } = await sb.rpc('ecosystem_get_user_by_email', { p_email: email });
  if (userId) {
    // Simple throttle: skip if 3+ unused tokens were minted for this email in the last hour.
    const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await sb
      .from('ecosystem_password_resets')
      .select('id', { count: 'exact', head: true })
      .eq('email', email).eq('app', app).is('used_at', null).gte('created_at', sinceIso);
    if ((count ?? 0) < 3) {
      const raw = randomToken();
      const token_hash = await sha256Hex(raw);
      const expires_at = new Date(Date.now() + TOKEN_TTL_MIN * 60 * 1000).toISOString();
      const { error: insErr } = await sb.from('ecosystem_password_resets').insert({
        user_id: userId, app, email, token_hash, expires_at,
      });
      if (!insErr) {
        const link = `${Deno.env.get('SUPABASE_URL')}${FUNCTION_PATH}?token=${raw}&app=${encodeURIComponent(app)}`;
        await sendResetEmail(cfg.name, email, link);
      }
    }
  }
  return json({ ok: true });
});

async function validToken(sb: ReturnType<typeof admin>, rawToken: string, app: string) {
  if (!rawToken) return null;
  const token_hash = await sha256Hex(rawToken);
  const { data } = await sb
    .from('ecosystem_password_resets')
    .select('id, user_id, email, expires_at, used_at, app')
    .eq('token_hash', token_hash).eq('app', app).maybeSingle();
  if (!data) return null;
  if (data.used_at) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return data as { id: string; user_id: string; email: string };
}

async function sendResetEmail(appName: string, to: string, link: string) {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) { console.error('RESEND_API_KEY missing'); return; }
  const subject = `Reset your ${appName} password`;
  const body = `<!doctype html><html><body style="margin:0;background:#f1f5f9;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:14px;padding:32px;border:1px solid #e2e8f0">
<h1 style="font-size:20px;margin:0 0 8px">Reset your ${esc(appName)} password</h1>
<p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 20px">We received a request to reset the password for this account. Click the button below to choose a new password. This link expires in ${TOKEN_TTL_MIN} minutes.</p>
<a href="${link}" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:15px">Reset password</a>
<p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:22px 0 0">If you didn't request this, you can safely ignore this email — your password won't change.</p>
</div></body></html>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html: body, reply_to: REPLY_TO }),
  });
  if (!res.ok) console.error('Resend send failed', res.status, await res.text());
}
