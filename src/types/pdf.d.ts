// src/types/pdf.d.ts

declare module 'pdfjs-dist' {
    export function getDocument(data: ArrayBuffer): Promise<PDFDocumentProxy>;
    
    export interface PDFDocumentProxy {
      numPages: number;
      getPage(pageNumber: number): Promise<PDFPageProxy>;
    }
    
    export interface PDFPageProxy {
      getTextContent(): Promise<TextContent>;
    }
    
    export interface TextContent {
      items: Array<{
        str: string;
      }>;
    }
  }