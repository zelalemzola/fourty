import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
      !process.env.VAPID_PRIVATE_KEY
    ) {
      return NextResponse.json(
        {
          error:
            "VAPID keys are not configured. Run: node scripts/generate-vapid.mjs",
        },
        { status: 500 }
      );
    }

    const { count } = await supabase
      .from("push_subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (!count) {
      return NextResponse.json(
        {
          error:
            "No push subscription on this account. Enable alerts first.",
        },
        { status: 400 }
      );
    }

    // Omit type so prefs/quiet hours do not suppress the test.
    await sendPushToUser(user.id, {
      title: "Fourty test alert",
      body: "Web push is working on this device.",
      url: "/app/settings",
    });

    return NextResponse.json({ ok: true, devices: count });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Test push failed",
      },
      { status: 500 }
    );
  }
}
