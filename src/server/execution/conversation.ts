import type { ProjectInput } from "./validation";

export function naturalTestRequest(text: string): boolean {
  return /^(?:yes[,!]?\s*)?(?:run|test)(?:\s+(?:it|this|the code|this project|the project|the code you just generated))?(?:\s+(?:please|on your server|using github actions|for me))*[.!]?$/i.test(text.trim()) || /^(?:haan[,!]?\s*)?(?:ise|isko|code|project)?\s*(?:run|test)\s*(?:karo|kar do)[.!]?$/i.test(text.trim());
}

export function hasCode(text: string): boolean { return /```(?:python|py|javascript|js|typescript|ts|json|html|css)\b/i.test(text); }
export function hasCredential(text: string): boolean {
  return /gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{16,}|\b\d{8,10}:[A-Za-z0-9_-]{30,}|AKIA[0-9A-Z]{16}|-----BEGIN.*PRIVATE KEY|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.|(?:postgres(?:ql)?|mongodb(?:\+srv)?):\/\/[^\s]+|(?:token|secret|password|api[_-]?key)\s*[=:]\s*['"][^'"\n]{12,}['"]/i.test(text);
}
export function safeContext(text: string): string {
  if (hasCredential(text)) throw new Error("Remove credentials from this conversation before preparing a test. Do not send tokens in Telegram.");
  return text.slice(-50000);
}

export function requiredConfiguration(p: ProjectInput): string[] {
  const names = new Set<string>();
  for (const { content } of p.files) {
    const patterns = [/process\.env(?:\.([A-Z][A-Z0-9_]+)|\[['"]([A-Z][A-Z0-9_]+)['"]\])/g, /(?:os\.(?:getenv|environ\.get)\(|os\.environ\[)['"]([A-Z][A-Z0-9_]+)['"]/g];
    for (const pattern of patterns) for (const match of content.matchAll(pattern)) {
      const name = match[1] ?? match[2];
      if (name) names.add(name);
    }
  }
  return [...names].sort();
}