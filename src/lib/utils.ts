// src/lib/utils.ts

export function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    
    const truncated = text.slice(0, maxLength);
    const lastPeriod = truncated.lastIndexOf('.');
    
    return lastPeriod > 0 ? truncated.slice(0, lastPeriod + 1) : truncated;
  }
  
  export function extractUrls(text: string): string[] {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
  }
  
  export function generateTitle(message: string): string {
    return message.slice(0, 40) + (message.length > 40 ? "..." : "");
  }
  
  export function detectChartableData(content: string) {
    try {
      const lines = content.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
  
      if (lines.length < 2) return null;
  
      const headers = lines[0].split(/[,\t|]/).map(h => h.trim());
      const data = [];
  
      for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split(/[,\t|]/).map(cell => cell.trim());
        if (cells.length === headers.length) {
          const row: Record<string, any> = {};
          cells.forEach((cell, index) => {
            row[headers[index]] = isNaN(Number(cell)) ? cell : Number(cell);
          });
          data.push(row);
        }
      }
  
      if (data.length === 0) return null;
  
      const type = data.length > 10 ? 'line' : 'bar';
      return { type, data };
    } catch (error) {
      console.error('Error detecting chartable data:', error);
      return null;
    }
  }