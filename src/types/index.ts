// src/types/index.ts

export type Message = {
    role: "user" | "ai";
    content: string;
    sources?: string[];
    model?: "groq" | "gemini";
    visualizations?: Array<{
      type: 'line' | 'bar';
      data: Record<string, any>[];
    }>;
  };
  
  export type Conversation = {
    id: string;
    messages: Message[];
    createdAt: Date;
    title: string;
    currentUrl?: string;
  };
  
  export type ContentResult = {
    content: string;
    relatedContent?: string[];
    visualizationData?: {
      type: 'line' | 'bar';
      data: Record<string, any>[];
    };
  };
  
  export type ChartData = {
    type: 'line' | 'bar';
    data: Record<string, any>[];
  };