import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vikash AI — Think beyond the prompt",
  description: "A fast, multimodal AI assistant powered by Groq.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
