import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/push";
import type { UserRole } from "@/types/database";

const ROLES: UserRole[] = ["owner", "storekeeper", "subagent"];

type CreateUserBody = {
  email?: string;
  password?: string;
  full_name?: string;
  phone?: string | null;
  role?: UserRole;
  store_id?: string | null;
  is_active?: boolean;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: actor, error: actorError } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", user.id)
      .single();

    if (actorError || !actor || actor.role !== "owner") {
      return NextResponse.json(
        { error: "Only owners can create team accounts" },
        { status: 403 }
      );
    }

    const body = (await request.json()) as CreateUserBody;
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    const fullName = (body.full_name || "").trim();
    const phone = (body.phone || "").trim() || null;
    const role = body.role;
    const storeId = body.store_id || null;
    const isActive = body.is_active !== false;

    if (!fullName) {
      return NextResponse.json(
        { error: "Full name is required" },
        { status: 400 }
      );
    }
    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: "A valid email is required" },
        { status: 400 }
      );
    }
    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }
    if (!role || !ROLES.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    if ((role === "storekeeper" || role === "subagent") && !storeId) {
      return NextResponse.json(
        { error: "Storekeepers and subagents must be linked to a store" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    if (storeId) {
      const { data: store, error: storeError } = await admin
        .from("stores")
        .select("id")
        .eq("id", storeId)
        .maybeSingle();
      if (storeError || !store) {
        return NextResponse.json(
          { error: "Selected store was not found" },
          { status: 400 }
        );
      }
    }

    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role,
          phone,
          store_id: storeId,
        },
      });

    if (createError || !created.user) {
      const message = createError?.message || "Failed to create auth user";
      const status =
        /already|registered|exists/i.test(message) ? 409 : 500;
      return NextResponse.json({ error: message }, { status });
    }

    const userId = created.user.id;

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .upsert(
        {
          id: userId,
          email,
          full_name: fullName,
          phone,
          role,
          store_id: storeId,
          is_active: isActive,
        },
        { onConflict: "id" }
      )
      .select("*, stores(*)")
      .single();

    if (profileError || !profile) {
      // Roll back auth user if profile setup failed
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        {
          error:
            profileError?.message ||
            "Account was created but profile setup failed. Rolled back.",
        },
        { status: 500 }
      );
    }

    await writeAuditLog({
      actor_id: actor.id,
      actor_name: actor.full_name,
      actor_role: actor.role,
      action: "user.create",
      entity_type: "profile",
      entity_id: userId,
      store_id: storeId,
      details: {
        email,
        role,
        store_id: storeId,
        is_active: isActive,
      },
    });

    return NextResponse.json({
      ok: true,
      user: profile,
      credentials: {
        email,
        // Password is returned once so the owner can share it securely.
        password,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create account",
      },
      { status: 500 }
    );
  }
}
