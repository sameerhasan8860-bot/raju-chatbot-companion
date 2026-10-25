import { z } from "zod";

export const UUID = z.string().uuid();
export const projectSchema = z.object({
  title: z.string().min(1).max(100),
  runtime: z.enum(["python", "node"]),
  files: z.array(z.object({ path: z.string().min(1).max(160), content: z.string().max(50000) })).min(1).max(30),
  test_command: z.string().min(1).max(300),
});
export type ProjectInput = z.infer<typeof projectSchema>;

export function validateProject(input: unknown): ProjectInput {
  const p = projectSchema.parse(input);
  const seen = new Set<string>();
  let size = 0;
  for (const file of p.files) {
    if (!/^[A-Za-z0-9_.\/-]+$/.test(file.path) || file.path.startsWith("/") || file.path.split("/").some((part) => !part || part.startsWith(".")) || /^(Dockerfile|execution\.json|run-test\.sh)$/i.test(file.path)) {
      throw new Error("Unsafe file path: use ordinary project files, not hidden files or workflows.");
    }
    if (seen.has(file.path)) throw new Error("Duplicate file path.");
    seen.add(file.path);
    size += file.content.length;
    if (/gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{16,}|\b\d{8,10}:[A-Za-z0-9_-]{30,}|-----BEGIN.*PRIVATE KEY|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./.test(file.content)) throw new Error("Remove real credentials from project files before testing.");
  }
  if (size > 150000) throw new Error("Project exceeds the temporary test size limit.");
  return p;
}

export function executionIntent(text: string): boolean {
  return /^\/(execute|prepare|confirm|status|logs|cancel|rerun|hosting|execution)(?:@\w+)?(?:\s|$)/i.test(text);
}

export function redact(text: string): string {
  return text.replace(/gh[pousr]_[A-Za-z0-9]+|github_pat_[A-Za-z0-9_]+|sk-[A-Za-z0-9_-]+|\b\d{8,10}:[A-Za-z0-9_-]{30,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED]");
}

export function describeRun(run: { status: string; conclusion: string | null }): string {
  if (run.status !== "completed") return `GitHub workflow: ${run.status}. Temporary job only; application health is not verified.`;
  if (run.conclusion === "success") return "Test command passed. Temporary job has ended; this does not prove application startup or health checks unless your test checked them.";
  return `Workflow ended: ${run.conclusion ?? "unknown"}. Application is not running in this job.`;
}