"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Bot, FileText, Menu, Paperclip, Plus, Sparkles, User, X } from "lucide-react";

type Message = { id: string; role: "user" | "assistant"; content: string; attachment?: string };
type Upload = { name: string; kind: "image" | "pdf"; data: string; preview?: string };
const suggestions = ["Explain a complex topic simply", "Analyze an image or PDF", "Help me write something", "Brainstorm a new project"];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [upload, setUpload] = useState<Upload | null>(null);
  const [loading, setLoading] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), [messages, loading]);
  useEffect(() => () => { if (upload?.preview) URL.revokeObjectURL(upload.preview); }, [upload]);

  function onFile(file?: File) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return alert("Files must be 10 MB or smaller.");
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isImage = file.type.startsWith("image/");
    if (!isPdf && !isImage) return alert("Please choose a PDF or image file.");
    const reader = new FileReader();
    reader.onerror = () => alert("Could not read that file.");
    reader.onload = () => {
      const result = String(reader.result);
      setUpload({ name: file.name, kind: isPdf ? "pdf" : "image", data: isPdf ? result.split(",")[1] : result, preview: isImage ? URL.createObjectURL(file) : undefined });
    };
    reader.readAsDataURL(file);
  }

  async function send(text = input) {
    const clean = text.trim();
    if ((!clean && !upload) || loading) return;
    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content: clean || "Please analyze this file.", attachment: upload?.name };
    const prior = messages.map(({ role, content }) => ({ role, content }));
    setMessages(m => [...m, userMessage]); setInput(""); setLoading(true);
    const currentUpload = upload; setUpload(null);
    const assistantId = crypto.randomUUID();
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        message: userMessage.content, history: prior,
        image: currentUpload?.kind === "image" ? { dataUrl: currentUpload.data, name: currentUpload.name } : undefined,
        pdf: currentUpload?.kind === "pdf" ? { base64: currentUpload.data, name: currentUpload.name } : undefined,
      }) });
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || "Request failed."); }
      if (!response.body) throw new Error("Streaming is unavailable.");
      setMessages(m => [...m, { id: assistantId, role: "assistant", content: "" }]);
      const reader = response.body.getReader(); const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages(m => m.map(item => item.id === assistantId ? { ...item, content: item.content + chunk } : item));
      }
    } catch (error) {
      setMessages(m => [...m.filter(x => x.id !== assistantId), { id: crypto.randomUUID(), role: "assistant", content: `Sorry, something went wrong: ${error instanceof Error ? error.message : "Please try again."}` }]);
    } finally { setLoading(false); }
  }

  return <main className="flex h-dvh overflow-hidden bg-[#f7f7f4] font-sans">
    {sidebar && <button aria-label="Close sidebar" className="fixed inset-0 z-20 bg-black/25 md:hidden" onClick={() => setSidebar(false)} />}
    <aside className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-black/5 bg-[#eeeeE9] p-4 transition-transform md:static md:translate-x-0 ${sidebar ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="flex items-center justify-between px-2 py-2"><div className="flex items-center gap-2 font-semibold"><span className="grid size-8 place-items-center rounded-xl bg-black text-lime"><Sparkles size={16}/></span> Vikash AI</div><button className="md:hidden" onClick={() => setSidebar(false)}><X size={20}/></button></div>
      <button onClick={() => { setMessages([]); setSidebar(false); }} className="mt-6 flex items-center gap-3 rounded-xl border border-black/10 bg-white/70 px-3 py-3 text-sm font-medium transition hover:bg-white"><Plus size={17}/> New conversation</button>
      <div className="mt-7 px-2 text-[11px] font-semibold uppercase tracking-[.16em] text-neutral-400">Today</div>
      <div className="mt-3 truncate rounded-lg bg-black/[.04] px-3 py-2 text-sm text-neutral-600">{messages[0]?.content || "Your conversations"}</div>
      <div className="mt-auto rounded-2xl bg-[#20211f] p-4 text-white"><div className="text-sm font-medium">Powered by Groq</div><div className="mt-1 text-xs leading-5 text-neutral-400">Fast answers with GPT OSS and multimodal intelligence.</div></div>
    </aside>

    <section className="relative flex min-w-0 flex-1 flex-col">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-black/5 px-4 md:px-7"><button className="md:hidden" onClick={() => setSidebar(true)}><Menu/></button><div className="hidden text-sm font-medium md:block">Vikash AI <span className="ml-2 rounded-full bg-lime/60 px-2 py-1 text-[10px] uppercase tracking-wider">Online</span></div><div className="text-xs text-neutral-400">openai/gpt-oss-20b</div></header>
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center px-5 pb-28 pt-12">
          <div className="mb-6 grid size-12 place-items-center rounded-2xl bg-ink text-lime shadow-lg"><Sparkles size={22}/></div>
          <h1 className="max-w-xl text-4xl font-semibold tracking-[-.045em] text-ink sm:text-5xl">What can we explore <span className="text-neutral-400">together?</span></h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-neutral-500">Ask anything, or upload an image or PDF. I’ll turn your context into clear, useful answers.</p>
          <div className="mt-9 grid gap-2 sm:grid-cols-2">{suggestions.map(s => <button key={s} onClick={() => { setInput(s); }} className="rounded-2xl border border-black/[.08] bg-white p-4 text-left text-sm text-neutral-600 shadow-sm transition hover:-translate-y-0.5 hover:border-black/20">{s}<ArrowUp className="float-right rotate-45 text-neutral-300" size={16}/></button>)}</div>
        </div> : <div className="mx-auto max-w-3xl space-y-7 px-4 py-8 sm:px-6">{messages.map(m => <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
          {m.role === "assistant" && <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-ink text-lime"><Bot size={16}/></span>}
          <div className={`max-w-[85%] ${m.role === "user" ? "rounded-2xl rounded-tr-sm bg-ink px-4 py-3 text-white" : "pt-1 text-neutral-700"}`}>{m.attachment && <div className="mb-2 flex items-center gap-2 text-xs opacity-70"><FileText size={14}/>{m.attachment}</div>}<div className="prose-message text-[15px] leading-7">{m.content}</div></div>
          {m.role === "user" && <span className="grid size-8 shrink-0 place-items-center rounded-xl border border-black/10 bg-white"><User size={15}/></span>}
        </div>)}{loading && !messages.some(m => m.role === "assistant" && !m.content) && <div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-xl bg-ink text-lime"><Bot size={16}/></span><div className="flex gap-1 rounded-xl bg-white px-4 py-3"><i className="dot size-1.5 rounded-full bg-neutral-500"/><i className="dot size-1.5 rounded-full bg-neutral-500"/><i className="dot size-1.5 rounded-full bg-neutral-500"/></div></div>}<div ref={bottomRef}/></div>}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#f7f7f4] via-[#f7f7f4] to-transparent px-4 pb-4 pt-10">
        <div className="pointer-events-auto mx-auto max-w-3xl">{upload && <div className="mb-2 inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs shadow-sm">{upload.preview ? <img src={upload.preview} alt="Upload preview" className="size-8 rounded-md object-cover"/> : <FileText size={18}/>}<span className="max-w-48 truncate">{upload.name}</span><button onClick={() => setUpload(null)}><X size={14}/></button></div>}
          <div className="flex items-end gap-2 rounded-[22px] border border-black/10 bg-white p-2 shadow-[0_10px_35px_rgba(0,0,0,.08)] focus-within:border-black/25"><input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" hidden onChange={e => { onFile(e.target.files?.[0]); e.target.value = ""; }}/><button aria-label="Attach image or PDF" onClick={() => fileRef.current?.click()} className="grid size-10 shrink-0 place-items-center rounded-xl text-neutral-500 transition hover:bg-neutral-100"><Paperclip size={19}/></button><textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} rows={1} placeholder="Message Vikash AI..." className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-1 py-2.5 text-sm outline-none placeholder:text-neutral-400"/><button disabled={loading || (!input.trim() && !upload)} onClick={() => send()} className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink text-white transition enabled:hover:scale-105 disabled:opacity-25"><ArrowUp size={18}/></button></div>
          <p className="mt-2 text-center text-[10px] text-neutral-400">AI can make mistakes. Verify important information.</p>
        </div>
      </div>
    </section>
  </main>;
}
