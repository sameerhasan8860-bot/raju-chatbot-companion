import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ github: vi.fn(), send: vi.fn() }));
vi.mock("./github", () => ({ configuredRepository: () => "owner/private-tests", github: mocks.github }));
vi.mock("../telegram/api", () => ({ sendHtml: mocks.send }));
import { eventSecret, verifyEvent, processEvent } from "./events";
const id = "11111111-1111-4111-8111-111111111111";
const branch = `telegram-test/456/${id}`;
const run = { id: 1, head_sha: "sha", head_branch: branch, display_title: `telegram-${id}`, event: "workflow_dispatch", path: ".github/workflows/telegram-sandbox.yml", status: "completed", conclusion: "success", html_url: "https://github.com/owner/private-tests/actions/runs/1" };
function fakeDb(job: any) {
  const chain: any = {};
  for (const name of ["select", "eq", "update"]) chain[name] = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => ({ data: job, error: null }));
  chain.then = (resolve: any) => Promise.resolve({ error: null }).then(resolve);
  return { db: { from: vi.fn(() => chain) } as any, chain };
}
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("GITHUB_API_KEY", "test-connection-key"); });
describe("verified GitHub notifications", () => {
  it("rejects unsigned or modified event bodies", async () => {
    const body = '{"event":"test"}';
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(await eventSecret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signed = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
    const signature = "sha256=" + Array.from(signed, b => b.toString(16).padStart(2, "0")).join("");
    expect(await verifyEvent(body, signature)).toBe(true);
    expect(await verifyEvent(body + " ", signature)).toBe(false);
    expect(await verifyEvent(body, "")).toBe(false);
  });
  it("reads back actual run and notifies only its owning sender", async () => {
    const { db, chain } = fakeDb({ id, branch, commit_sha: "sha", repository: "owner/private-tests", status: "dispatched" });
    mocks.github.mockResolvedValue(run);
    await processEvent(db, { repository: { full_name: "owner/private-tests" }, workflow_run: { id: 1, head_branch: branch } });
    expect(chain.eq).toHaveBeenCalledWith("telegram_id", 456);
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ status: "completed", conclusion: "success" }));
    expect(mocks.send).toHaveBeenCalledWith(456, expect.stringContaining("Temporary job has ended"));
  });
  it("rejects mismatched commits even for a signed callback", async () => {
    const { db } = fakeDb({ id, branch, commit_sha: "other", repository: "owner/private-tests", status: "dispatched" });
    mocks.github.mockResolvedValue(run);
    await processEvent(db, { repository: { full_name: "owner/private-tests" }, workflow_run: { id: 1, head_branch: branch } });
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("ignores previously delivered states and unrelated repositories", async () => {
    const { db } = fakeDb({ id, branch, commit_sha: "sha", repository: "owner/private-tests", status: "completed", notified_state: "1:completed:success" });
    mocks.github.mockResolvedValue(run);
    await processEvent(db, { repository: { full_name: "owner/private-tests" }, workflow_run: { id: 1, head_branch: branch } });
    await processEvent(db, { repository: { full_name: "other/repo" }, workflow_run: { id: 1, head_branch: branch } });
    expect(mocks.send).not.toHaveBeenCalled();
  });
});