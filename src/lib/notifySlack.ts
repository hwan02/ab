export async function notifySlack(params: {
  senderName?: string;
  messageType: string;
  content: string;
  propertyName?: string;
  chatUrl?: string;
}) {
  try {
    await fetch("/api/notify/slack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  } catch {
    // Slack notification is best-effort; don't block the user
  }
}
