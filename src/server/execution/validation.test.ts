import { describe, expect, it } from "vitest";
import { describeRun, executionIntent, redact, validateProject } from "./validation";

const project = { title: "Calculator", runtime: "python", files: [{ path: "main.py", content: "print(1 + 1)" }], test_command: "python main.py" };

describe("opt-in execution and validation", () => {
  it("does not execute ordinary code-generation questions", () => {
    expect(executionIntent("Create a Telegram group management bot")).toBe(false);
    expect(executionIntent("Test this using GitHub Actions")).toBe(false);
  });
  it("accepts explicit execution commands", () => {
    expect(executionIntent("/execute 123")).toBe(true);
    expect(executionIntent("/confirm@my_bot 123")).toBe(true);
  });
  it("rejects workflow and traversal files", () => {
    for (const path of ["../escape.py", ".github/workflows/attack.yml", "/tmp/a", "Dockerfile", "execution.json", "run-test.sh"]) {
      expect(() => validateProject({ ...project, files: [{ path, content: "x" }] })).toThrow();
    }
  });
  it("rejects real credentials before committing", () => {
    expect(() => validateProject({ ...project, files: [{ path: "main.py", content: "ghp_" + "a".repeat(30) }] })).toThrow(/credentials/);
  });
  it("accepts ordinary source and meaningful test commands", () => {
    expect(validateProject(project).test_command).toBe("python main.py");
  });
  it("never reports completed success as ongoing hosting", () => {
    expect(describeRun({ status: "completed", conclusion: "success" })).toContain("Temporary job has ended");
    expect(describeRun({ status: "completed", conclusion: "failure" })).toContain("Application is not running");
  });
  it("redacts credentials in returned logs", () => {
    expect(redact("ghp_" + "a".repeat(30))).toBe("[REDACTED]");
  });
});