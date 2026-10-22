import { createFileRoute } from "@tanstack/react-router";
import { webhookSecret } from "@/server/telegram/api";

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!process.env.TELEGRAM_API_KEY) return new Response("Not configured", { status: 500 });
        const actual = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (!safeEqual(actual, await webhookSecret())) return new Response("Unauthorized", { status: 401 });

        const update = await request.json().catch(() => null);
        if (!update || typeof update.update_id !== "number") return Response.json({ ok: true });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // Idempotency: skip updates already seen (Telegram retries).
        const { error: dupErr } = await supabaseAdmin.from("tg_updates").insert({ update_id: update.update_id });
        if (dupErr) return Response.json({ ok: true, duplicate: true });

        const { handleUpdate } = await import("@/server/telegram/bot");
        const pending: Promise<unknown>[] = [];
        try {
          await handleUpdate(supabaseAdmin as any, update, (p) => pending.push(p));
          await Promise.allSettled(pending);
        } catch (e) {
          console.error("update failed", e);
        }
        return Response.json({ ok: true });
      },
    },
  },
});
