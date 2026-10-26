import { describe, it, expect } from "vitest";
import { naturalTestRequest, safeContext, requiredConfiguration } from "./conversation";
import { validateProject } from "./validation";

describe("natural test review", () => {
  it("recognizes an explicit request to test prior code, not code generation or bare yes", () => {
    expect(naturalTestRequest("test this project")).toBe(true);
    expect(naturalTestRequest("Yes, run it on your server.")).toBe(true);
    expect(naturalTestRequest("test karo")).toBe(true);
    expect(naturalTestRequest("Create a bot")).toBe(false);
    expect(naturalTestRequest("yes")).toBe(false);
  });
  it("detects required config names without collecting real values", () => {
    const p = validateProject({ title: "Config", runtime: "python", files: [{ path: "main.py", content: `token = os.getenv("TELEGRAM_BOT_TOKEN")\nprocess.env.API_HASH\nprocess.env['API_ID']\nos.environ["DATABASE_URL"]` }], test_command: "python main.py" });
    expect(requiredConfiguration(p)).toEqual(["API_HASH", "API_ID", "DATABASE_URL", "TELEGRAM_BOT_TOKEN"]);
  });
  it("refuses credentials even before conversion into a saved project", () => {
    expect(() => safeContext("ghp_" + "a".repeat(30))).toThrow(/credentials/);
    expect(() => validateProject({ title: "Unsafe", runtime: "python", files: [{ path: "main.py", content: `password = "${"a".repeat(16)}"` }], test_command: "python main.py" })).toThrow(/credentials/);
  });
});