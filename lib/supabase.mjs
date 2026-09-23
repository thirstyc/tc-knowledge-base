// The service-role client for this repo's write scripts, wrapped so it can
// only reach the tables this pipeline owns.
//
// Service role bypasses RLS, and this repo shares a database with the Thirsty
// Cellar app: user_wines, bottles, cellars, tastings, wishlist, profiles and
// the sommelier/subscription tables all live alongside the knowledge content.
// CLAUDE.md rule 3 lists what is ours and what is off-limits; TABLES below is
// that rule as code, so a script that strays throws instead of writing.
//
// What this does NOT protect against, so nobody mistakes it for a lock:
//   - raw SQL, the Supabase dashboard, the MCP tools, psql -- anything not
//     going through this client
//   - a script that builds its own createClient() instead of importing this
//   - DDL of any kind
// The 2026-09-21 incident was direct DDL in production and this would not have
// stopped it. The durable fix is a dedicated Postgres role for this pipeline,
// granted only on these tables, so the database enforces it rather than a
// JavaScript wrapper. This is the seatbelt in the meantime.

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env and fill it in.'
  );
}

// Verbatim from CLAUDE.md rule 3. Adding to this list means deciding that the
// knowledge pipeline owns another table -- which is a conversation, not a
// convenience.
export const TABLES = Object.freeze([
  'knowledge_chunks',
  'knowledge_base_chunks',
  'knowledge_answers',
  'knowledge_intake',
  'wines',
  'producers',
  'regions',
  'importers',
  'wines_draft',
  'wine_comparisons',
  'wineries',
  'audit_log',
]);

const OWNED = new Set(TABLES);

const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Only .from() is intercepted because only .from() is used -- no .rpc(), no
// .schema(), no raw SQL anywhere in this repo (checked). If a script ever
// needs one of those, it should come through here and get the same treatment,
// not reach around this module.
export const supabase = new Proxy(client, {
  get(target, prop, receiver) {
    if (prop === 'from') {
      return (table) => {
        if (!OWNED.has(table)) {
          throw new Error(
            `Refusing to touch "${table}": the knowledge pipeline does not own it. ` +
              `Owned tables: ${TABLES.join(', ')}. ` +
              `If this is app data (user_wines, bottles, cellars, tastings, wishlist, ` +
              `profiles, sommelier_*, subscription_*), it belongs to tc-cellar-mobile ` +
              `and must not be written from here -- see CLAUDE.md.`
          );
        }
        return target.from(table);
      };
    }
    const value = Reflect.get(target, prop, receiver);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});
