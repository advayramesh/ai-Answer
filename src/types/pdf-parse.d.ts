declare module 'pdf-parse' {
  interface PDFData {
    text: string;
    numpages: number;
    info: any;
  }
  
  function PDFParse(buffer: Buffer): Promise<PDFData>;
  export default PDFParse;
} 