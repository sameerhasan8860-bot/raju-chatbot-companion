import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Telegram AI Assistant" },
      { name: "description", content: "A Telegram AI assistant for coding and everyday questions, with long-term memory." },
      { property: "og:title", content: "Telegram AI Assistant" },
      { property: "og:description", content: "Chat in Telegram DMs: answers, code in clean code boxes, and memory." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const commands = [
  ["/start", "Welcome and help"],
  ["/reset", "Fresh conversation, memories kept"],
  ["/model", "Show or switch the AI model"],
  ["/memory", "See what the bot remembers"],
  ["/forget", "Delete one memory or all"],
  ["/history", "Recent messages"],
];

function Index() {
  return (
    <main className="min-h-screen bg-background px-6 py-16 text-foreground">
      <div className="mx-auto max-w-xl">
        <p className="font-mono text-sm text-primary">● bot online</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">Telegram AI Assistant</h1>
        <p className="mt-4 text-muted-foreground">
          Open your bot in Telegram and send it a private message. It answers questions, writes and fixes code in proper
          code boxes, and remembers your projects between chats.
        </p>
        <ul className="mt-10 divide-y divide-border rounded-lg border border-border bg-card">
          {commands.map(([c, d]) => (
            <li key={c} className="flex items-center justify-between px-4 py-3">
              <code className="font-mono text-primary">{c}</code>
              <span className="text-sm text-muted-foreground">{d}</span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
