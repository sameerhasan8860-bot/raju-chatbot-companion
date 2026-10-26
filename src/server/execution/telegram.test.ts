import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ github: vi.fn(), send: vi.fn(), chat: vi.fn(), ensure: vi.fn() }));
vi.mock("../telegram/api", () => ({ sendHtml: mocks.send }));
vi.mock("../ai/providers", () => ({ chat: mocks.chat, DEFAULT_MODEL: "unchanged-model" }));
vi.mock("./github", () => ({
  configuredRepository: () => "owner/private-tests",
  github: mocks.github,
  ensureWorkflow: mocks.ensure,
  commitProject: vi.fn(),
  runLogs: vi.fn(),
  GitHubError: class extends Error {},
}));
import { handleExecution } from "./telegram";

const id = "11111111-1111-4111-8111-111111111111";
function fakeDb(data: unknown) {
  const chain: any = {};
  for (const name of ["select", "eq", "order", "limit", "insert", "update"]) chain[name] = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => ({ data, error: null }));
  chain.single = vi.fn(async () => ({ data, error: null }));
  return { db: { from: vi.fn(() => chain) } as any, chain };
}
beforeEach(() => vi.clearAllMocks());
describe("Telegram execution authorization", () => {
  it("ordinary chat does not access GitHub, storage or execution AI", async () => {
    const { db } = fakeDb(null);
    expect(await handleExecution(db, 123, 123, "How do I make a bot?")).toBe(false);
    expect(db.from).not.toHaveBeenCalled();
    expect(mocks.github).not.toHaveBeenCalled();
    expect(mocks.chat).not.toHaveBeenCalled();
  });
  it("all senders may prepare their own project confirmation without executing", async () => {
    const { db, chain } = fakeDb({ id, title: "Test", runtime: "python", files: [{ path: "main.py", content: "print(2)" }], test_command: "python main.py" });
    await handleExecution(db, 456, 456, `/execute ${id}`);
    expect(chain.eq).toHaveBeenCalledWith("telegram_id", 456);
    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({ telegram_id: 456, status: "awaiting_confirmation" }));
    expect(mocks.github).not.toHaveBeenCalled();
    expect(mocks.ensure).not.toHaveBeenCalled();
  });
  it("cannot confirm another sender's job", async () => {
    const { db, chain } = fakeDb(null);
    await handleExecution(db, 789, 789, `/confirm ${id}`);
    expect(chain.eq).toHaveBeenCalledWith("telegram_id", 789);
    expect(mocks.ensure).not.toHaveBeenCalled();
    expect(mocks.send).toHaveBeenCalledWith(789, expect.stringContaining("not found in your account"));
  });
  it("a cancelled confirmation cannot start a workflow", async () => {
    const { db } = fakeDb({ id, repository: "owner/private-tests", status: "cancelled" });
    await handleExecution(db, 123, 123, `/confirm ${id}`);
    expect(mocks.ensure).not.toHaveBeenCalled();
    expect(mocks.github).not.toHaveBeenCalled();
  });
  it("repository change invalidates prior authorizations", async () => {
    const { db } = fakeDb({ id, repository: "owner/other-private-repo", status: "awaiting_confirmation" });
    await handleExecution(db, 123, 123, `/confirm ${id}`);
    expect(mocks.ensure).not.toHaveBeenCalled();
    expect(mocks.send).toHaveBeenCalledWith(123, expect.stringContaining("changed the authorized repository"));
  });
  it("expired approvals cannot execute", async () => {
    const { db } = fakeDb({ id, repository: "owner/private-tests", status: "awaiting_confirmation", created_at: "2020-01-01T00:00:00Z" });
    await handleExecution(db, 123, 123, `/confirm ${id}`);
    expect(mocks.ensure).not.toHaveBeenCalled();
    expect(mocks.send).toHaveBeenCalledWith(123, expect.stringContaining("expired"));
  });
  it("natural-language requests only prepare owner-scoped review and never dispatch", async () => {
    const { db, chain } = fakeDb({ content: "```python\nprint(2)\n```", id, title: "Test", runtime: "python", files: [{ path: "main.py", content: "print(2)" }], test_command: "python main.py" });
    mocks.chat.mockResolvedValue(JSON.stringify({ title: "Test", runtime: "python", files: [{ path: "main.py", content: "print(2)" }], test_command: "python main.py" }));
    await handleExecution(db, 456, 456, "test this project");
    expect(chain.eq).toHaveBeenCalledWith("telegram_id", 456);
    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({ branch: expect.stringMatching(/^telegram-test\/456\//), status: "awaiting_confirmation" }));
    expect(mocks.ensure).not.toHaveBeenCalled();
    expect(mocks.github).not.toHaveBeenCalled();
  });
});