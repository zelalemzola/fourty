import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyOwners, writeAuditLog } from "@/lib/push";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let actorName: string | null = null;
    let actorRole: string | null = null;
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .single();
      actorName = profile?.full_name || null;
      actorRole = profile?.role || null;
    }

    await writeAuditLog({
      actor_id: user?.id || null,
      actor_name: actorName,
      actor_role: actorRole,
      action: body.action || "unknown",
      entity_type: body.entity_type || "system",
      entity_id: body.entity_id || null,
      store_id: body.store_id || null,
      details: body.metadata || {},
    });

    await notifyOwners({
      title: body.title || "Fourty update",
      body: body.body || "An action was recorded.",
      type: body.type || "system",
      link: body.link || "/app/notifications",
      metadata: body.metadata || {},
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Notify failed",
      },
      { status: 500 }
    );
  }
}
