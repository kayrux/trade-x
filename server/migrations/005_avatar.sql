-- Migration 005: profile avatar key (Phase 4 follow-up)
-- Run once against your Postgres database.  Safe to re-run: uses IF NOT EXISTS.
--
-- Stores only the avatar KEY (e.g. 'fox'); the SVG art lives in the client
-- bundle.  NULL is the default and renders the fallback 'dog' avatar client-side.
-- Allowed keys are whitelisted in server/src/lib/avatars.js.

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar VARCHAR;
