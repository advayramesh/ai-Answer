// src/types/index.ts

export type Message = {
    role: "user" | "ai";
    content: string;
    sources?: string[];
    model?: "groq" | "gemini";
    visualizations?: ChartData[];
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
  
  export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

  export interface ChartData {
    type: 'line' | 'bar';
    data: Record<string, JsonValue>[];
  }