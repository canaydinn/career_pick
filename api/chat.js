// api/chat.js
// Vercel Serverless Function — Node.js 18 runtime
//
// POST /api/chat
// Pipeline: OpenAI embedding -> Qdrant semantic search -> GPT-4o RAG yanit

import OpenAI from "openai";
import { QdrantClient } from "@qdrant/js-client-rest";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCors(res);

  // OPTIONS preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Yalnizca POST destekleniyor." });
  }

  // ADIM 0: Input validasyonu
  const { message, history } = req.body || {};
  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Mesaj bos olamaz" });
  }
  if (message.length > 2000) {
    return res.status(400).json({ error: "Mesaj cok uzun" });
  }

  let results = [];

  try {
    // ADIM 1: Embedding uret
    let embedding;
    try {
      const embedResponse = await openai.embeddings.create({
        model: "text-embedding-3-large",
        input: message,
      });
      embedding = embedResponse.data[0].embedding;
      console.log("[EMBED] Embedding uretildi, boyut:", embedding.length);
    } catch (error) {
      console.error("[ERROR]", error.message);
      return res
        .status(503)
        .json({ error: "AI servisi su an kullanilamiyor, lutfen tekrar deneyin." });
    }

    // ADIM 2: Qdrant'ta ara (graceful fallback)
    try {
      const qdrant = new QdrantClient({
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY,
      });
      const searchResult = await qdrant.search(process.env.QDRANT_COLLECTION_NAME, {
        vector: embedding,
        limit: 5,
        score_threshold: 0.65,
        with_payload: true,
      });
      results = Array.isArray(searchResult) ? searchResult : [];
      console.log("[RAG]", results.length, "sonuc bulundu");
    } catch (error) {
      console.error("[ERROR]", error.message);
      results = [];
    }

    // ADIM 3: RAG context olustur
    let contextText = "";
    if (results.length > 0) {
      contextText = "## Bilgi Tabani\n\n";
      for (const result of results) {
        const payload = result.payload || {};
        contextText += `### ${payload.chunk_type}\n${payload.text}\n\n`;
      }
    }

    // ADIM 4: GPT-4o ile yanit uret
    const systemPrompt = `Sen CareerPick platformunun kariyer danismanisin. Turkiye'deki kullanicilara
kariyer kesfi, yetkinlik gelisimi ve meslek secimi konularinda yardim ediyorsun.

Kurallar:
- Her zaman Turkce yanit ver
- Bilgi Tabani bolumu varsa oncelikle oradan yararlan
- Somut, uygulanabilir ve motive edici ol
- Turkiye is piyasasi gerceklerini goz onunde bulundur
- Maksimum 3-4 paragraf veya madde listesi kullan

${contextText}`;

    const trimmedHistory = Array.isArray(history)
      ? history
          .filter(
            (m) =>
              m &&
              (m.role === "user" || m.role === "assistant") &&
              typeof m.content === "string"
          )
          .slice(-8)
          .map((m) => ({ role: m.role, content: m.content }))
      : [];

    const messages = [
      { role: "system", content: systemPrompt },
      ...trimmedHistory,
      { role: "user", content: message },
    ];

    let gptReply;
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages,
        max_tokens: 800,
        temperature: 0.7,
      });
      gptReply = completion.choices[0].message.content;
      console.log("[LLM] Yanit uretildi,", gptReply.length, "karakter");
    } catch (error) {
      console.error("[ERROR]", error.message);
      return res
        .status(503)
        .json({ error: "AI servisi su an kullanilamiyor, lutfen tekrar deneyin." });
    }

    // ADIM 5: Response dondur
    return res.status(200).json({
      reply: gptReply,
      sources: results.map((r) => ({
        chunk_type: r.payload?.chunk_type,
        meslek_adi: r.payload?.meslek_adi || null,
        yetkinlik_adi: r.payload?.yetkinlik_adi || null,
        score: Math.round(r.score * 100) / 100,
      })),
      ragUsed: results.length > 0,
    });
  } catch (error) {
    console.error("[ERROR]", error.message);
    return res.status(500).json({ error: "Beklenmedik bir hata olustu." });
  }
}
