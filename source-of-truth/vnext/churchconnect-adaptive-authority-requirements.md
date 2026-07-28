# ChurchConnect — Adaptive & Authority Requirements

**Date:** 2026-07-28  
**Source:** Owner conversation with Grok (Lincoln Nunnally)  
**Status:** Locked product direction — implement in ChurchConnect track  
**Audience:** Grok Build, Claude Code, ChurchConnect implementers

---

## Core Principle

The tool must help a church run *their* way. Software adapts to the people and roles, not the other way around.

---

## Three Layers

### 1. Personal layer (private to each user)

- Layout changes, dashboard customizations, sidebar pins, language/tone adjustments, and focus refinements belong **only to that user**.
- One user’s changes never affect anyone else in the organization.
- Strong undo / reset-to-previous is required so people feel safe experimenting.

### 2. Organizational / Role Focus layer

Admins can assign or offer starting focuses (role templates). Examples:

- Administrative assistant
- New member / first contact
- Community Pastor / relational outreach
- Donation recording
- Financial / bill pay
- Maintenance / facilities (janitor)

These are helpful starting points only. Individuals can still personalize on top of them.

### 3. Authority & permission boundaries (admin-controlled)

Access is role-based and consent-based.

**Examples given by owner:**

- A Sunday school teacher does **not** see finances or individual donation records.
- If that same person is also on the Finance Committee → limited **read** access, no changes.
- If they also hold Financial Secretary (or check-signing) authority → the higher access required for that responsibility.
- The janitor gets a login that allows time clock + viewing maintenance tickets relevant to them — nothing more.

Authority must live in the right place. The janitor must not have access to everything, but must be able to clock time and act on facilities tickets.

---

## Maintenance Ticket + QR Flow

- QR codes can be placed on toilet-paper dispensers, soap dispensers, bathrooms, etc.
- Anyone (member or visitor) can scan and submit a ticket (examples: trash is full, paper towels need replenishing, toilet is clogged).
- The facilities / janitor role sees those tickets in their focused view and can act on them.
- Time clock is available for that role.

---

## Progressive Adaptation (no heavy front-loaded onboarding)

- Ship with good usable defaults so people can start working immediately.
- Users reshape the tool while they use it, not through a long initial questionnaire.
- A lightweight assistant + familiar drag-and-drop let them reshape pages, layouts, and menus in the moment:
  - “I only work with first-time guests — customize my dashboard.”
  - “This workflow has a step I don’t need — remove it.”
  - “Put this portion in the sidebar so I can access it directly.”
- Every page and every major layout should be adjustable (not just the menu bar).
- The system quietly learns usage patterns (anonymized / aggregated) and improves the starting focuses and defaults offered to **new** organizations and to existing users who choose them.
- Existing users are never forced onto new layouts.

---

## Reliability Requirement

- Changes must be consistent and reversible.
- The tool must actually deliver what it promises so people are not left frustrated the way many current “vibe coding” tools leave them.

---

## Implementation Notes for ChurchConnect Track

These requirements should be treated as active product direction for ChurchConnect.  
They expand on the existing staff authentication, Connection Inbox / follow-up, and role concepts already in the system.

Key implementation concerns:

1. Personal customizations must be stored and applied per-user (not org-wide).
2. Role/permission matrix must be enforceable at both data and UI layers.
3. Admin UI for defining roles, consent boundaries, and assigning focuses.
4. QR ticket intake + facilities role view + time clock.
5. Undo stack and safe experimentation on layouts.
6. Aggregate learning that improves future default focuses without leaking private layouts.

---

*Captured from the 2026-07-28 conversation so Grok Build and the ChurchConnect track have a durable record.*
