# Vikash AI

A responsive multimodal chatbot built with Next.js, TypeScript, Tailwind CSS, Groq, GPT OSS, and Qwen vision.

## Setup

```bash
npm install
cp .env.example .env.local
# Add your Groq API key to .env.local
npm run dev
```

Open http://localhost:3000. Images are described by Groq’s `qwen/qwen3.8-27b` vision model (overridable with `GROQ_VISION_MODEL`) before being passed to `openai/gpt-oss-20b`; PDF text is extracted server-side and supplied as context. Uploaded files are capped at 10 MB.
