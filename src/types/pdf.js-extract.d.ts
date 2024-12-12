declare module 'pdf.js-extract' {
  export class PDFExtract {
    extractBuffer(buffer: Buffer): Promise<{
      pages: Array<{
        content: Array<{ str: string }>;
      }>;
    }>;
  }
} 