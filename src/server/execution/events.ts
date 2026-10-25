import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { configuredRepository, github } from "./github";
import { describeRun, redact, UUID } from "./validation";
import { sendHtml } from "../telegram/api";
import { toTelegramMessages } from "@/lib/telegram/format";

export async function eventSecret(): Promise<string> {
  const key = process.env["GITHUB_API_KEY"];
  if (!key) throw new Error("GitHub is not configured.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`execution-events:${key}`));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyEvent(body: string, signature: string): Promise<boolean> {
  if (!/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(await eventSecret()), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const hex = signature.slice(7);
  const bytes = Uint8Array.from(hex.match(/../g) ?? [], x => parseInt(x, 16));
  return crypto.subtle.verify("HMAC", key, bytes, new TextEncoder().encode(body));
}

const eventSchema = z.object({ repository: z.object({ full_name: z.string().max(200) }), workflow_run: z.object({ id: z.number().int().positive(), head_branch: z.string().max(200) }) });
export async function processEvent(db: SupabaseClient, input: unknown): Promise<void> {
  const event = eventSchema.parse(input);
  if (event.repository.full_name !== configuredRepository()) return;
  const match = /^telegram-test\/(\d+)\/([a-f0-9-]+)$/.exec(event.workflow_run.head_branch);
  if (!match) return;
  const uid = Number(match[1]);
  if (!Number.isSafeInteger(uid) || uid <= 0) return;
  const id = UUID.parse(match[2]);
  const { data: job, error } = await db.from("tg_jobs").select("*").eq("telegram_id", uid).eq("id", id).eq("repository", event.repository.full_name).maybeSingle();
  if (error) throw new Error("Event storage unavailable.");
  if (!job?.commit_sha || !["committed", "dispatched", "queued", "in_progress", "completed"].includes(job.status)) return;
  const run = await github(`repos/${job.repository}/actions/runs/${event.workflow_run.id}`);
  if (run.head_sha !== job.commit_sha || run.head_branch !== job.branch || run.display_title !== `telegram-${id}` || run.event !== "workflow_dispatch" || run.path !== ".github/workflows/telegram-sandbox.yml") return;
  const state = `${run.id}:${run.status}:${run.conclusion ?? ""}`;
  if (job.notified_state === state || (job.status === "completed" && run.status !== "completed")) return;
  const { error: saved } = await db.from("tg_jobs").update({ run_id: run.id, status: run.status, conclusion: run.conclusion, html_url: run.html_url, updated_at: new Date().toISOString() }).eq("telegram_id", uid).eq("id", id);
  if (saved) throw new Error("Could not save verified run.");
  let detail = "";
  if (run.status === "in_progress") {
    const jobs = await github(`repos/${job.repository}/actions/runs/${run.id}/jobs`);
    const step = jobs.jobs?.flatMap((j: any) => j.steps ?? []).find((s: any) => s.status === "in_progress");
    if (step) detail = `\nObserved step: ${step.name}`;
  }
  for (const part of toTelegramMessages(redact(`Job ${id}\n${describeRun(run)}${detail}\n/status ${id}\n/logs ${id}${run.conclusion === "failure" ? `\n/fix ${id} — prepare a fix for review; nothing reruns automatically` : ""}`))) await sendHtml(uid, part);
  const { error: notified } = await db.from("tg_jobs").update({ notified_state: state }).eq("telegram_id", uid).eq("id", id);
  if (notified) throw new Error("Notification receipt unavailable.");
}