/**
 * Creates an owner account in Supabase Auth + promotes profiles.role.
 * Reads .env.local privately; only prints the new credentials.
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function loadEnv(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i === -1) continue;
    const key = trimmed.slice(0, i).trim();
    let val = trimmed.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

function randomPassword(length = 14) {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = require("crypto").randomBytes(length);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

async function main() {
  const env = loadEnv(path.join(process.cwd(), ".env.local"));
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    console.error("MISSING: NEXT_PUBLIC_SUPABASE_URL in .env.local");
    process.exit(1);
  }
  if (!serviceKey && !anonKey) {
    console.error(
      "MISSING: SUPABASE_SERVICE_ROLE_KEY (preferred) or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
    );
    process.exit(1);
  }

  const email = process.env.OWNER_EMAIL || "owner@fourty.com";
  const password = process.env.OWNER_PASSWORD || randomPassword(14);
  const fullName = process.env.OWNER_NAME || "Fourty Owner";

  if (serviceKey) {
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: "owner" },
    });

    if (error) {
      // If user already exists, try to update password + role
      if (/already|registered|exists/i.test(error.message)) {
        const { data: list, error: listErr } =
          await admin.auth.admin.listUsers({ perPage: 200 });
        if (listErr) {
          console.error("CREATE_FAILED:", error.message);
          process.exit(1);
        }
        const existing = list.users.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase()
        );
        if (!existing) {
          console.error("CREATE_FAILED:", error.message);
          process.exit(1);
        }
        const { error: updErr } = await admin.auth.admin.updateUserById(
          existing.id,
          {
            password,
            email_confirm: true,
            user_metadata: { full_name: fullName, role: "owner" },
          }
        );
        if (updErr) {
          console.error("UPDATE_FAILED:", updErr.message);
          process.exit(1);
        }
        const { error: roleErr } = await admin
          .from("profiles")
          .update({ role: "owner", full_name: fullName, is_active: true })
          .eq("id", existing.id);
        if (roleErr) {
          console.error(
            "PROFILE_UPDATE_FAILED:",
            roleErr.message,
            "\nRun SQL: update public.profiles set role='owner' where email='" +
              email +
              "';"
          );
          process.exit(1);
        }
        console.log("STATUS=updated_existing");
        console.log("EMAIL=" + email);
        console.log("PASSWORD=" + password);
        console.log("ROLE=owner");
        return;
      }
      console.error("CREATE_FAILED:", error.message);
      process.exit(1);
    }

    const userId = data.user.id;
    // Trigger may have created profile; ensure owner role
    await new Promise((r) => setTimeout(r, 500));
    const { error: roleErr } = await admin.from("profiles").upsert(
      {
        id: userId,
        email,
        full_name: fullName,
        role: "owner",
        is_active: true,
      },
      { onConflict: "id" }
    );

    if (roleErr) {
      console.error(
        "USER_CREATED_BUT_PROFILE_FAILED:",
        roleErr.message,
        "\nRun SQL: update public.profiles set role='owner' where id='" +
          userId +
          "';"
      );
      console.log("EMAIL=" + email);
      console.log("PASSWORD=" + password);
      process.exit(1);
    }

    console.log("STATUS=created");
    console.log("EMAIL=" + email);
    console.log("PASSWORD=" + password);
    console.log("ROLE=owner");
    return;
  }

  // Fallback: public signUp (needs email confirm disabled or auto-confirm)
  const client = createClient(url, anonKey);
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, role: "owner" } },
  });
  if (error) {
    console.error("SIGNUP_FAILED:", error.message);
    console.error(
      "Add SUPABASE_SERVICE_ROLE_KEY to .env.local for reliable owner creation."
    );
    process.exit(1);
  }
  console.log("STATUS=signed_up_via_anon");
  console.log("EMAIL=" + email);
  console.log("PASSWORD=" + password);
  console.log("ROLE=pending_sql_promote");
  console.log(
    "NOTE=Promote with SQL: update public.profiles set role='owner' where email='" +
      email +
      "';"
  );
  if (data.user?.id) console.log("USER_ID=" + data.user.id);
}

main().catch((e) => {
  console.error("ERROR:", e.message || e);
  process.exit(1);
});
