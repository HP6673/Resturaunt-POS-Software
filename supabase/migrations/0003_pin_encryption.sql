-- Switches staff PIN storage from a one-way bcrypt hash to reversible
-- encryption (AES-256-GCM, encrypted/decrypted in the Next.js server code —
-- see src/lib/pinCrypto.ts) so admins can view an employee's current PIN.
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- IMPORTANT: existing bcrypt hashes cannot be decrypted (that's the whole
-- point of a one-way hash). After running this, every existing employee's
-- PIN must be reset once (via the "Reset PIN" button on /admin/staff) before
-- it'll show correctly and before they can log in with it again.

alter table staff rename column pin_hash to pin_encrypted;
