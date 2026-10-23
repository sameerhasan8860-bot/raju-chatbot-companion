// Converts model Markdown into Telegram-safe HTML and splits it into messages.
export const TG_LIMIT = 4000;

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type Segment = { kind: "text"; html: string } | { kind: "code"; lang: string; code: string };

function inline(text: string): string {
  // Split out inline code first so its content is never touched by other rules.
  const parts = text.split(/(`[^`\n]+`)/g);
  return parts
    .map((p) => {
      if (/^`[^`\n]+`$/.test(p)) return `<code>${escapeHtml(p.slice(1, -1))}</code>`;
      let h = escapeHtml(p);
      h = h.replace(/^#{1,6}\s+(.+)$/gm, "<b>$1</b>");
      h = h.replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>");
      h = h.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, "$1<i>$2</i>");
      h = h.replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
      h = h.replace(/^(\s*)[-*]\s+/gm, "$1• ");
      return h;
    })
    .join("");
}

export function parseSegments(md: string): Segment[] {
  const out: Segment[] = [];
  const re = /```([\w+#.-]*)[^\n]*\n([\s\S]*?)(?:```|$)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md))) {
    if (m.index > last) out.push({ kind: "text", html: inline(md.slice(last, m.index)) });
    out.push({ kind: "code", lang: m[1] || "", code: (m[2] ?? "").replace(/\n$/, "") });
    last = re.lastIndex;
  }
  if (last < md.length) out.push({ kind: "text", html: inline(md.slice(last)) });
  return out.filter((s) => (s.kind === "text" ? s.html.trim() !== "" : true));
}

function codeHtml(lang: string, code: string): string {
  const cls = lang ? ` class="language-${escapeHtml(lang)}"` : "";
  return `<pre><code${cls}>${escapeHtml(code)}</code></pre>`;
}

/** Break a too-long code block into several complete code blocks along line boundaries. */
function splitCode(lang: string, code: string, limit: number): string[] {
  const overhead = codeHtml(lang, "").length;
  const chunks: string[] = [];
  let cur = "";
  for (const line of code.split("\n")) {
    const pieces: string[] = [];
    let l = line;
    while (escapeHtml(l).length + overhead > limit) {
      pieces.push(l.slice(0, Math.floor((limit - overhead) / 5)));
      l = l.slice(Math.floor((limit - overhead) / 5));
    }
    pieces.push(l);
    for (const p of pieces) {
      const next = cur === "" ? p : cur + "\n" + p;
      if (escapeHtml(next).length + overhead > limit && cur !== "") {
        chunks.push(cur);
        cur = p;
      } else cur = next;
    }
  }
  if (cur !== "" || chunks.length === 0) chunks.push(cur);
  return chunks.map((c) => codeHtml(lang, c));
}

function splitText(html: string, limit: number): string[] {
  const out: string[] = [];
  let cur = "";
  for (const para of html.split(/(\n)/)) {
    if ((cur + para).length > limit && cur) {
      out.push(cur);
      cur = "";
    }
    let p = para;
    while (p.length > limit) {
      out.push(p.slice(0, limit));
      p = p.slice(limit);
    }
    cur += p;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

/** Markdown → array of Telegram HTML messages, each ≤ limit chars, code blocks never broken mid-tag. */
export function toTelegramMessages(md: string, limit = TG_LIMIT): string[] {
  const blocks: string[] = [];
  for (const s of parseSegments(md)) {
    if (s.kind === "code") blocks.push(...splitCode(s.lang, s.code, limit));
    else blocks.push(...splitText(s.html.replace(/^\n+|\n+$/g, ""), limit));
  }
  const msgs: string[] = [];
  let cur = "";
  for (const b of blocks) {
    const next = cur ? cur + "\n" + b : b;
    if (next.length > limit && cur) {
      msgs.push(cur);
      cur = b;
    } else cur = next;
  }
  if (cur) msgs.push(cur);
  return msgs.length ? msgs : ["(empty response)"];
}

const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]{16,}/,
  /\b\d{8,10}:[A-Za-z0-9_-]{30,}\b/, // telegram bot token
  /ghp_[A-Za-z0-9]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /\b(password|passwd|api[_ -]?key|secret|token)\b\s*[:=]/i,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./,
];
export function looksSensitive(s: string): boolean {
  return SECRET_PATTERNS.some((r) => r.test(s));
}
