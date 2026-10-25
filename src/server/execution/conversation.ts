import { looksSensitive } from "@/lib/telegram/format";
import type { ProjectInput } from "./validation";

export function naturalTestRequest(text: string): boolean {
  return /^(?:yes[,!]?\s*)?(?:run|test)(?:\s+(?:it|this|the code|this project|the project|the code you just generated))?(?:\s+(?:please|on your server|using github actions|for me))*[.!]?$/i.test(text.trim()) || /^(?:haan[,!]?\s*)?(?:ise|isko|code|project)?\s*(?:run|test)\s*(?:karo|kar do)[.!]?$/i.test(text.trim());
}

export function hasCode(text: string): boolean { return /```(?:python|py|javascript|js|typescript|ts|json|html|css)\b/i.test(text); }
export function safeContext(text: string): string {
  if (looksSensitive(text)) throw new Error("Remove credentials from this conversation before preparing a test. Do not send tokens in Telegram.");
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