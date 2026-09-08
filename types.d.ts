declare module "pdf-parse/lib/pdf-parse.js" {
  type PdfResult = { numpages: number; numrender: number; info: unknown; metadata: unknown; text: string; version: string };
  export default function pdf(data: Buffer, options?: Record<string, unknown>): Promise<PdfResult>;
}
