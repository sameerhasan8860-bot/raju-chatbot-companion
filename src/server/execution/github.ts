import { WORKFLOW, WORKFLOW_NAME } from "./workflow";

export function configuredRepository(): string {
  const repo = process.env["GITHUB_EXECUTION_REPOSITORY"] ?? "";
  if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+$/.test(repo)) throw new Error("Owner must configure GITHUB_EXECUTION_REPOSITORY as owner/dedicated-test-repo.");
  return repo;
}

export class GitHubError extends Error {
  constructor(public status: number, public body: string) { super(`GitHub request failed [${status}]: ${body}`); }
}

export async function github(path: string, method = "GET", body?: unknown): Promise<any> {
  const key = process.env["GITHUB_API_KEY"];
  const lovable = process.env["LOVABLE_API_KEY"];
  if (!key || !lovable) throw new Error("Owner must connect GitHub before testing.");
  const response = await fetch(`https://connector-gateway.lovable.dev/github/${path}`, {
    method,
    headers: { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": key, Accept: "application/vnd.github+json", "Content-Type": "application/json", "X-GitHub-Api-Version": "2022-11-28" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  if (!response.ok) {
    // Only status is logged: repository responses may contain private data.
    console.error(`GitHub failed [${response.status}]`);
    throw new GitHubError(response.status, text);
  }
  return text ? JSON.parse(text) : null;
}

function base64(text: string) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** Refuse non-dedicated repositories and unexpected workflows, even with broad OAuth scopes. */
export async function ensureWorkflow(repo: string): Promise<string> {
  const metadata = await github(`repos/${repo}`);
  if (!metadata.permissions?.push) throw new Error("GitHub repository write permission is missing.");
  if (!metadata.private) throw new Error("Use a private dedicated test repository; generated projects must not become public.");
  let files: any[] = [];
  try { files = await github(`repos/${repo}/contents`); }
  catch (e) { if (!(e instanceof GitHubError) || e.status !== 404) throw e; }
  if (!Array.isArray(files) || files.some((f) => !["README.md", ".github"].includes(f.name))) throw new Error("Use an empty dedicated test repository (README.md is allowed). Existing app repositories are not modified.");
  if (files.some((f) => f.name === ".github")) {
    const folders = await github(`repos/${repo}/contents/.github`);
    if (folders.some((f: any) => f.name !== "workflows")) throw new Error("Dedicated repository contains unrelated GitHub configuration.");
    const workflows = await github(`repos/${repo}/contents/.github/workflows`);
    if (workflows.length !== 1 || workflows[0]?.name !== WORKFLOW_NAME) throw new Error("Unexpected workflows found. Use a dedicated test repository.");
    const file = await github(`repos/${repo}/contents/.github/workflows/${WORKFLOW_NAME}`);
    if (file.content?.replace(/\s/g, "") !== base64(WORKFLOW)) throw new Error("Sandbox workflow differs from the approved fixed workflow. Owner review required.");
  } else {
    await github(`repos/${repo}/contents/.github/workflows/${WORKFLOW_NAME}`, "PUT", { message: "Add bounded Telegram sandbox workflow", content: base64(WORKFLOW) });
  }
  const latest = await github(`repos/${repo}`);
  return latest.default_branch;
}

export async function commitProject(repo: string, base: string, branch: string, project: unknown): Promise<string> {
  const ref = await github(`repos/${repo}/git/ref/heads/${encodeURIComponent(base)}`);
  const parent = ref.object.sha;
  const commit = await github(`repos/${repo}/git/commits/${parent}`);
  const blob = await github(`repos/${repo}/git/blobs`, "POST", { content: JSON.stringify(project), encoding: "utf-8" });
  const tree = await github(`repos/${repo}/git/trees`, "POST", { base_tree: commit.tree.sha, tree: [{ path: "execution.json", mode: "100644", type: "blob", sha: blob.sha }] });
  const newCommit = await github(`repos/${repo}/git/commits`, "POST", { message: "Prepare isolated temporary test", tree: tree.sha, parents: [parent] });
  await github(`repos/${repo}/git/refs`, "POST", { ref: `refs/heads/${branch}`, sha: newCommit.sha });
  return newCommit.sha;
}

export async function runLogs(repo: string, runId: number): Promise<string> {
  const jobs = await github(`repos/${repo}/actions/runs/${runId}/jobs`);
  const job = jobs.jobs?.find((j: any) => j.name === "test");
  if (!job) return "No test job logs available yet.";
  const key = process.env["GITHUB_API_KEY"];
  const lovable = process.env["LOVABLE_API_KEY"];
  if (!key || !lovable) throw new Error("GitHub is not configured.");
  const response = await fetch(`https://connector-gateway.lovable.dev/github/repos/${repo}/actions/jobs/${job.id}/logs`, { redirect: "manual", headers: { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": key } });
  let logs = response;
  if (response.status === 302) {
    const location = response.headers.get("location");
    if (!location) throw new Error("GitHub did not provide a log download URL.");
    const url = new URL(location);
    if (url.protocol !== "https:" || !(url.hostname.endsWith(".blob.core.windows.net") || url.hostname.endsWith(".actions.githubusercontent.com"))) throw new Error("Unexpected GitHub log host.");
    // Signed GitHub URL is fetched without connection or application credentials.
    logs = await fetch(url, { redirect: "error" });
  }
  if (!logs.ok) throw new GitHubError(logs.status, await logs.text());
  const reader = logs.body?.getReader();
  if (!reader) return "No log output.";
  const decoder = new TextDecoder();
  let tail = "";
  let bytes = 0;
  while (bytes < 2_000_000) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    tail = (tail + decoder.decode(value, { stream: true })).slice(-6000);
  }
  await reader.cancel();
  return tail;
}