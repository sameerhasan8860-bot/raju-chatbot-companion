import { createFileRoute } from "@tanstack/react-router";
import { verifyEvent, processEvent } from "@/server/execution/events";

export const Route = createFileRoute("/api/public/github/execution")({
  server: { handlers: { POST: async ({ request }) => {
    if (!process.env["GITHUB_API_KEY"]) return new Response("Not configured", { status: 503 });
    if (Number(request.headers.get("content-length") ?? "0") > 262144) return new Response("Too large", { status: 413 });
    const body = await request.text();
    if (body.length > 262144) return new Response("Too large", { status: 413 });
    if (!await verifyEvent(body, request.headers.get("x-hub-signature-256") ?? "")) return new Response("Unauthorized", { status: 401 });
    if (request.headers.get("x-github-event") !== "workflow_run") return Response.json({ ok: true });
    let input: unknown;
    try { input = JSON.parse(body); } catch { return new Response("Invalid JSON", { status: 400 }); }
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await processEvent(supabaseAdmin as any, input);
      return Response.json({ ok: true });
    } catch { return new Response("Event processing failed", { status: 500 }); }
  } } },
});