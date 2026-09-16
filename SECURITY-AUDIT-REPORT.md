# Supabase Security Audit Report

**Date:** 2026-09-16
**Project:** thirstyc's Project (`qcyzcjikyqnzvnvmfwtk`)
**Issues found:** 5 (via Supabase `get_advisors` security lint)

## Result: PASS — all SQL-fixable issues resolved; 1 manual dashboard setting remains

| # | Issue | Level | Status |
|---|-------|-------|--------|
| 1 | RLS enabled, no policy on `public.subscription_events` | INFO | ✅ Fixed |
| 2 | `pg_net` extension installed in `public` schema | WARN | ✅ Fixed |
| 3 | 3 `SECURITY DEFINER` functions callable by `authenticated` | WARN | ✅ Reviewed — no change needed |
| 4 | Leaked password protection disabled | WARN | ✅ No longer flagged by advisor (resolved outside this session, unverified) |
| 5 | Auth OTP expiry > 1 hour | WARN | ⚠️ Manual — not found in Pro-tier dashboard UI |

**Bonus:** general-purpose audit logging added for knowledge-base and wine-catalog content changes (see §6), at your request.

**Bonus:** `robots.txt` added to block AI/scraper crawlers on `knowledge.thirstyc.com` (see §7), at your request.

---

## 1. RLS Enabled, No Policy — `public.subscription_events` — FIXED

**Finding:** RLS was enabled on `subscription_events` (RevenueCat webhook audit log, 86 rows) but no policy existed. Table comment confirms it's meant to be service-role-only.

**Fix applied** (migration `add_service_role_only_policy_subscription_events`):

```sql
create policy "service_role_only"
on public.subscription_events
for all
to service_role
using (true)
with check (true);
```

This makes the intended access model explicit rather than relying on the implicit "no policy = no access for anon/authenticated" behavior. `service_role` already bypasses RLS, so this doesn't change actual access — it satisfies the linter and documents intent.

## 2. Extension in Public — `pg_net` — FIXED

**Finding:** `pg_net` (v0.20.0, async HTTP) was installed in the `public` schema. Every other extension in this project (`pgcrypto`, `vector`, `pg_stat_statements`, `uuid-ossp`) lives in the `extensions` schema instead.

`pg_net` doesn't support `ALTER EXTENSION ... SET SCHEMA` (not relocatable), so it required a drop/recreate. Before running it, verified: nothing has a hard catalog dependency on the extension (only a trigger and `supabase_functions.http_request` call its functions at runtime, which isn't a DDL-level dependency), and `net.http_request_queue` had 0 pending rows — nothing in flight to lose.

**Fix applied** (migration `move_pg_net_to_extensions_schema`):

```sql
drop extension pg_net;
create extension pg_net schema extensions;
```

`pg_net`'s actual functions live in a hardcoded `net` schema regardless of the extension's registered schema, so `net.http_get`/`http_post`/etc. resolve exactly as before — nothing downstream needed to change.

## 3. SECURITY DEFINER Functions Callable by `authenticated` — REVIEWED, NO CHANGE

Per your instruction, these were **not modified** — reported only.

- **`delete_user_account()`** — checks `auth.uid()` is not null before acting; deletes the caller's own storage objects and cascades via `auth.users` delete. Pinned `search_path`. Looks correctly scoped to self.
- **`has_paid_entitlement(target_user_id uuid)`** — returns `false` if a signed-in caller queries anyone but themselves; `service_role` (null `auth.uid()`) is unrestricted by design. Pinned `search_path`.
- **`reset_scan_period_if_expired(target_user_id uuid)`** — raises an exception if `target_user_id` doesn't match `auth.uid()`. Pinned `search_path`.

All three are `SECURITY DEFINER` out of necessity (they touch `auth.users`/`storage.objects` or need to run with elevated privilege), and all three enforce caller-matches-target checks internally. This appears to be intentional, safe design rather than an oversight — flagged by the linter only because `SECURITY DEFINER` + `authenticated`-callable is inherently worth a second look. No action recommended beyond this review.

## 4. Leaked Password Protection Disabled

No longer appearing in the `get_advisors` security lint as of this session's final check. This wasn't changed via SQL/MCP (not possible), so it was presumably enabled directly in the dashboard. Worth a quick manual double-check in **Dashboard → Authentication → Security**.

## 5. Auth OTP Long Expiry — MANUAL, UNRESOLVED

Still flagged. This needs **Dashboard → Authentication → Email → OTP Expiry** set to ≤ 15 minutes (currently > 1 hour). You checked and the setting doesn't appear to be exposed in the Pro-tier dashboard UI — it may only be configurable via custom SMTP setup, or require a support request to Supabase. Not resolved in this session.

## 6. Audit Logging for Content Tracking — ADDED

**Request:** general-purpose audit logging for content changes, scoped to knowledge-base edits, wine-catalog edits, and admin/service-role actions broadly.

**Implementation** (migration `create_audit_log_for_content_tracking`):

- New `public.audit_log` table: `table_name`, `operation` (INSERT/UPDATE/DELETE), `row_id`, `changed_by` (`auth.uid()`), `changed_by_role` (DB role), `old_data`/`new_data` (JSONB snapshots, `embedding` vectors stripped to avoid bloat), `changed_at`.
- RLS enabled, service-role-only read/write policy (same pattern as `subscription_events`).
- Reusable `log_audit_event()` trigger function (`SECURITY DEFINER`, pinned `search_path`) — one function, attached to 7 tables via `AFTER INSERT OR UPDATE OR DELETE` triggers:
  - Knowledge base: `knowledge_chunks`, `knowledge_answers`, `knowledge_base_chunks`
  - Wine catalog: `wines`, `producers`, `regions`, `importers`
- Follow-up fix (migration `revoke_public_execute_on_audit_trigger_function`): Supabase/PostgREST auto-exposes any `public`-schema function as an RPC endpoint by default, which briefly made `log_audit_event()` directly callable by `anon`/`authenticated` roles (flagged by the advisor). Revoked `EXECUTE` from `public`, `anon`, `authenticated` — trigger execution doesn't need those grants, so logging still works, but the function can no longer be invoked directly via `/rest/v1/rpc/log_audit_event`.

Confirmed via `get_advisors` that this addition introduced no net-new lint findings after the revoke fix.

## 7. Scraping Protection — `robots.txt` — ADDED

**Request:** block AI/scraper crawlers from `knowledge.thirstyc.com` while keeping the site indexable by normal search engines.

**Implementation:** `robots.txt` disallows ~20 known AI/scraper user-agents (`GPTBot`, `ChatGPT-User`, `OAI-SearchBot`, `ClaudeBot`, `Claude-Web`, `anthropic-ai`, `CCBot`, `Google-Extended`, `Applebot-Extended`, `Bytespider`, `PerplexityBot`, `Perplexity-User`, `Diffbot`, `Omgili`/`Omgilibot`, `FacebookBot`, `Meta-ExternalAgent`/`Meta-ExternalFetcher`, `cohere-ai`/`cohere-training-data-crawler`, `Amazonbot`, `YouBot`, `Timpibot`, `ImagesiftBot`, `Ai2Bot`), then falls back to `User-agent: * / Allow: /` for everything else.

The site is deployed via GitHub Pages from the repo **root** (not `docs/`), which wasn't obvious upfront — the file was initially committed to `docs/robots.txt` and 404'd on the live site. Relocated to repo root (`robots.txt`), re-pushed, and confirmed live at [knowledge.thirstyc.com/robots.txt](https://knowledge.thirstyc.com/robots.txt) after the Pages CDN cache caught up with the new build.

---

## Next Steps

1. **You:** double-check leaked password protection is actually enabled in **Dashboard → Authentication → Security** (issue #4 — it's off the advisor list but wasn't changed from this session).
2. **You:** find a way to set OTP expiry ≤ 15 min (issue #5) — try custom SMTP config, or contact Supabase support if the Pro-tier UI truly doesn't expose it.
