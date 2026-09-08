import Groq from "groq-sdk";
import pdf from "pdf-parse/lib/pdf-parse.js";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_CONTEXT_CHARS = 70_000;
const TEXT_MODEL = "openai/gpt-oss-20b";
const VISION_MODEL = process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";

type HistoryItem = { role: "user" | "assistant"; content: string };
type RequestBody = {
  message?: string;
  history?: HistoryItem[];
  image?: { dataUrl: string; name?: string };
  pdf?: { base64: string; name?: string };
  pdfText?: string;
};

function validateDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("Unsupported image. Use PNG, JPEG, WebP, or GIF.");
  if (Buffer.byteLength(match[2], "base64") > MAX_FILE_BYTES) throw new Error("Image exceeds the 10 MB limit.");
  return dataUrl;
}

async function withTimeout<T>(promise: Promise<T>, ms = 55_000): Promise<T> {
  return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("The AI request timed out. Please try again.")), ms))]);
}

export async function POST(request: Request) {
  try {
    if (!process.env.GROQ_API_KEY) return Response.json({ error: "GROQ_API_KEY is not configured." }, { status: 500 });
    const body = await request.json() as RequestBody;
    const message = body.message?.trim() || "Please analyze the attached file.";
    if (message.length > 20_000) return Response.json({ error: "Message is too long." }, { status: 413 });

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    let context = "";

    if (body.image?.dataUrl) {
      const imageUrl = validateDataUrl(body.image.dataUrl);
      const vision = await withTimeout(groq.chat.completions.create({
        model: VISION_MODEL,
        temperature: 0.2,
        max_tokens: 1800,
        messages: [{ role: "user", content: [
          { type: "text", text: "Describe this image in detail and extract all text you see. Be objective and precise." },
          { type: "image_url", image_url: { url: imageUrl } },
        ] }],
      }));
      context += `\n[Image Description: ${vision.choices[0]?.message?.content || "No description available."}]`;
    }

    if (body.pdf?.base64) {
      const buffer = Buffer.from(body.pdf.base64, "base64");
      if (buffer.length > MAX_FILE_BYTES) return Response.json({ error: "PDF exceeds the 10 MB limit." }, { status: 413 });
      const parsed = await pdf(buffer);
      context += `\n[Context from uploaded PDF: ${parsed.text.slice(0, MAX_CONTEXT_CHARS)}]`;
    } else if (body.pdfText) {
      context += `\n[Context from uploaded PDF: ${body.pdfText.slice(0, MAX_CONTEXT_CHARS)}]`;
    }

    const history = Array.isArray(body.history) ? body.history.slice(-12)
      .filter((m): m is HistoryItem => ["user", "assistant"].includes(m?.role) && typeof m?.content === "string")
      .map(m => ({ role: m.role, content: m.content.slice(0, 12_000) })) : [];

    const completion = await withTimeout(groq.chat.completions.create({
      model: TEXT_MODEL,
      stream: true,
      temperature: 0.65,
      max_tokens: 4096,
      messages: [
        { role: "system", content: "You are Vikash AI, a helpful, precise, highly capable assistant. Give clear, accurate answers. Use uploaded context when relevant, and say when the context is insufficient." },
        ...history,
        { role: "user", content: context ? `${context}\n\nUser query: ${message}` : message },
      ],
    }));

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of completion) {
            const text = chunk.choices[0]?.delta?.content;
            if (text) controller.enqueue(encoder.encode(text));
          }
          controller.close();
        } catch (error) { controller.error(error); }
      },
    });
    return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    console.error("Chat API error:", error);
    return Response.json({ error: message }, { status: 500 });
  }
}
