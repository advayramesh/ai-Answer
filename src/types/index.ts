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
  visualizationData?: ChartData;
};

export type ChartData = {
  type: 'line' | 'bar';
  data: Record<string, JsonValue>[];
};

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };