-- Migration 010: make the account nickname optional
--
-- An account's `name` is now just an optional nickname; when absent the UI falls
-- back to the account `type` (e.g. "TFSA"). Either the nickname or the type must
-- be present — that's enforced in the route, not the schema.
--
-- The unique index on (user_id, LOWER(name)) still applies to named accounts;
-- NULL names are distinct in a UNIQUE index, so a user may have several unnamed
-- accounts (each shown by its type).
--
-- Re-runnable: DROP NOT NULL is a no-op once the column is already nullable.

ALTER TABLE accounts ALTER COLUMN name DROP NOT NULL;
