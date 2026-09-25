-- Migration 004: User accounts (Phase 4)
-- Run once against your Postgres database.  Safe to re-run: uses IF NOT EXISTS.
--
-- Registration always creates is_admin = FALSE.  There is no self-serve
-- promotion route — promote your own account by hand after registering:
--
--   UPDATE users SET is_admin = TRUE WHERE LOWER(email) = 'you@example.com';

CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR UNIQUE NOT NULL,
    username      VARCHAR UNIQUE NOT NULL,
    password_hash VARCHAR NOT NULL,
    display_name  VARCHAR,
    is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMP DEFAULT NOW()
);

-- Login looks up by LOWER(email); these also enforce that two accounts can't
-- differ only by case.  The register route relies on the 23505 violation from
-- these indexes rather than a check-then-insert race.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower    ON users (LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));
