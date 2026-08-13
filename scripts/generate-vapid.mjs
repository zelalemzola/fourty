/**
 * Generate VAPID keys for web push.
 * Usage: node scripts/generate-vapid.mjs
 * Copy the printed values into .env.local
 */
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();

console.log(`
Add these to .env.local:

NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}
VAPID_PRIVATE_KEY=${keys.privateKey}
VAPID_SUBJECT=mailto:owner@fourty.local
`);
