// POST /api/knowledge/ask — Document Intelligence Agent (knowledge base Q&A + upload)
// Body: { question: string }  OR  { question: "__upload__:<title>:<text>" }
import { NextResponse } from "next/server";
import {
  answerFromKnowledge,
  listDocuments,
  retrieve,
  addDocument,
} from "@/lib/knowledge/documentIntelligenceAgent";

export async function POST(req: Request) {
  let body: { question?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.question) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  // Special upload prefix: __upload__:<title>:<text>
  if (body.question.startsWith("__upload__:")) {
    const rest = body.question.slice("__upload__:".length);
    const sep = rest.indexOf(":");
    if (sep === -1) {
      return NextResponse.json({ error: "invalid upload format" }, { status: 400 });
    }
    const title = rest.slice(0, sep).trim();
    const text = rest.slice(sep + 1).trim();
    if (!title || !text) {
      return NextResponse.json({ error: "title and text required" }, { status: 400 });
    }
    const doc = addDocument(title, text, "user-upload", "sop");
    return NextResponse.json({ uploaded: true, docId: doc.id, title: doc.title, documents: listDocuments() });
  }

  const result = answerFromKnowledge(body.question);
  return NextResponse.json({ ...result, question: body.question, documents: listDocuments() });
}

// GET — list documents + retrieve snippets for a query
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") ?? "";
  const docs = listDocuments();
  if (query) {
    const snippets = retrieve(query, 5);
    return NextResponse.json({ documents: docs, snippets });
  }
  return NextResponse.json({ documents: docs });
}
