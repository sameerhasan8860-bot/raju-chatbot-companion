import type { SupabaseClient } from "@supabase/supabase-js";
import { chat, friendlyAIError, MODELS, DEFAULT_MODEL, type ChatMsg } from "../ai/providers";
import { toTelegramMessages, escapeHtml } from "@/lib/telegram/format";
import { sendHtml, tg } from "./api";
import { recallMemories, updateMemories } from "./memory";
import { handleExecution } from "../execution/telegram";
import { hasCode } from "../execution/conversation";

const HISTORY_LIMIT = 20;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 30;

const SYSTEM = `You are a professional AI assistant on Telegram, as capable as ChatGPT, Claude or Codex, and an expert software engineer.
- Reply in the user's language and tone (Hindi, Hinglish, English, etc.). Match their level: step-by-step for beginners, technical for experts.
- Give the answer first, then useful explanation. No repetitive introductions. Ask a short question only when truly needed.
- Be maximally helpful and direct: answer every question fully, explain how things work and how to build or do them step by step. Never give vague or evasive replies, never lecture, and never add unnecessary warnings or disclaimers.
- Never invent facts, API keys, test results or features. Say clearly when unsure. Never claim code was executed.
- ALWAYS put code in Markdown fenced blocks with a language tag (\`\`\`python). Explanations go outside code blocks.
- For multi-file projects, label each file with its exact path on its own line (e.g. **src/main.py**) followed by its own code block. Include structure, dependencies, env vars, setup and run steps.
- For debugging: name the root cause, explain the fix, give corrected code.
- If an answer would be extremely long, split it into numbered parts without omitting code.
- Use only simple Markdown: **bold**, *italic*, \`inline code\`, fenced code, bullet lists, links. No tables.
- Refuse only genuinely harmful requests (malware, credential theft, unauthorized access), keep the refusal to one short line, and immediately offer a safe alternative or the closest legal/ethical way to achieve the user's goal.
- You may receive "Known facts about this user" from long-term memory. Use them naturally; never claim to remember anything not given to you.`;

const HELP = `<b>Hi! I'm your AI assistant.</b>
Just send any message — questions, code, errors, ideas. I remember useful things about you and your projects between chats.

<b>Commands</b>
/reset — start a fresh conversation (memories are kept)
/model — show or change the AI model
/memory — see what I remember about you
/forget &lt;id&gt; — delete one memory, or /forget all
/history — recent messages in this conversation
/help — this message`;

type User = { telegram_id: number; model: string; context_reset_at: string; window_start: string; window_count: number };

async function getUser(db: SupabaseClient, from: { id: number; username?: string; first_name?: string }): Promise<User> {
  const { data } = await db.from("tg_users").select("*").eq("telegram_id", from.id).maybeSingle();
  if (data) return data as User;
  const { data: created, error } = await db
    .from("tg_users")
    .upsert({ telegram_id: from.id, username: from.username ?? null, first_name: from.first_name ?? null }, { onConflict: "telegram_id" })
    .select("*")
    .single();
  if (error) throw error;
  return created as User;
}

async function send(chatId: number, md: string) {
  for (const m of toTelegramMessages(md)) await sendHtml(chatId, m);
}

async function command(db: SupabaseClient, user: User, chatId: number, text: string): Promise<boolean> {
  const [cmdRaw = "", ...rest] = text.trim().split(/\s+/);
  const cmd = (cmdRaw.split("@")[0] ?? "").toLowerCase();
  const arg = rest.join(" ").trim();
  const uid = user.telegram_id;

  switch (cmd) {
    case "/start":
    case "/help":
      await sendHtml(chatId, HELP);
      return true;
    case "/reset":
      await db.from("tg_users").update({ context_reset_at: new Date().toISOString() }).eq("telegram_id", uid);
      await sendHtml(chatId, "🧹 Fresh conversation started. Your saved memories are kept — use /memory to see them.");
      return true;
    case "/model": {
      if (!arg) {
        const list = Object.entries(MODELS).map(([k, v]) => `${v === user.model ? "✅" : "▫️"} <code>${k}</code> — ${escapeHtml(v)}`).join("\n");
        await sendHtml(chatId, `<b>Current model:</b> <code>${escapeHtml(user.model)}</code>\n\n${list}\n\nChange with <code>/model smart</code>`);
        return true;
      }
      const m = MODELS[arg.toLowerCase()];
      if (!m) {
        await sendHtml(chatId, `Unknown model. Choose one of: ${Object.keys(MODELS).map((k) => `<code>${k}</code>`).join(", ")}`);
        return true;
      }
      await db.from("tg_users").update({ model: m }).eq("telegram_id", uid);
      await sendHtml(chatId, `✅ Model set to <code>${escapeHtml(m)}</code>`);
      return true;
    }
    case "/memory": {
      const { data } = await db.from("tg_memories").select("id, category, content, project").eq("telegram_id", uid).order("category").order("updated_at", { ascending: false }).limit(100);
      if (!data?.length) {
        await sendHtml(chatId, "I don't have any saved memories about you yet.");
        return true;
      }
      const body = data.map((m) => `<code>#${m.id}</code> <i>${escapeHtml(m.category)}</i>${m.project ? ` · ${escapeHtml(m.project)}` : ""}\n${escapeHtml(m.content)}`).join("\n\n");
      for (const part of chunk(`<b>🧠 What I remember</b>\n\n${body}\n\nDelete one with <code>/forget 12</code> or everything with <code>/forget all</code>`)) await sendHtml(chatId, part);
      return true;
    }
    case "/forget": {
      if (arg.toLowerCase() === "all") {
        await db.from("tg_memories").delete().eq("telegram_id", uid);
        await sendHtml(chatId, "🗑 All your saved memories were deleted.");
        return true;
      }
      const ids = arg.match(/\d+/g)?.map(Number) ?? [];
      if (!ids.length) {
        await sendHtml(chatId, "Use <code>/forget 12</code> (see ids in /memory) or <code>/forget all</code>.");
        return true;
      }
      const { data } = await db.from("tg_memories").delete().eq("telegram_id", uid).in("id", ids).select("id");
      await sendHtml(chatId, data?.length ? `🗑 Deleted ${data.length} memor${data.length === 1 ? "y" : "ies"}.` : "No matching memories found.");
      return true;
    }
    case "/history": {
      const { data } = await db.from("tg_messages").select("role, content, created_at").eq("telegram_id", uid).gt("created_at", user.context_reset_at).order("created_at", { ascending: false }).limit(10);
      if (!data?.length) {
        await sendHtml(chatId, "No messages in the current conversation yet.");
        return true;
      }
      const body = data.reverse().map((m) => `<b>${m.role === "user" ? "You" : "Bot"}:</b> ${escapeHtml(m.content.slice(0, 300))}${m.content.length > 300 ? "…" : ""}`).join("\n\n");
      for (const part of chunk(body)) await sendHtml(chatId, part);
      return true;
    }
  }
  return false;
}

function chunk(html: string, limit = 4000): string[] {
  const out: string[] = [];
  let cur = "";
  for (const block of html.split("\n\n")) {
    if ((cur + "\n\n" + block).length > limit && cur) {
      out.push(cur);
      cur = block;
    } else cur = cur ? cur + "\n\n" + block : block;
  }
  if (cur) out.push(cur);
  return out;
}

export async function handleUpdate(db: SupabaseClient, update: any, waitUntil: (p: Promise<unknown>) => void) {
  const msg = update.message ?? update.edited_message;
  if (!msg?.chat?.id || !msg.from || msg.chat.type !== "private") return;
  const chatId: number = msg.chat.id;
  const text: string | undefined = msg.text ?? msg.caption;
  if (!text) {
    await sendHtml(chatId, "I can read text messages for now — please paste your code, error or question as text.");
    return;
  }

  let user: User;
  try {
    user = await getUser(db, msg.from);
  } catch (e) {
    console.error("db error", e);
    await sendHtml(chatId, "⚠️ My storage is temporarily unavailable. Please try again shortly.");
    return;
  }
  if (await handleExecution(db, user.telegram_id, chatId, text, user.model)) return;
  if (text.startsWith("/") && (await command(db, user, chatId, text))) return;

  // Per-user rate limit
  const now = Date.now();
  const windowStart = new Date(user.window_start).getTime();
  const inWindow = now - windowStart < RATE_WINDOW_MS;
  const count = inWindow ? user.window_count + 1 : 1;
  await db.from("tg_users").update({ window_count: count, window_start: inWindow ? user.window_start : new Date(now).toISOString() }).eq("telegram_id", user.telegram_id);
  if (count > RATE_MAX) {
    await sendHtml(chatId, "⏳ You're sending messages very fast. Please wait a few minutes and try again.");
    return;
  }

  const uid = user.telegram_id;
  const typing = tg("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {});
  const typingTimer = setInterval(() => tg("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {}), 4500);

  try {
    const [{ data: hist }, memories] = await Promise.all([
      db.from("tg_messages").select("role, content").eq("telegram_id", uid).gt("created_at", user.context_reset_at).order("created_at", { ascending: false }).limit(HISTORY_LIMIT),
      recallMemories(db, uid, text).catch(() => []),
    ]);
    const history = ((hist ?? []) as ChatMsg[]).reverse();
    // Keep context bounded (~60k chars)
    let budget = 60000;
    const trimmed: ChatMsg[] = [];
    for (let i = history.length - 1; i >= 0; i--) {
      const h = history[i];
      if (!h) break;
      budget -= h.content.length;
      if (budget < 0) break;
      trimmed.unshift(h);
    }
    const messages: ChatMsg[] = [{ role: "system", content: SYSTEM }];
    if (memories.length) {
      messages.push({ role: "system", content: `Known facts about this user (from long-term memory):\n${memories.map((m) => `- [${m.category}${m.project ? `: ${m.project}` : ""}] ${m.content}`).join("\n")}` });
    }
    messages.push(...trimmed, { role: "user", content: text });

    await typing;
    let reply: string;
    try {
      reply = (await chat(user.model ?? DEFAULT_MODEL, messages)).trim();
      if (!reply) reply = "I couldn't produce an answer for that. Could you rephrase or add a bit more detail?";
    } catch (e) {
      console.error("AI error", e);
      await sendHtml(chatId, friendlyAIError(e));
      return;
    }
    clearInterval(typingTimer);
    await send(chatId, reply);
    if (hasCode(reply)) await sendHtml(chatId, "Would you like to test this project temporarily on GitHub? Reply ‘test karo’ or ‘test this project’ to prepare files for review. Nothing runs without your project-specific confirmation. For permanent hosting, use /hosting.");

    await db.from("tg_messages").insert([
      { telegram_id: uid, role: "user", content: text },
      { telegram_id: uid, role: "assistant", content: reply },
    ]);
    waitUntil(updateMemories(db, uid, memories, text, reply).catch((e) => console.error("memory update failed", e)));
  } finally {
    clearInterval(typingTimer);
  }
}
