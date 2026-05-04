-- ============================================
-- Password Version — JWT Revocation on Password Change
-- Purpose: Invalidate stale JWTs when a user changes their password
-- Created: 2026-05-04
--
-- WHY THIS EXISTS:
-- NextAuth uses stateless JWTs with a 30-day lifetime. When a user changes
-- their password, the old hash is replaced in the DB, but any JWT minted
-- before the change is still cryptographically valid for up to 30 days on
-- other devices/browsers. This is a real security risk: a compromised
-- session cookie cannot be revoked just by rotating the password.
--
-- HOW IT WORKS:
-- 1. Each user row carries a `password_version` integer (starts at 1).
-- 2. At login, NextAuth reads the current `password_version` and embeds it
--    in the issued JWT as `token.passwordVersion`.
-- 3. On every session callback, NextAuth re-reads the current value from
--    the DB and compares it against the value baked into the JWT. If they
--    differ → the password has been changed since the token was issued →
--    the session is invalidated and the user is forced to re-login.
-- 4. The `/api/user/change-password` endpoint bumps the counter
--    (`password_version = password_version + 1`) inside the same UPDATE
--    that sets the new `password_hash`, so all existing JWTs for the user
--    immediately become stale.
--
-- BACKWARD COMPATIBILITY:
-- Tokens minted BEFORE this migration was deployed have no
-- `passwordVersion` claim. The session callback treats a missing claim as
-- "legacy token" and lets it through (no force-logout) — only mismatched
-- versions are rejected. New logins after the deploy carry the claim.
-- ============================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_version INT NOT NULL DEFAULT 1;

COMMENT ON COLUMN users.password_version IS
  'Incremented every time the user changes their password. Used by NextAuth session callback to revoke stale JWTs minted before the most recent password change.';
