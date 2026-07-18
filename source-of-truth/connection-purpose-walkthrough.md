# Connection Engine — Purpose-Fit Walkthrough

Date: 2026-07-18  
Doctrine: connect around purpose and mutual growth — not pairing lonely people as the fix.

Shared module: `src/lib/engine/modules/connection-engine.ts`  
Companion: `purpose-onboarding.ts` (auto-syncs purpose into `connection_profiles`)

App modes (`CONNECTION_APP_MODE`): `growth` | `dating` | `community`

---

## 1. Kindred Connections (friendship / growth)

**Purpose:** Friends and small groups who help you become someone and walk with others becoming too.

### Happy path
1. **Landing** — purpose-first promise (“Connect by purpose, not photos”).
2. **Onboarding** — motivation favors purpose / community / grow-with-me; loneliness is welcomed with a become-first pause.
3. **Becoming week (7 days)** — Discover locked on purpose; CTAs: journal, Soul Letter, **serve**.
4. **Becoming home** — alignment, readiness, service prescription when lonely 2×/week.
5. **Purpose groups (pods)** — required purpose field; join before heavy 1:1.
6. **Discover** — ranked by purpose + growth goals + values (hobbies last); cards show purpose + growing-toward.
7. **Match detail** — “Why you’d grow together”; shared purpose / complementary growth.
8. **Circle + messages** — accepted connections; Knowing / mediation for depth.
9. **Lonely path** — check-in → friendship nudge + **service event**, not “find another lonely person.”

### Config
- Live app: Kindred-Connection repo (scoring in `backend/core.py`, UI in Discover/Pods/Onboarding).
- Generated apps: `CONNECTION_APP_MODE=growth`, `FEATURE_CONNECTION=true`, `FEATURE_ONBOARDING=true`.

### Pass criteria
- [ ] User cannot create a pod without a purpose.
- [ ] Discover score rises when purpose tokens + growth goals overlap (not only hobbies).
- [ ] Double-lonely week surfaces service prescription (or Becoming card), not only more matches.
- [ ] Sidebar reads Grow → Connect; home is Becoming, not Discover.

---

## 2. Aligned Souls (dating / becoming companions)

**Purpose:** Romantic companions who help you become who God designed you to be — grow, take risks, really live. Golf score: fewest right matches, not activity.

### Happy path
1. **Landing** — companion-for-becoming, not swipe culture.
2. **Onboarding** — purpose, values, growth, faith, love languages, marriage/children gates.
3. **Matches (bull’s-eye)** — small set; **purpose alignment %**; purpose + growth goals on cards.
4. **Honest card** — where you align / where you’ll challenge each other / first questions.
5. **Conversation** — one real connection at a time; reflections teach what makes you feel alive.
6. **Win state** — dating paused when relationship is strong enough (app becomes unnecessary).

### Config
- Live app: `aligned-souls` (`romance_score` purpose-first in `backend/core.py`).
- Generated: `CONNECTION_APP_MODE=dating` + romance gates as app-specific layer on connection-engine.

### Pass criteria
- [ ] Match list never pads with low-confidence hobby-only people.
- [ ] Cards surface purpose and growth before interests.
- [ ] Hard filters (orientation, children conflict, faith band, paused) still gate before score.
- [ ] Empty state points to journal/purpose, not “browse more.”

---

## 3. Community Connections / milstead.us (neighbors)

**Purpose:** Friends around making the community stronger — local belonging and improvement, not loneliness alone.

### Happy path (module + seeds; dedicated milstead frontend may still be thin)
1. **Onboarding** — community / purpose motivations.
2. **Connection home** — lede: neighbors making place stronger (`CONNECTION_APP_MODE=community`).
3. **Purpose groups (seeded)**  
   - Block Party Builders  
   - Cleanup Crew  
   - Prayer Walk Circle  
   - Local Project Partners  
   - Welcome Wagon  
4. **Service events** — park cleanup, meal pack, prayer walk (loneliness → service).
5. **People on a similar path** — neighbors matched by shared local purpose tokens.
6. **Groups before pairs** — join a circle, then one-to-one if needed.

### Config
- `CONNECTION_APP_MODE=community`
- Seeds install milstead-style pods + service events automatically.

### Pass criteria
- [ ] Seed pods all have non-empty `purpose`.
- [ ] Discover ranking prefers purpose overlap with local project language.
- [ ] Loneliness check-in points to community service events.
- [ ] Copy never promises “cure loneliness by pairing strangers” alone.

---

## Cross-app invariants

| Invariant | Implementation |
|-----------|----------------|
| Purpose leads score | purpose tokens ×14, goals ×12, values ×10, interests ×2 |
| Onboarding fills matching profile | `submitOnboarding` upserts `connection_profiles`; `getMyProfile` hydrates from onboarding |
| Groups before pairs | Pods first in UX; required purpose on create |
| Loneliness → service | Check-ins + `getLonelinessPrescription` + RSVP |
| No dating pool in Kindred | Discover forced to friendship / both; romance → Aligned Souls |

---

## Manual walk order (owner or agent)

1. Kindred: register → onboarding (purpose path) → becoming → create purpose group → discover card shows purpose % → lonely check-in twice → prescription/serve path.  
2. Aligned Souls: register → complete purpose + gates → matches show purpose alignment → open card → request conversation.  
3. Community module app: set `CONNECTION_APP_MODE=community` → open `/connection` → join Cleanup Crew or Block Party → check-in lonely ×2 → RSVP service event.

Record gaps as follow-ups; do not invent matches or service events in production without real data.
