// lib/visualizations.ts

export function detectChartableData(text: string): {
    type: 'bar' | 'line';
    data: Record<string, any>[];
  } | null {
    try {
      // Look for tabular or structured data in the text
      const lines = text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
  
      if (lines.length < 2) return null;
  
      // Try to detect CSV-like structure
      const headers = lines[0]?.split(/[,\t|]/)?.map(h => h.trim()) || [];
      const data: Record<string, any>[] = [];
  
      for (let i = 1; i < lines.length; i++) {
        const cells = lines[i]?.split(/[,\t|]/)?.map(cell => cell.trim()) || [];
        if (cells.length === headers.length) {
          const row: Record<string, any> = {};
          cells.forEach((cell, index) => {
            const header = headers[index];
            if (header) {
              row[header] = isNaN(Number(cell)) ? cell : Number(cell);
            }
          });
          if (Object.keys(row).length > 0) {
            data.push(row);
          }
        }
      }
  
      if (data.length === 0) return null;
  
      // Determine chart type based on data structure
      const numericColumns = data[0] ? headers.filter(header => 
        typeof data[0]?.[header] === 'number'
      ) : [];
  
      if (numericColumns.length === 0) return null;
  
      // Use line chart for time series or many data points
      const type = data.length > 10 || 
                  headers.some(h => h.toLowerCase().includes('date')) 
                  ? 'line' : 'bar';
  
      return { type, data };
    } catch (error) {
      console.error('Error detecting chartable data:', error);
      return null;
    }
  }