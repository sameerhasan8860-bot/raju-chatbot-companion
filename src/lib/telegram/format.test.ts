import { describe, it, expect } from "vitest";
import { toTelegramMessages, looksSensitive, TG_LIMIT } from "./format";

describe("telegram formatting", () => {
  it("renders fenced code as pre/code with language and escapes HTML", () => {
    const [m] = toTelegramMessages("Here:\n```python\nif a < b and c > d:\n    print('&')\n```\nDone");
    expect(m).toContain('<pre><code class="language-python">if a &lt; b and c &gt; d:\n    print(\'&amp;\')</code></pre>');
    expect(m.startsWith("Here:")).toBe(true);
  });

  it("splits long code into multiple complete code blocks under the limit", () => {
    const code = Array.from({ length: 800 }, (_, i) => `line_${i} = ${i}`).join("\n");
    const msgs = toTelegramMessages("```js\n" + code + "\n```");
    expect(msgs.length).toBeGreaterThan(1);
    for (const m of msgs) {
      expect(m.length).toBeLessThanOrEqual(TG_LIMIT);
      expect((m.match(/<pre>/g) || []).length).toBe((m.match(/<\/pre>/g) || []).length);
    }
    const joined = msgs.join("\n").replace(/<[^>]+>/g, "");
    expect(joined).toContain("line_0 = 0");
    expect(joined).toContain("line_799 = 799");
  });

  it("flags secrets so they are never stored as memories", () => {
    expect(looksSensitive("my key is sk-abcdefghijklmnopqrstuv")).toBe(true);
    expect(looksSensitive("User builds a Flask app")).toBe(false);
  });
});
