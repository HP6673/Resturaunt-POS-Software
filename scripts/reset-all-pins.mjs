// One-time recovery script: resets every existing staff member's PIN directly
// against the database (bypassing the app's login entirely). Needed because
// after running migration 0003_pin_encryption.sql, old bcrypt-hashed PINs
// can't be decrypted, so nobody — including admins — can log in to use the
// in-app "Reset PIN" button. This script gets you back in.
//
// Run after configuring .env.local (with the real PIN_ENCRYPTION_KEY you set
// in Vercel too):
//   node --env-file=.env.local scripts/reset-all-pins.mjs
//
// The first admin-role account found is set to PIN 786819. Every other
// account gets a random unique 6-digit PIN, printed below — write these down
// and hand them out, then have each person change theirs via /admin/staff.

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const pinKey = process.env.PIN_ENCRYPTION_KEY;

if (!url || !serviceRoleKey || !pinKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or PIN_ENCRYPTION_KEY.\n" +
      "Run with: node --env-file=.env.local scripts/reset-all-pins.mjs",
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

function randomSixDigitPin(taken) {
  let pin;
  do {
    pin = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  } while (taken.has(pin));
  return pin;
}

const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

const { data: staff, error } = await admin.from("staff").select("id, name, role").order("created_at");
if (error) {
  console.error("Failed to fetch staff:", error.message);
  process.exit(1);
}
if (!staff || staff.length === 0) {
  console.log("No staff rows found — nothing to reset. Use scripts/seed-staff.mjs to create demo logins.");
  process.exit(0);
}

const ADMIN_PIN = "786819";
const usedPins = new Set([ADMIN_PIN]);
let adminAssigned = false;
const results = [];

for (const person of staff) {
  let pin;
  if (person.role === "admin" && !adminAssigned) {
    pin = ADMIN_PIN;
    adminAssigned = true;
  } else {
    pin = randomSixDigitPin(usedPins);
    usedPins.add(pin);
  }

  const { error: updateError } = await admin
    .from("staff")
    .update({ pin_encrypted: encryptPin(pin) })
    .eq("id", person.id);

  if (updateError) {
    console.error(`Failed to reset PIN for "${person.name}":`, updateError.message);
    process.exit(1);
  }
  results.push({ name: person.name, role: person.role, pin });
}

console.log("\nNew PINs — write these down now, they won't be shown again by this script:\n");
for (const r of results) {
  console.log(`  ${r.name} (${r.role}): ${r.pin}`);
}
console.log("\nDone. Log in with these, then change any you want via /admin/staff.");
