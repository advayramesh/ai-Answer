// src/app/page.tsx

"use client";

import { useState, useEffect, useRef } from "react";
import { Share2, Menu, X, Plus, MessageSquare, Loader2, ChevronRight, ChevronLeft } from "lucide-react";
import DataChart from "@/components/DataChart";
import type { Message, Conversation } from "@/types";
import { extractUrls, generateTitle } from "@/lib/utils";

export default function Home() {
  // Your state declarations
  const [message, setMessage] = useState("");
  const [currentConversation, setCurrentConversation] = useState<Conversation>({
    id: Math.random().toString(36).substring(7),
    messages: [{ 
      role: "ai", 
      content: "Hello! You can ask me questions or paste a URL to analyze content. For example:\n- 'Summarize this article: [URL]'\n- 'Create a chart from this data'\n- 'Analyze trends in: [URL]'" 
    }],
    createdAt: new Date(),
    title: "New Chat"
  });

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isHovering, setIsHovering] = useState(false);
  const [selectedModel, setSelectedModel] = useState<"groq" | "gemini">("groq");
  const [shareLoading, setShareLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load conversations with expiration check
  useEffect(() => {
    const saved = localStorage.getItem('conversations');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const now = new Date();
        const validConversations = parsed
          .filter((conv: any) => {
            const convDate = new Date(conv.createdAt);
            const diffDays = (now.getTime() - convDate.getTime()) / (1000 * 60 * 60 * 24);
            return diffDays <= 7; // 7-day expiration
          })
          .map((conv: any) => ({
            ...conv,
            createdAt: new Date(conv.createdAt)
          }));
        setConversations(validConversations);
      } catch (error) {
        console.error('Error loading conversations:', error);
      }
    } else {
      setConversations([currentConversation]);
    }
  }, []);

  // Save conversations
  useEffect(() => {
    localStorage.setItem('conversations', JSON.stringify(conversations));
  }, [conversations]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentConversation.messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }, [message]);

  const shareConversation = async () => {
    if (currentConversation.messages.length <= 1) {
      alert('Start a conversation before sharing!');
      return;
    }

    try {
      setShareLoading(true);
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation: currentConversation })
      });

      if (!response.ok) throw new Error('Failed to create share link');

      const { shareId } = await response.json();
      const shareUrl = `${window.location.origin}/share/${shareId}`;
      await navigator.clipboard.writeText(shareUrl);
      alert('Share link copied to clipboard!');
    } catch (error) {
      console.error('Error sharing conversation:', error);
      alert('Failed to create share link');
    } finally {
      setShareLoading(false);
    }
  };

  const startNewConversation = () => {
    const newConv: Conversation = {
      id: Math.random().toString(36).substring(7),
      messages: [{
        role: "ai",
        content: "Hello! How can I help you today?"
      }],
      createdAt: new Date(),
      title: "New Chat"
    };
    setCurrentConversation(newConv);
    setConversations(prev => [newConv, ...prev]);
    setSuggestions([]);
  };

  const handleSend = async () => {
    if (!message.trim()) return;

    const updatedConv = {
      ...currentConversation,
      messages: [
        ...currentConversation.messages,
        { 
          role: "user",
          content: message,
          model: selectedModel,
        } as Message
      ]
    };

    setCurrentConversation(updatedConv);
    setMessage("");
    setError(null);
    setIsLoading(true);
    setSuggestions([]);

    try {
      const urls = extractUrls(message);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          message,
          urls,
          model: selectedModel,
          conversationId: currentConversation.id
        }),
      });

      // Check if response is ok first
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Try to parse the response as JSON
      let data;
      try {
        data = await response.json();
      } catch (e) {
        throw new Error('Failed to parse server response');
      }
      
      const finalConv = {
        ...updatedConv,
        messages: [
          ...updatedConv.messages,
          {
            role: "ai",
            content: data.content,
            sources: data.sources,
            model: selectedModel,
            visualizations: data.visualizations
          } as Message
        ]
      };

      setCurrentConversation(finalConv);
      setConversations(prev => {
        const exists = prev.some(conv => conv.id === finalConv.id);
        if (exists) {
          return prev.map(conv => conv.id === finalConv.id ? finalConv : conv);
        } else {
          return [finalConv, ...prev];
        }
      });

      if (data.suggestions?.length) {
        setSuggestions(data.suggestions);
      }

    } catch (error) {
      console.error("Error:", error);
      setError(error instanceof Error ? error.message : "An error occurred");
      
      // Rollback the conversation state
      setCurrentConversation(prev => ({
        ...prev,
        messages: prev.messages.slice(0, -1)
      }));

    } finally {
      setIsLoading(false);
    }
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setMessage(suggestion);
    setSuggestions([]);
    inputRef.current?.focus();
  };

  const generateChatTitle = (content: string) => {
    if (!content) return "New Chat";
    
    // Extract the first line and clean URLs
    const cleanText = content.split('\n')[0].replace(/https?:\/\/[^\s]+/g, '').trim();
    
    // If it's too short, use the whole text
    if (cleanText.length < 5) return content.slice(0, 40);
    
    // Remove common action words if they're at the start
    const cleanedText = cleanText
      .replace(/^(please\s+|can you\s+|could you\s+|i want to\s+|help me\s+)/i, '')
      .replace(/^(analyze|summarize|explain|tell me about|what is|how to|create|generate)\s+/i, '');
    
    // Take the first meaningful part
    const title = cleanedText.split(/[.,?!]/)[0].trim();
    
    return title.slice(0, 40) || "New Chat";
  };

  return (
    <div className="flex h-screen bg-[conic-gradient(at_top_right,_var(--tw-gradient-stops))] from-gray-900 via-gray-800 to-cyan-900">
      {/* Sidebar */}
      <div className={`fixed md:relative z-20 transition-all duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-16'}`}
      >
        <div className={`flex flex-col h-full bg-gray-900/40 backdrop-blur-xl border-r border-white/5
          ${sidebarOpen ? 'w-64' : 'w-16'} transition-all duration-300`}>
          <div className="p-3 border-b border-gray-700">
            <button
              onClick={startNewConversation}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 transition-all"
            >
              <Plus size={16} className="stroke-[2.5]" />
              {sidebarOpen && "New Chat"}
            </button>
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="absolute -right-3 top-14 p-1 bg-gray-800 border border-gray-700 rounded-full hover:bg-gray-700 transition-all"
          >
            {sidebarOpen ? 
              <ChevronLeft size={14} className="stroke-[2.5]" /> : 
              <ChevronRight size={14} className="stroke-[2.5]" />
            }
          </button>
          <div className="flex-1 overflow-y-auto p-4">
            {conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => setCurrentConversation(conv)}
                className={`w-full text-left p-3 rounded-xl mb-2 transition-all duration-200
                  hover:bg-cyan-500/10 hover:border-cyan-500/20 hover:scale-[1.02] active:scale-[0.98]
                  group border border-transparent backdrop-blur-sm
                  ${currentConversation.id === conv.id 
                    ? 'bg-cyan-950/40 border-cyan-500/20 text-white shadow-lg shadow-cyan-950/20' 
                    : 'text-gray-300'}`}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare size={16} className="shrink-0" />
                  <div className="flex-1 truncate">
                    {sidebarOpen ? (conv.title === "New Chat" 
                      ? generateChatTitle(conv.messages[1]?.content)
                      : conv.title) : ""}
                  </div>
                </div>
                {sidebarOpen && (
                  <div className="text-sm text-gray-400 mt-1">
                    {new Date(conv.createdAt).toLocaleDateString()}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col relative">
          {/* Header */}
          <div className="bg-gray-900/40 backdrop-blur-xl border-b border-white/5 p-4 sticky top-0 z-10
            shadow-lg shadow-black/20">
            <div className="max-w-3xl mx-auto flex items-center justify-between">
              <h1 className="text-xl font-semibold text-white">
                {currentConversation.title === "New Chat" 
                  ? generateChatTitle(currentConversation.messages[1]?.content)
                  : currentConversation.title}
                <span className="text-sm text-gray-400 ml-2">
                  via {selectedModel}
                </span>
              </h1>
              <div className="flex items-center gap-4">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value as "groq" | "gemini")}
                  className="bg-gray-800/50 text-white px-4 py-2 rounded-xl border border-white/10
                    hover:bg-gray-700/50 transition-all focus:ring-2 focus:ring-cyan-500/50 outline-none"
                >
                  <option value="groq">Groq</option>
                  <option value="gemini">Gemini</option>
                </select>
                <button
                  onClick={shareConversation}
                  disabled={shareLoading}
                  className="text-white hover:text-cyan-400 p-2 hover:bg-gray-700 rounded-lg transition-all disabled:opacity-50"
                  title="Share conversation"
                >
                  {shareLoading ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <Share2 size={20} />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto pb-48 pt-4">
            <div className="max-w-5xl mx-auto px-4">
              {currentConversation.messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex gap-4 mb-4 ${
                    msg.role === "ai"
                      ? "justify-start"
                      : "justify-end flex-row-reverse"
                  } animate-fadeIn`}
                >
                  <div
                    className={`px-6 py-4 rounded-2xl backdrop-blur-sm shadow-lg ${
                      msg.role === "ai"
                        ? "bg-gray-900/40 border border-white/10 text-gray-100 max-w-[95%] shadow-black/20"
                        : "bg-cyan-600/20 text-white ml-auto max-w-[95%] border border-cyan-500/20 shadow-cyan-900/30"
                    }`}
                  >
                    <div className="whitespace-pre-wrap break-words">
                      {msg.content}
                    </div>
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-2 text-sm text-gray-400">
                        Sources:
                        <ul className="list-disc ml-4 mt-1">
                          {msg.sources.map((source, i) => (
                            <li key={i}>
                              <a
                                href={source}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-cyan-400 hover:underline break-all"
                              >
                                {new URL(source).hostname}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {msg.visualizations?.map((viz, i) => (
                      <div key={i} className="mt-4 bg-gray-900 p-4 rounded-lg">
                        <DataChart type={viz.type} data={viz.data} />
                      </div>
                    ))}
                    {msg.model && (
                      <div className="mt-1 text-xs text-gray-400">
                        via {msg.model}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-4 mb-4">
                  <div className="px-4 py-3 rounded-2xl bg-gray-800 border border-gray-700 text-gray-100">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                    </div>
                  </div>
                </div>
              )}
              {error && (
                <div className="text-red-400 text-center mb-4 p-3 bg-red-900/20 rounded-lg">
                  {error}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="fixed bottom-[120px] w-full bg-gray-900/60 backdrop-blur-xl py-3 z-20
              border-t border-white/5 shadow-lg shadow-black/30">
              <div className="max-w-5xl mx-auto flex items-center justify-center gap-2 px-4">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="px-4 py-2 bg-gray-800/30 hover:bg-gray-700/50 rounded-full text-sm text-gray-200
                      transition-all hover:scale-[1.02] active:scale-[0.98] border border-white/10
                      backdrop-blur-sm hover:border-cyan-500/30 shadow-lg shadow-black/20
                      hover:shadow-cyan-900/20"
                  >
                    {suggestion.length > 40 ? suggestion.substring(0, 37) + '...' : suggestion}
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {suggestion}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="fixed bottom-0 w-full bg-gray-900/40 backdrop-blur-xl border-t border-white/5 p-6
            shadow-[0_-20px_30px_-10px_rgba(0,0,0,0.3)]">
            <div className="max-w-5xl mx-auto px-4">
              <div className="flex gap-3 items-end">
                <textarea
                  ref={inputRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question or paste a URL to analyze..."
                  className="flex-1 rounded-xl border border-white/10 bg-gray-900/50 backdrop-blur-sm px-6 py-4
                    text-gray-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent
                    placeholder-gray-400 min-h-[52px] max-h-32 resize-none shadow-inner shadow-black/20"
                  rows={1}
                />
                <button
                  onClick={handleSend}
                  disabled={isLoading || !message.trim()}
                  className="bg-cyan-600/80 hover:bg-cyan-700/80 text-white px-6 py-3 rounded-xl transition-all
                    disabled:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed h-[52px]
                    flex items-center gap-2 backdrop-blur-sm shadow-lg shadow-cyan-900/30
                    hover:shadow-cyan-900/50 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Sending
                    </>
                  ) : (
                    <>
                      Send
                      <ChevronRight size={20} />
                    </>
                  )}
                </button>
              </div>
              <div className="mt-2 text-sm text-gray-400 text-center">
                {!message.trim() && (
                  "Press Enter to send, Shift+Enter for new line"
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar for Current Response's Embedded Content */}
        {currentConversation.messages[currentConversation.messages.length - 1]?.sources && 
         currentConversation.messages[currentConversation.messages.length - 1].sources!.length > 0 && (
          <div className="w-[500px] border-l border-gray-700 bg-gray-800 overflow-y-auto">
            {currentConversation.messages[currentConversation.messages.length - 1].sources!.map((source, sourceIdx) => (
              <div key={sourceIdx} className="p-4 border-b border-gray-700">
                <h3 className="text-sm text-gray-400 mb-2">Source {sourceIdx + 1}</h3>
                {source.endsWith('.pdf') ? (
                  <iframe 
                    src={`${source}#view=FitH`}
                    className="w-full h-[600px] rounded-lg border border-gray-700"
                    title={`Source ${sourceIdx + 1}`}
                  />
                ) : (
                  <iframe
                    src={source}
                    className="w-full h-[600px] rounded-lg border border-gray-700"
                    title={`Source ${sourceIdx + 1}`}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}