# Vikash AI

A responsive multimodal chatbot built with Next.js, TypeScript, Tailwind CSS, Groq, GPT OSS, and Llama vision.

## Setup

```bash
npm install
cp .env.example .env.local
# Add your Groq API key to .env.local
npm run dev
```

Open http://localhost:3000. Images are described by the configured Groq vision model before being passed to `openai/gpt-oss-20b`; PDF text is extracted server-side and supplied as context. Uploaded files are capped at 10 MB.
