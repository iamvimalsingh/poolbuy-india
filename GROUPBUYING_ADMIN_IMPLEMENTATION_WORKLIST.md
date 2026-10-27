# GroupBuying / PoolBuy India — Admin Implementation Worklist

**Purpose:** Prepare the admin scope to implement after the currently running MVP execution finishes. This is a backlog and acceptance contract, not permission to interrupt the current run or redeploy production.

## 0. Execution rule

1. Let the current V3.1 + MVP Antigravity run finish and review its actual report first.
2. Inspect the current branch, working tree, latest commit, changed files, tests, admin routes/components, schema/migrations and `MVP.md`.
3. Mark every item below as **Already working / Partial / Missing / Blocked** from evidence. Do not rebuild working features or blindly rerun the entire prompt.
4. Implement only the missing admin work in bounded sub-phases. Preserve the existing Next.js App Router, Tailwind v4 and repository setup. Do not reset the database or delete user data.
5. Supabase has not yet been configured. Local/mock admin tests may run, but remote persistence, RLS and migration execution must remain **NOT VERIFIED** until a real staging project is available.

## 1. Core product contract

- Buyers do **not** create accounts, passwords or customer sessions.
- Buyers join a group with a minimal form; admin controls the operational workflow.
- WhatsApp is the MVP’s manual communication channel. The application opens a pre-filled `wa.me` message; an admin manually sends it and separately marks communication as sent. Do not claim that opening WhatsApp means a message was sent.
- PoolBuy/GroupBuying helps organise demand and connect willing buyers. It does not guarantee a discount or force a purchase. A member can decline a quote or opt out.
- Pool target, quote state, each member’s response, fee status and connection status are separate dimensions. Never compress them into one ambiguous status.
- Proposed fee rule: `max(₹99, 0.10% × owner-approved fee basis)`. Treat this as a proposed operational rule; calculate a suggested fee, show and record the exact disclosed amount before the member opts into paid connection, and let the authorised admin approve/record the applicable basis. Do not silently charge anyone. No payment gateway or automatic collection in this MVP.
- No automated WhatsApp sending, customer login, vendor portal, escrow, wallet, or automatic public creation of unreviewed groups in this MVP.
- Do not support land/real-estate deal pools or turn the product into a legal-services transaction platform.

## 2. Admin navigation and dashboard

Required sections (reuse existing pages/tabs if already present):

1. **Overview** — counts and action queues: draft/review groups, open groups, target-reached groups, waitlist invitations pending, quotes awaiting action, member responses pending, fees pending verification, connections pending, recently completed groups.
2. **Groups** — all groups with search, filters, create/edit/publish/close/archive/restore/clone actions.
3. **Group detail** — tabs: Overview, Members, Waitlist, Quotes, Connection & Fees, Activity History.
4. **Product requests** — review customer-submitted requests and explicitly approve/reject/request information; approval alone must not publish a group.
5. **States & cities** — manage directory and each location’s operational state.
6. **Categories & products** — manage eligible categories/product templates; prohibit excluded categories such as land/real-estate transactions.
7. **Completed & archived** — historical groups, connections and decisions.
8. **Settings** — operational defaults, fee-rule version, message templates, data retention/exports, supported contact details.

Every dashboard metric must come from actual data or be visibly labelled demo data. No fabricated counts.

## 3. Group management (CRUD and lifecycle)

### Admin actions

- Create a draft group with: name/product, category, state, city, locality/PIN requirements if applicable, description, target accepted members, deadline, optional reference/estimated market price, optional indicative group-price estimate, and notes.
- Edit allowed fields while preserving ID and history. All meaningful changes record old/new values, admin, timestamp and reason where appropriate.
- Save draft, submit for review where needed, publish, pause/close, extend deadline, reopen only under explicit rules, clone as a fresh round, complete, archive, restore and soft-delete.
- Permanent deletion only for a dependency-free draft/test record. If members, waitlist entries, quotes, payments/fee records, connection records or audit events exist, block permanent deletion and explain why.
- Search/filter by state, city, category, lifecycle state, deadline, target progress and update date; use pagination.
- A change to target or deadline after people have joined must be auditable and must not silently override accepted-member history.

### Recommended group lifecycle model

Keep a distinct group lifecycle, e.g. `DRAFT`, `PENDING_REVIEW`, `OPEN`, `TARGET_REACHED`, `CONNECTION_IN_PROGRESS`, `COMPLETED`, `CLOSED`, `ARCHIVED`. Map these to legacy database statuses through a reviewed migration/adaptor; do not blindly replace existing enum values or reinterpret legacy `UNLOCKED` as payment accepted.

- `OPEN`: accept joins only while deadline is in the future and capacity remains.
- `TARGET_REACHED`: stop normal joins at the database/RPC level; new interest can enter the waitlist.
- `CONNECTION_IN_PROGRESS`: group remains operational but no new regular join is accepted unless an admin explicitly opens a new round.
- `COMPLETED`: admin confirms the operational connection round is finished; hide from active discovery and retain the detail/history view.
- `ARCHIVED`: administrative visibility state for historical housekeeping, separate from completion. Restore must not automatically republish.
- `CLOSED`: stopped without being represented as a successful completed group.
- Deadline expiry should never depend solely on a cron run to block a join.

## 4. Members tab (group-to-member mapping)

For each member, show only to an authenticated admin:

- Lead/member ID and pool/group ID; buyer sequence number; name; normalized WhatsApp number; join date/time; city inherited from the group; locality/PIN when required; consent flag/time/notice version; selected product/kit if applicable.
- Quote response status and last contact/response timestamps.
- Fee status and manually recorded payment reference/date/verification details.
- Connection status, opt-in/opt-out state, exclusion reason and history.
- Internal admin note with appropriate access protections; do not expose internal notes publicly.

Required controls:

- Search by name/number; filter by response, consent/contact eligibility, fee and connection status; pagination; CSV export for an authorised admin only.
- Change member statuses through validated server APIs, with confirmation for exclusion/payment verification/connection.
- Keep unique membership per group and normalized WhatsApp number. Duplicate joining must return the existing membership result without incrementing the count.
- `DO_NOT_CONTACT` or opt-out must disable WhatsApp contact actions. Do not automatically share phone numbers with other members/vendors without suitable disclosure and consent.
- Never expose all member PII through public APIs, client bundles, public views, logs or metadata.

## 5. Capacity, waitlist and invitation workflow

- `target_members` is the maximum accepted membership for this MVP, unless an explicitly reviewed group setting says otherwise.
- When the group reaches capacity, block new accepted joins transactionally. Concurrent submissions for the last slot must not oversubscribe the group.
- Show the group as full/target reached. Offer a separate waitlist path; waitlisted people do not count toward accepted member totals and have no implied purchase commitment.
- Waitlist is FIFO by server-created `created_at` with a stable tie-breaker (ID/sequence).
- Admin can invite the next eligible waitlisted person, mark invitation date/status, manually record their response and promote only after they accept and an actual capacity slot is available.
- If an accepted member declines, opts out, is excluded, or remains non-responsive beyond an admin-set deadline, admin records the reason and may invite the next waitlisted person. Do not silently auto-promote.
- Waitlist statuses: `WAITING`, `INVITED`, `ACCEPTED_PROMOTION`, `DECLINED`, `EXPIRED`, `PROMOTED`, `REMOVED` (adapt names to existing types if equivalent). Keep waitlist counts separate from accepted member counts.
- Enforce capacity and duplicate rules in database/RPC for live mode; client checks alone are not enough.

## 6. Quotation and price management

Support separate quote records and immutable/recoverable quote history.

- Price type: `ESTIMATED` vs `VENDOR_QUOTED`.
- Track reference/market price separately from proposed group estimate and supplier quotation.
- Vendor quote fields: private vendor/source reference; amount; quote date; valid-until date; currency; exact product/scope; inclusions/exclusions; delivery/installation details if relevant; quantity condition; status; evidence/reference file or secure notes; admin verifier and verification timestamp.
- Quote lifecycle: `NOT_REQUESTED`, `REQUESTED`, `RECEIVED`, `PUBLISHED`, `EXPIRED`, `WITHDRAWN` (or equivalent state mapping).
- Public `ESTIMATED` prices must say they are indicative and may differ. Never label an estimate as a dealer quotation or display unverified savings badges.
- Public vendor quote is only marked quoted/verified when an admin has checked its source and validity. Expired quote must not appear as current.
- Publishing/replacing/withdrawing a quote creates an audit event and may initiate a manual WhatsApp update workflow; it must not silently change each member’s acceptance.
- Pool target reached is not equivalent to discount confirmed, quotation accepted, or purchase commitment.

## 7. Member decision, fee and connection lifecycle

Keep these fields independent for every accepted group member.

### Quote response

`NOT_SENT`, `AWAITING_RESPONSE`, `INTERESTED`, `DECLINED`, `NEEDS_INFORMATION`, `NO_RESPONSE`.

- Admin marks message sent and records response manually.
- `INTERESTED` means the member is interested in proceeding/connecting at the disclosed terms; it is not a binding purchase order.

### Connection fee

Suggested state set: `NOT_APPLICABLE`, `NOT_REQUESTED`, `DISCLOSED_PENDING`, `PAYMENT_REPORTED`, `PAID_VERIFIED`, `WAIVED`, `REFUNDED`, `CANCELLED`.

- Store fee-rule version, approved fee basis, calculated amount, exact amount disclosed, disclosure timestamp/channel, member opt-in, payment reference, claimed payment date, verification status, verified-by admin and verification timestamp.
- Admin may record a payment only after checking it. A screenshot/reference submitted by a customer is not automatically verified.
- `WAIVED` and `REFUNDED` require a reason and audit event.
- Fee calculation suggestion: `max(₹99, 0.10% × approved fee basis)`, rounded using an explicitly documented INR rounding rule; admin confirms the fee basis and final amount. Do not run payment collection in code.
- Member must see the exact fee and terms before agreeing. No surprise compulsory charge after free join.

### Connection status

Suggested states: `NOT_READY`, `OPTED_IN`, `WAITING_FOR_FEE`, `ELIGIBLE_TO_CONNECT`, `CONNECTED`, `OPTED_OUT`, `EXCLUDED`.

- Eligibility should be derived/validated from the required response, consent and fee policy; UI should explain missing conditions.
- Admin manually confirms connection event/date and the method used (e.g. an agreed WhatsApp group invitation or direct introduction).
- Do not expose phone numbers to group participants by default; use an explicit, consented connection workflow.
- Exclusion requires a reason, actor, timestamp and optional re-inclusion path. Preserve historical join and payment records.

## 8. Manual WhatsApp operations

- Build safe templates for group published, target reached, quote available, response reminder, connection fee disclosure, payment instructions, waitlist invitation/promotion, exclusion notice, completion and opt-out confirmation.
- Generate encoded `https://wa.me/91...` URLs from trusted stored phone numbers and selected template; validate target number and template variables on the server.
- The admin button opens WhatsApp manually. It must not claim delivery/read/send automatically.
- After returning, admin may mark `SENT` and record a short result/note. Keep `OPENED`/`LINK_GENERATED` distinct from `SENT`.
- Do not provide a bulk-send feature that simulates automated sending. Official WhatsApp Business API automation is future scope.
- Respect `DO_NOT_CONTACT`, applicable consent and opted-out status for all contact actions.

## 9. Completed, archived and audit history

- Completed groups disappear from active public discovery and normal joining, but remain available in a separate Completed list.
- Archiving is a separate admin action; archived groups appear in Archived. Restoring changes administrative visibility only and does not automatically reopen/publicly republish.
- Clone creates a new draft with a new group ID, fresh counts, members, waitlist, quote status and lifecycle. Do not copy personal data/payments/history into the new round.
- Use soft-delete where dependencies exist. Retain members, quote history, fee records and audit entries under the project’s documented retention policy.
- Audit log should record group creation/edit/publication/close/archive/restore, target/deadline changes, quote operations, member status changes, invitations/promotions, WhatsApp sent confirmation, fee disclosure/payment verification/waiver/refund and connection/exclusion actions. Include actor, event, entity, timestamp and relevant before/after values without unnecessarily duplicating sensitive PII.

## 10. Security, routes and data correctness

- Keep buyer login absent. Admin passkey session remains separate and protected.
- Every `/api/admin/**` read/write verifies the signed admin session server-side; UI hiding is not authorization.
- Validate input and enum transitions server-side; enforce Origin/CSRF protections on state-changing requests; use `Cache-Control: no-store` for leads/admin responses.
- Keep public Supabase reads limited to safe listing columns/views. `pool_leads`, payment records, internal notes, private vendor details, admin secrets and quote evidence must not be publicly queryable.
- Use versioned, additive migrations. Never reset production/staging schema or hard-delete depended-on groups to make tests pass.
- Preserve local demo mode for development if useful, but never report demo/localStorage as persistent live data. Production missing credentials must fail closed. Do not use a demo flag to simulate real payment/member status.
- Ensure export CSV neutralizes formula injection and contains only the filters/columns the admin requested.
- All deletion, fee verification and bulk operations require an explicit confirmation; bulk update must show exactly how many records will change.

## 11. Acceptance tests

1. Create a group draft; edit fields; publish; verify only that city’s approved/open group is listed.
2. Join with a valid number; verify one member and count increment. Repeat the same number: no duplicate and no count increment.
3. Race two joins for the last seat: no oversubscription; one accepted and another waitlisted/rejected with a clear message.
4. Target reached: normal join closes; waitlist is offered and stored separately.
5. Exclude or mark one member declined/no-response; record reason; invite next FIFO waitlist entry; promote only after confirmation and available capacity.
6. Create estimated price; confirm no verified/dealer quote label or unsupported savings. Add a dated vendor quote; publish; expire/withdraw and verify public state updates with history retained.
7. Record each member’s quote response independently. A quote acceptance must not mark a fee paid or a member connected.
8. Calculate suggested fee; disclose exact amount; record opt-in; record reported payment; verify manually; test waived/refunded paths only with reason and audit event.
9. WhatsApp action opens a correctly encoded pre-filled message for an eligible opted-in member; `DO_NOT_CONTACT` disables it. Link-opened and message-sent statuses stay separate.
10. Complete the group; confirm it disappears from active listing and appears in Completed. Archive; confirm it appears in Archived. Restore must not automatically publish it.
11. Confirm public/anonymous calls cannot read leads, member phone lists, internal notes, fee/payment records or private vendor details; unauthenticated admin API calls fail.
12. Verify all admin mutations create audit events and are resilient to validation errors/repeated clicks.
13. Run `npm run lint`, `npx tsc --noEmit`, `npm test`, all maintained scenario tests, and `npm run build`. Execute browser checks at desktop and mobile widths. Document anything not actually run.
14. After local gates pass, commit and push only the intended feature branch. Report the exact commit/branch and preserve other branches. Do not merge to `main`, deploy, or run remote migrations without owner authorization.

## 12. Recommended implementation order after current MVP run

- **Admin A — Actual-code audit & gap matrix:** compare current implementation against this worklist; output Already working / Partial / Missing / Blocked. No destructive edits.
- **Admin B — Group CRUD and lifecycle:** create/edit/publish/close/complete/archive/restore/clone/delete guards; lifecycle mapping and tests.
- **Admin C — Members and waitlist:** group-to-member mapping, capacity enforcement, FIFO waitlist, promotion/exclusion and duplicate protection.
- **Admin D — Quotes and manual member responses:** estimated-vs-vendor quote, validity/history, response tracking and clear public state.
- **Admin E — Fee and connection operations:** disclosure, fee suggestion and manual payment verification, member connection/opt-out/exclusion states.
- **Admin F — WhatsApp, exports, audit history and security:** safe prefill templates, manual sent log, CSV, complete authorization/privacy test.
- **Admin G — End-to-end QA and release gate:** full workflow test, final documentation, Git commit/push. Remote Supabase gate stays blocked until project credentials are provided and actual staging tests pass.

**Stop condition:** do not start these admin implementation phases until the currently running MVP prompt finishes and its report has been reviewed.
