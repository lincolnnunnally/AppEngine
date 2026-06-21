Prior-Work Check

Run: ChurchConnect Visitor Capture (run-001-2026-06-21-churchconnect-visitor-capture-cycle-1)
Target repo: ChurchConnect -> ../../ChurchConnect/ChurchConnect
Verdict: extend_existing
Authorizes: vnext_packet
Proceed: yes
Why: Prior work exists in the target repo; extend the existing surfaces with a vNext/repair packet instead of building parallel ones.

Extend these existing surfaces (do not rebuild):
- visitor-capture-form: component src/components/VisitorRegistration.tsx [reads church_guests]
- admin-follow-up-list: component src/components/ConnectionInbox.tsx [reads connection_inbox]
- admin-follow-up-list: component src/components/ConnectionCards.tsx [reads connection_cards]
- persistent-follow-up-state: migration supabase/migrations (connection_cards)

Findings to fix while extending:
- table_split (admin-follow-up-list): Admin/data surfaces read different tables (connection_inbox vs connection_cards); reconcile to one canonical table in the follow-up migration before extending.

Blocked side doors:
- component:NewVisitorCaptureForm duplicates src/components/VisitorRegistration.tsx
- component:VisitorAdminDashboard duplicates src/components/ConnectionInbox.tsx
- table:visitor_submissions duplicates supabase/migrations

Guardrails: read-only, no migrations executed, no deploy, no paid resources.
