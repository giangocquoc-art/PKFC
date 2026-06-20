# KNOWLEDGE_BASE.md — Document Intelligence Agent / Knowledge Base

> Part of **Agent CaMate — StoreOps Autopilot** (Agentic AI Build Week 2026, F&B track).
> **Hackathon pilot-ready build. NOT an official KFC product.**

This document covers the **Document Intelligence Agent** (`src/lib/knowledge/documentIntelligenceAgent.ts`): the 8 built-in knowledge documents, the chunking + TF-IDF cosine retrieval approach, the `KnowledgeSnippet` retrieval + `answerFromKnowledge` with source attribution, the in-memory document upload (swappable for LlamaIndex + vector DB in production), `generateChecklist` from documents, and how the Smart Interaction Agent uses the knowledge base as grounding.

For how the retrieved snippets ground the Smart Interaction Agent's answers, see [`SMART_INTERACTION.md`](./SMART_INTERACTION.md).
For the live operations signals that complement the knowledge base, see [`REAL_TIME_DATA.md`](./REAL_TIME_DATA.md).

---

## 1. What the Document Intelligence Agent does

The Document Intelligence Agent is the **lightweight RAG (Retrieval-Augmented Generation) layer** of the StoreOps Autopilot. It provides:

1. **A self-contained knowledge base** of 8 built-in documents covering store SOPs, food safety, delivery handling, refund/complaint policy, campaign rules, staff checklists, manager SOPs, and FAQs.
2. **Chunking + TF-IDF cosine retrieval** — no external embedding model, no API calls, works offline.
3. **`answerFromKnowledge(question)`** — answers a question using only the knowledge base, with source attribution and confidence.
4. **`generateChecklist(topic)`** — extracts action items from retrieved snippets to produce a checklist.
5. **Document upload** — in-memory `addDocument()` lets users paste new SOPs/policies that are immediately retrievable.

The knowledge base is the **policy/SOP ground truth**. The Smart Interaction Agent uses it as one of its grounding sources alongside the live operational context (weather, action plan, real-time metrics).

---

## 2. The 8 built-in knowledge documents

Seeded on first import via `seedBuiltins()` in `src/lib/knowledge/documentIntelligenceAgent.ts`. Each document has a `title`, `category`, `source: "built-in"`, and a short text body.

| # | Title | Category | Content summary |
|---|---|---|---|
| 1 | Store Opening SOP | `sop` | Arrive 30 min before open. Verify oil temp. Check inventory floor. Confirm staff vs scheduled. Review weather risk. Adjust early batch. Log waste. Set POS active. Confirm delivery aggregator online. |
| 2 | Food Safety Notes | `food-safety` | Internal temp 74°C. Hold at 60°C min, max 2h. Discard beyond 2h. Raw storage 0–4°C. FIFO. Allergen: peanut oil. Sanitise every 2h. |
| 3 | Delivery Handling Policy | `delivery` | Sealed bags. Hot on top, cold separate. Pack-to-dispatch SLA <8 min. If dispatch >15 min, inform customer via aggregator chat. Rain: ETA buffer +10 min. Rider cancel: reassign <3 min. Never release without pickup code. |
| 4 | Refund & Complaint Policy (placeholder) | `refund` | Staff may NOT promise refunds/free items/policy exceptions. (1) apologise, (2) log with order ID + reason, (3) escalate to manager. Manager may approve: full refund for missing items, partial for >30 min delay, replacement for cold food. Do NOT admit fault for weather delays — cite "unforeseen weather conditions". |
| 5 | Campaign Rules | `campaign` | Right channel for weather: rain → delivery/takeaway combo; heat → cold beverage combo; mall → dine-in family bundles. Budget cap 1.5x baseline in high-risk weather, 1x otherwise. Push timing 10:30 (lunch), 16:30 (dinner). Never run dine-in discount during rain for non-mall stores. All campaigns require area-manager approval. |
| 6 | Staff Checklist — Lunch Peak | `staff-checklist` | Kitchen: oil temp, smaller batches if rain. Counter: greet, upsell combo. Runner: clear dine-in, restock napkins. Online-order packer: pickup codes, seal bags. All: 5-min break/hour if heat risk high. Report stockout to lead immediately. |
| 7 | Manager SOP — Daily | `manager-sop` | Open: review Agent CaMate briefing, adjust prep, confirm staffing. Lunch: monitor walk-in vs forecast, adjust batch. Afternoon: log waste, confirm replenishment. Dinner: monitor delivery surge, adjust packing. Close: file EOD with actuals vs forecast, log learnings. Escalate critical incidents to area manager by phone. |
| 8 | FAQ | `faq` | Q: Change roster mid-shift? A: Yes, log + reason. Major changes need manager approval. Q: Weather app says rain but Agent CaMate says low risk? A: Agent CaMate uses micro-local signals — trust store-level risk. Q: Send refund myself? A: No, draft + escalate. Q: How often to re-run agent? A: Open, pre-lunch, pre-dinner, on weather shift. |

### 2.1 The Refund & Complaint Policy is a placeholder

Document #4 is explicitly labelled `(placeholder)` in its title. It represents the **shape** of a real KFC refund policy, not the actual policy text. For a real pilot, this document would be replaced with the official KFC VN refund/complaint policy PDF (parsed via Unstructured — see §7).

---

## 3. The chunking + TF-IDF cosine retrieval approach

The Document Intelligence Agent uses a **deliberately lightweight retrieval approach** — no external embedding model, no vector database, no API calls. It works fully offline.

### 3.1 Chunking

`chunkText(text, maxLen = 280)` splits each document into chunks:

1. Split on double-newlines (paragraph boundaries).
2. Greedily accumulate paragraphs into a chunk until adding the next would exceed `maxLen` characters.
3. Start a new chunk when the current one is full.

A 280-character max gives ~3–5 chunks per built-in document — small enough for precise retrieval, large enough to keep context.

Each chunk is stored as a `KnowledgeChunk`:

```ts
{
  id: string,        // "k-<base36 ts>-<seq>"
  docId: string,
  text: string,
  source: string,    // "built-in" or "user-upload"
  category: "sop" | "food-safety" | "delivery" | "refund" | "campaign" | "staff-checklist" | "manager-sop" | "faq",
}
```

### 3.2 Tokenization

`tokenize(text)` produces lowercase keyword tokens:

1. Lowercase the text.
2. Replace all non-letter/non-number characters with spaces (Unicode-aware: `[^\p{L}\p{N}\s]`).
3. Split on whitespace.
4. Filter tokens shorter than 3 characters (drops "a", "is", "of", etc. without an explicit stopword list).

This is intentionally simple — no stemming, no stopword list, no PhoBERT/vnTokenizer for Vietnamese. The built-in documents are in English; Vietnamese questions will retrieve English chunks if they share Latin-script keywords (e.g. "delivery", "packaging"). A production build would add a Vietnamese-aware tokenizer (see §7).

### 3.3 Term-frequency maps

`tf(tokens)` builds a `Map<string, number>` of token → count. Each chunk's TF map is precomputed at upload time and stored in `chunkIndex`:

```ts
const chunkIndex: { chunk: KnowledgeChunk; tf: Map<string, number> }[] = [];
```

### 3.4 Cosine similarity

`cosine(a, b)` computes the cosine similarity between two TF maps:

```
cosine = (Σ a[k] × b[k]) / (‖a‖ × ‖b‖)
```

This is **TF-only cosine** (no IDF weighting). For a small, curated knowledge base (8 documents, ~30 chunks), TF-only cosine is sufficient and avoids the need for a corpus statistics pass. A production build with hundreds of documents would add IDF weighting (see §7).

### 3.5 Retrieve

`retrieve(query, n = 4)`:

1. Tokenize the query.
2. Build the query TF map.
3. Score every chunk in `chunkIndex` by `cosine(queryTf, chunkTf)`.
4. Sort descending, take the top `n`, filter out scores below `0.01` (avoid noise).
5. Return as `KnowledgeSnippet[]` (a `KnowledgeChunk` with an added `score: number`).

### 3.6 Why this approach

- **No external dependency:** no OpenAI embeddings API, no vector DB, no GPU. Works in any environment.
- **Fast:** scoring ~30 chunks against a query is sub-millisecond.
- **Transparent:** the score is the cosine similarity of term-frequency vectors — explainable in a way that dense embeddings are not.
- **Honest:** the limitation is clear. This is a hackathon-quality retrieval layer, not a production RAG system. The production path is documented in §7.

---

## 4. `KnowledgeSnippet` retrieval + `answerFromKnowledge`

`answerFromKnowledge(question)` is the entry point for the Knowledge Base Panel UI (`/api/knowledge/ask`). It:

1. Calls `retrieve(question, 4)` to get the top 4 snippets.
2. If no snippets (all scores below `0.01`), returns a "couldn't find a relevant answer" response with `confidence: 0.2` and an empty `sources` array.
3. Otherwise, builds an answer string that quotes the top snippets (truncated to 200 chars each):
   ```
   Based on the knowledge base:

   1. Fried chicken must reach internal temperature 74°C. Hold cooked chicken in warmer at 60°C minimum, max 2 hours...

   2. Sanitise prep surfaces every 2 hours...
   ```
4. Returns:

```ts
{
  answer: string,
  sources: {
    source: string,       // "built-in" or "user-upload"
    category: string,     // "food-safety", "delivery", etc.
    snippet: string,      // first 120 chars of the chunk
    score: number         // cosine similarity
  }[],
  confidence: number      // min(0.9, topSnippetScore + 0.3)
}
```

The confidence is intentionally capped at `0.9` — the knowledge base is a retrieval system, not an authority. Even a perfect cosine match doesn't guarantee the answer is correct for the user's specific situation.

### 4.1 Source attribution

Every answer includes the `sources` array. The Knowledge Base Panel UI renders each source with:

- The source label (`built-in` or `user-upload`)
- The category badge (`food-safety`, `delivery`, etc.)
- The snippet text
- The cosine score (as a percentage)

This lets the user verify the answer against the underlying document — no black-box retrieval.

---

## 5. Document upload (in-memory, swappable for LlamaIndex + vector DB)

`addDocument(title, text, source, category)` is the upload entry point:

1. Calls `seedBuiltins()` to ensure the built-in documents are loaded.
2. Generates a `docId`.
3. Chunks the text via `chunkText()`.
4. Creates a `KnowledgeDocument` and pushes it to the in-memory `documents` array.
5. For each chunk, tokenizes + builds a TF map and pushes to `chunkIndex`.

The document is **immediately retrievable** — no re-indexing step, no rebuild.

### 5.1 The upload API

The `/api/knowledge/ask` POST route accepts a special upload prefix:

```
{ "question": "__upload__:<title>:<text>" }
```

When this prefix is detected, the route calls `addDocument(title, text, "user-upload", "sop")` and returns `{uploaded: true, docId, title, documents: listDocuments()}`.

The Knowledge Base Panel UI uses this to let a manager paste a new SOP/policy text and have it instantly available to both the Knowledge Base Q&A and the Smart Interaction Agent.

### 5.2 What is in-memory and what is NOT

- The `documents` and `chunkIndex` arrays are **module-level in-memory state**. They persist across requests within a single server process but are **lost on server restart**.
- There is no persistence to the SQLite database in this build. Uploaded documents vanish on `bun run dev` restart.
- The 8 built-in documents are re-seeded on every server start (via `seedBuiltins()`), so those always come back.

### 5.3 Production path: LlamaIndex + vector DB

The intended production path (NOT integrated in this build):

1. **Replace the in-memory `chunkIndex` with a vector database** (Pinecone, Weaviate, Qdrant, or pgvector). Each chunk's embedding is stored alongside its text.
2. **Replace `tokenize() + tf() + cosine()` with an embedding model** — either OpenAI `text-embedding-3-small` or a self-hosted alternative (e.g. `bge-small-en` or `PhoBERT` for Vietnamese).
3. **Use LlamaIndex** as the retrieval framework — it handles chunking, embedding, vector store integration, and retrieval in a unified API.
4. **Use Unstructured** to parse PDF/DOCX uploads (see §7.2).

The `retrieve(query, n)` and `answerFromKnowledge(question)` function signatures would not change — only their internals. The Smart Interaction Agent and the Knowledge Base Panel would continue to work without modification.

---

## 6. `generateChecklist` from documents

`generateChecklist(topic)` produces an action-item checklist from the knowledge base:

1. Calls `retrieve(topic, 5)` to get the top 5 snippets.
2. For each snippet, scans each line:
   - If the line matches `/^[-•*]|^\d+\./` (a bullet or numbered list item), strip the prefix and add to `items`.
   - Else if the line is 10–120 chars and doesn't end with `:`, add it as a prose action item.
3. Returns `{items: string[] (max 8), sources: string[]}`.

Example: `generateChecklist("lunch peak")` returns:

```ts
{
  items: [
    "Kitchen: confirm oil temp, fry in smaller batches if rain (walk-in drop)",
    "Counter: greet, upsell combo",
    "Runner: keep dine-in area clear, restock napkins",
    "Online-order packer: confirm pickup codes, seal bags",
    "All: 5-min rotation break per hour if heat risk high",
    "Report any stockout to lead immediately",
  ],
  sources: ["built-in"],
}
```

The checklist is rendered in the Knowledge Base Panel and is also available to the Task Automation Agent as a candidate source for checklist-style draft tasks.

---

## 7. How the Smart Interaction Agent uses the knowledge base

The Smart Interaction Agent treats the knowledge base as **one of several grounding sources**, alongside the live operational context. The flow (see [`SMART_INTERACTION.md`](./SMART_INTERACTION.md) §3 for full detail):

1. The `/api/chat` route calls `retrieve(question, 4)` to get the top 4 knowledge snippets.
2. The snippets are passed to `answerQuestion()` as the `knowledge` argument.
3. Inside `answerQuestion()`, the snippets are formatted into a `RELEVANT KNOWLEDGE BASE SNIPPETS:` block and appended to the system prompt.
4. The LLM now has both the live operational state (weather, plan, metrics) AND the policy/SOP context (food safety, refund policy, campaign rules, etc.).
5. The returned `SmartInteractionAnswer.sources` array includes a `{label: "Knowledge base", value: "4 snippets"}` entry so the user knows the answer was knowledge-grounded.

### 7.1 Example grounding

**Question (manager role):** "Can I promise the customer a refund for a late order?"

**Knowledge snippets retrieved:**

1. [built-in, refund] "Staff may NOT promise refunds, free items, or policy exceptions. For any complaint: (1) apologise, (2) log the complaint with order ID and reason, (3) escalate to store manager..."
2. [built-in, refund] "Manager may approve: full refund for missing items, partial refund for delayed orders over 30 minutes, replacement for cold food..."
3. [built-in, refund] "Do NOT admit fault for delivery delays caused by weather — cite 'unforeseen weather conditions'."

**Smart Interaction Agent answer (live path):**

> No — staff cannot promise refunds. Per the Refund & Complaint Policy: apologise, log the complaint with order ID and reason, and escalate to the store manager. The manager may approve a partial refund for delays over 30 minutes. For weather-related delays, do not admit fault — cite "unforeseen weather conditions". Draft a customer reply via the Smart Interaction Panel and the manager will review it.

**Sources:** Weather signal (live), Action plan (risk 68%), Real-time metrics (15 events), Knowledge base (3 snippets).

This is the **RAG pattern done right**: the LLM is grounded in both the live state and the policy, and the answer explicitly cites the policy source.

---

## 8. Integration plan: LlamaIndex for RAG, Unstructured for PDF/DOCX parsing

### 8.1 LlamaIndex

[LlamaIndex](https://github.com/run-llama/llama_index) is the intended production RAG framework. The integration plan (NOT implemented in this build):

1. **Install:** `pip install llama-index llama-index-vector-stores-qdrant` (Python sidecar) or use the TypeScript port `llamaflow.ai`.
2. **Replace the in-memory index:** swap `chunkIndex` for a LlamaIndex `VectorStoreIndex` backed by Qdrant or pgvector.
3. **Replace `tokenize() + tf() + cosine()`:** swap for an embedding model (`text-embedding-3-small` or `bge-small-en`).
4. **Keep the function signatures:** `retrieve(query, n)` and `answerFromKnowledge(question)` keep their signatures — only their internals change. The Smart Interaction Agent and Knowledge Base Panel continue to work without modification.
5. **Add metadata filters:** LlamaIndex supports filtering by `category`, `source`, `storeId` (for store-specific SOPs) — useful when the knowledge base grows beyond the 8 built-in documents.

### 8.2 Unstructured

[Unstructured](https://github.com/Unstructured-IO/unstructured) is the intended production document parser. The integration plan (NOT implemented in this build):

1. **Install:** `pip install unstructured unstructured[pdf] unstructured[docx]`.
2. **Replace the `__upload__:` text-paste API** with a real file upload endpoint that accepts PDF/DOCX/PPTX.
3. **Parse via Unstructured:** `unstructured` handles PDFs (including scanned PDFs via OCR), DOCX, PPTX, HTML, and emails — producing clean text chunks with section headings preserved.
4. **Feed the parsed chunks into LlamaIndex:** the chunking step (`chunkText()`) is replaced by Unstructured's `chunk_by_title()` or `chunk_elements()` for higher-quality chunks.
5. **Preserve source metadata:** the original filename, page numbers, and section headings are stored as LlamaIndex node metadata so the `sources` array in `answerFromKnowledge()` can say `[staff-handbook.pdf, page 12]` instead of just `[user-upload]`.

### 8.3 Reference repos

- **LlamaIndex:** https://github.com/run-llama/llama_index — the production RAG framework.
- **Unstructured:** https://github.com/Unstructured-IO/unstructured — the production document parser.

### 8.4 What is explicitly NOT claimed as integrated

- LlamaIndex and Unstructured are **NOT** installed, imported, or used in this build.
- The current retrieval is **TF-IDF cosine** — fast, transparent, offline, but limited to keyword overlap.
- Document upload is **text-paste only** via the `__upload__:` prefix — no PDF/DOCX parsing.
- The in-memory index is **lost on server restart** — no persistence.

---

## 9. API surface

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/knowledge/ask` | POST | Ask a question OR upload a document. Body: `{question}` (or `{question: "__upload__:<title>:<text>"}`). Returns the answer + sources OR the uploaded doc confirmation. |
| `/api/knowledge/ask` | GET | List all documents, optionally with retrieved snippets for a query. Query param: `?q=<query>`. Returns `{documents, snippets?}`. |
| `/api/chat` | POST | Smart Interaction Agent — calls `retrieve(question, 4)` internally and passes snippets as grounding. See [`SMART_INTERACTION.md`](./SMART_INTERACTION.md) §10. |

---

## 10. Honesty summary

- ✅ The 8 built-in knowledge documents cover the **core operational policies** (SOP, food safety, delivery, refund, campaign, staff checklist, manager SOP, FAQ).
- ✅ The TF-IDF cosine retrieval is **real and works offline** — no external dependency, no API key, no GPU.
- ✅ `answerFromKnowledge()` returns **source attribution + confidence** for every answer — no black-box retrieval.
- ✅ `generateChecklist()` produces **actionable checklists** from the knowledge base.
- ✅ The Smart Interaction Agent uses the knowledge base as **one of several grounding sources**, with the snippets cited in the returned `sources` array.
- ⚠️ The Refund & Complaint Policy document is a **placeholder**, not the real KFC VN policy.
- ⚠️ Document upload is **text-paste only** — no PDF/DOCX parsing in this build.
- ⚠️ The in-memory index is **lost on server restart** — no persistence.
- ⚠️ LlamaIndex and Unstructured are **documented as the production integration path**, NOT installed or used.
- ⚠️ This is a **hackathon pilot-ready build**, not an official KFC product. The correct framing: "Agent CaMate converts local weather and demand signals into actionable store operations plans." — it does not claim to be more accurate than weather apps.
