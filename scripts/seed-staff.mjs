// One-time setup script: creates the 3 demo staff logins with PINs encrypted
// under this deployment's own PIN_ENCRYPTION_KEY. Needed because, unlike the
// old bcrypt hashes, encrypted PINs can't be baked into schema.sql as static
// values — the encryption key is unique per Supabase project.
//
// Run after configuring .env.local:
//   node --env-file=.env.local scripts/seed-staff.mjs
//
// Safe to re-run: skips any staff row that already exists (by name).

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const pinKey = process.env.PIN_ENCRYPTION_KEY;

if (!url || !serviceRoleKey || !pinKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or PIN_ENCRYPTION_KEY.\n" +
      "Run with: node --env-file=.env.local scripts/seed-staff.mjs",
  );
  process.exit(1);
}

function encryptPin(pin) {
  const key = Buffer.from(pinKey, "hex");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(pin, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(":");
}

const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

const demoStaff = [
  { name: "Manager", role: "admin", pin: "100166" },
  { name: "Server 1", role: "server", pin: "111111" },
  { name: "Kitchen 1", role: "kitchen", pin: "222222" },
];

for (const person of demoStaff) {
  const { data: existing } = await admin.from("staff").select("id").eq("name", person.name).maybeSingle();
  if (existing) {
    console.log(`Skipping "${person.name}" — already exists.`);
    continue;
  }
  const { error } = await admin.from("staff").insert({
    name: person.name,
    role: person.role,
    pin_encrypted: encryptPin(person.pin),
  });
  if (error) {
    console.error(`Failed to insert "${person.name}":`, error.message);
    process.exit(1);
  }
  console.log(`Created "${person.name}" (${person.role}) with PIN ${person.pin}`);
}

console.log("Done. Change these PINs before real use.");
