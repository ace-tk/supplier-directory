export type CommunicationType = "Call" | "Email" | "WhatsApp" | "Meeting";
export type CommunicationStatus = "Sent" | "Opened" | "Completed" | "Pending" | "Missed" | "Scheduled";

export interface CommunicationEntry {
  id: string;
  date: string; // ISO
  type: CommunicationType;
  user: string;
  status: CommunicationStatus;
  notes: string;
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const USERS = ["Tisha Kharade", "Rahul Verma", "Ananya Singh", "Karan Mehta"];

const TEMPLATES: { type: CommunicationType; status: CommunicationStatus; notes: string }[] = [
  { type: "WhatsApp", status: "Sent", notes: "Shared latest catalog and pricing sheet." },
  { type: "Email", status: "Opened", notes: "Sent quotation request for bulk order." },
  { type: "Call", status: "Completed", notes: "Discussed MOQ and delivery timeline." },
  { type: "Meeting", status: "Scheduled", notes: "Follow-up meeting to finalize contract terms." },
  { type: "Email", status: "Sent", notes: "Requested updated compliance certificates." },
  { type: "WhatsApp", status: "Pending", notes: "Awaiting response on sample shipment." },
  { type: "Call", status: "Missed", notes: "Attempted follow-up call, no response." },
  { type: "Meeting", status: "Completed", notes: "Onboarding walkthrough with supplier team." },
];

// Mock data — swap for a real `GET /api/suppliers/:id/history` call later;
// callers only depend on this function's signature.
export function getCommunicationHistory(supplierId: string): CommunicationEntry[] {
  const count = 5 + (hashString(supplierId) % 5); // 5-9 entries
  const baseDate = new Date("2026-07-30T00:00:00Z");

  const entries = Array.from({ length: count }, (_, i) => {
    const template = TEMPLATES[hashString(`${supplierId}-${i}`) % TEMPLATES.length];
    const daysAgo = i * (2 + (hashString(`${supplierId}-day-${i}`) % 4));
    const date = new Date(baseDate);
    date.setDate(date.getDate() - daysAgo);
    const user = USERS[hashString(`${supplierId}-user-${i}`) % USERS.length];

    return {
      id: `${supplierId}-hist-${i}`,
      date: date.toISOString(),
      type: template.type,
      user,
      status: template.status,
      notes: template.notes,
    };
  });

  return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function formatHistoryDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
