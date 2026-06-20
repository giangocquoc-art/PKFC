// Document Intelligence Agent
// ===========================
// Lightweight RAG-style knowledge base for store operating SOPs, food safety,
// delivery handling, refund/complaint policy, campaign rules, staff checklists,
// and manager SOPs. Documents are chunked, embedded as keyword vectors (TF-IDF
// style cosine similarity — no external embedding model needed), and retrieved
// to ground the Smart Interaction Agent's answers.
//
// In production this would be replaced by LlamaIndex/Unstructured + a vector
// DB. Here we ship a self-contained keyword retrieval that works offline.

export interface KnowledgeDocument {
  id: string;
  title: string;
  source: string; // filename or "built-in"
  category: "sop" | "food-safety" | "delivery" | "refund" | "campaign" | "staff-checklist" | "manager-sop" | "faq";
  uploadedAt: string;
  chunks: KnowledgeChunk[];
}

export interface KnowledgeChunk {
  id: string;
  docId: string;
  text: string;
  source: string;
  category: KnowledgeDocument["category"];
}

export interface KnowledgeSnippet extends KnowledgeChunk {
  score: number;
}

let _seq = 0;
function kid(): string {
  _seq += 1;
  return `k-${Date.now().toString(36)}-${_seq.toString(36)}`;
}

function chunkText(text: string, maxLen = 280): string[] {
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    if ((current + "\n\n" + p).length > maxLen && current) {
      chunks.push(current.trim());
      current = p;
    } else {
      current = current ? `${current}\n\n${p}` : p;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/** Tokenise text into lowercase keyword tokens (simple, no stopword removal). */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

/** Build a term-frequency map. */
function tf(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

/** Cosine similarity between two TF maps. */
function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [k, v] of a) {
    normA += v * v;
    if (b.has(k)) dot += v * (b.get(k) ?? 0);
  }
  for (const [, v] of b) normB += v * v;
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// In-memory knowledge base.
const documents: KnowledgeDocument[] = [];
const chunkIndex: { chunk: KnowledgeChunk; tf: Map<string, number> }[] = [];
let _seeded = false;

/** Seed the built-in knowledge base on first import. */
function seedBuiltins() {
  if (_seeded) return;
  _seeded = true;
  const builtins: { title: string; category: KnowledgeDocument["category"]; text: string }[] = [
    {
      title: "Store Opening SOP",
      category: "sop",
      text: `Store Opening SOP
Arrive 30 minutes before opening. Turn on all kitchen equipment and verify oil temperature. Check inventory floor: chicken raw, buckets, cups, bags. Confirm staff present vs scheduled. Review today's weather risk and adjust early batch size. Log waste from previous day. Set POS to active. Confirm delivery aggregator is online.`,
    },
    {
      title: "Food Safety Notes",
      category: "food-safety",
      text: `Food Safety
Fried chicken must reach internal temperature 74°C. Hold cooked chicken in warmer at 60°C minimum, max 2 hours. Discard any chicken held beyond 2 hours. Raw chicken storage: 0-4°C. First-in-first-out (FIFO) for all ingredients. Allergen: peanut oil used — inform customers on request. Sanitise prep surfaces every 2 hours.`,
    },
    {
      title: "Delivery Handling Policy",
      category: "delivery",
      text: `Delivery Handling
All delivery orders must be packed in sealed bags. Hot items on top, cold items separate. Target pack-to-dispatch SLA: under 8 minutes. If dispatch delay exceeds 15 minutes, inform the customer via the aggregator chat. During rain, set ETA buffer +10 minutes. If a rider cancels, reassign within 3 minutes. Never release an order without a valid pickup code.`,
    },
    {
      title: "Refund & Complaint Policy (placeholder)",
      category: "refund",
      text: `Refund & Complaint Policy
Staff may NOT promise refunds, free items, or policy exceptions. For any complaint: (1) apologise, (2) log the complaint with order ID and reason, (3) escalate to store manager. Manager may approve: full refund for missing items, partial refund for delayed orders over 30 minutes, replacement for cold food. All refunds must be logged with reason code. Do NOT admit fault for delivery delays caused by weather — cite "unforeseen weather conditions".`,
    },
    {
      title: "Campaign Rules",
      category: "campaign",
      text: `Campaign Rules
Campaigns must target the right channel for the weather window: rain → delivery/takeaway combo; heat → cold beverage combo; mall stores → dine-in family bundles. Budget cap: 1.5x baseline during high-risk weather, 1x otherwise. Push notification timing: 10:30 for lunch, 16:30 for dinner. Never run dine-in discount during rain for non-mall stores. All campaigns require area-manager approval before launch.`,
    },
    {
      title: "Staff Checklist — Lunch Peak",
      category: "staff-checklist",
      text: `Staff Lunch Peak Checklist
Kitchen: confirm oil temp, fry in smaller batches if rain (walk-in drop). Counter: greet, upsell combo. Runner: keep dine-in area clear, restock napkins. Online-order packer: confirm pickup codes, seal bags. All: 5-min rotation break per hour if heat risk high. Report any stockout to lead immediately.`,
    },
    {
      title: "Manager SOP — Daily",
      category: "manager-sop",
      text: `Manager Daily SOP
Open: review Agent CaMate briefing, adjust prep, confirm staffing. Lunch: monitor walk-in vs forecast, adjust batch. Afternoon: log waste, confirm replenishment. Dinner: monitor delivery surge, adjust packing. Close: file EOD summary with actuals vs forecast, log learnings. Escalate any critical incident to area manager by phone.`,
    },
    {
      title: "FAQ",
      category: "faq",
      text: `FAQ
Q: Can I change the staff roster mid-shift? A: Yes, but log the change and the reason. Major changes need manager approval.
Q: What if the weather app says rain but Agent CaMate says low risk? A: Agent CaMate uses micro-local signals for your store. Trust the store-level risk.
Q: Can I send a customer a refund myself? A: No. Draft a reply and escalate to the manager. Only the manager approves refunds.
Q: How often should I re-run the agent? A: At open, before lunch, before dinner, and any time weather shifts significantly.`,
    },
  ];
  for (const b of builtins) {
    addDocument(b.title, b.text, "built-in", b.category);
  }
}

/** Add a document to the knowledge base. Returns the created document. */
export function addDocument(
  title: string,
  text: string,
  source: string,
  category: KnowledgeDocument["category"],
): KnowledgeDocument {
  seedBuiltins();
  const docId = kid();
  const chunks: KnowledgeChunk[] = chunkText(text).map((c) => ({
    id: kid(),
    docId,
    text: c,
    source,
    category,
  }));
  const doc: KnowledgeDocument = {
    id: docId,
    title,
    source,
    category,
    uploadedAt: new Date().toISOString(),
    chunks,
  };
  documents.push(doc);
  for (const chunk of chunks) {
    chunkIndex.push({ chunk, tf: tf(tokenize(chunk.text)) });
  }
  return doc;
}

/** Retrieve the top-N most relevant snippets for a query. */
export function retrieve(query: string, n = 4): KnowledgeSnippet[] {
  seedBuiltins();
  const queryTf = tf(tokenize(query));
  const scored = chunkIndex.map(({ chunk, tf }) => ({
    ...chunk,
    score: cosine(queryTf, tf),
  }));
  return scored.sort((a, b) => b.score - a.score).slice(0, n).filter((s) => s.score > 0.01);
}

/** List all documents in the knowledge base. */
export function listDocuments(): KnowledgeDocument[] {
  seedBuiltins();
  return documents;
}

/** Generate a checklist from the knowledge base for a topic. */
export function generateChecklist(topic: string): { items: string[]; sources: string[] } {
  const snippets = retrieve(topic, 5);
  const items: string[] = [];
  const sources = new Set<string>();
  for (const s of snippets) {
    sources.add(s.source);
    // Extract lines that look like action items.
    for (const line of s.text.split("\n")) {
      const trimmed = line.trim();
      if (/^[-•*]|^\d+\./.test(trimmed)) {
        items.push(trimmed.replace(/^[-•*]\s*|^\d+\.\s*/, ""));
      } else if (trimmed.length > 10 && trimmed.length < 120 && !trimmed.endsWith(":")) {
        items.push(trimmed);
      }
    }
  }
  return { items: items.slice(0, 8), sources: [...sources] };
}

/** Answer a question using only the knowledge base (for the KB panel). */
export function answerFromKnowledge(question: string): {
  answer: string;
  sources: { source: string; category: string; snippet: string; score: number }[];
  confidence: number;
} {
  const snippets = retrieve(question, 4);
  if (!snippets.length) {
    return {
      answer: "I couldn't find a relevant answer in the knowledge base. Try uploading the relevant SOP or policy document, or ask the Smart Interaction Agent which also uses live operations data.",
      sources: [],
      confidence: 0.2,
    };
  }
  const answer = `Based on the knowledge base:\n\n${snippets
    .map((s, i) => `${i + 1}. ${s.text.slice(0, 200)}${s.text.length > 200 ? "…" : ""}`)
    .join("\n\n")}`;
  return {
    answer,
    sources: snippets.map((s) => ({
      source: s.source,
      category: s.category,
      snippet: s.text.slice(0, 120),
      score: s.score,
    })),
    confidence: Math.min(0.9, snippets[0].score + 0.3),
  };
}
