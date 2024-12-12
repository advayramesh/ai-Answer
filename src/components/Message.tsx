// components/Message.tsx

import { type Message } from '@/types';
import DataChart from './DataChart';

type MessageProps = {
  message: Message;
  isLast: boolean;
};

export function Message({ message, isLast }: MessageProps) {
  return (
    <div className={`px-4 py-8 message-hover ${!isLast && 'border-b border-gray-800'}`}>
      <div className="max-w-4xl mx-auto">
        <div className={`flex gap-4 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0">
            {message.role === "ai" ? (
              <div className="bg-gradient-to-br from-cyan-500 to-blue-500 w-full h-full rounded-full" />
            ) : (
              <div className="bg-gradient-to-br from-violet-500 to-fuchsia-500 w-full h-full rounded-full" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 space-y-4">
            <div className="prose prose-invert max-w-none">
              {message.content}
            </div>

            {/* Sources */}
            {(message.sources?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {message.sources?.map((source, i) => (
                  <a
                    key={i}
                    href={source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-gray-800 hover:bg-gray-700 transition-colors"
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    {new URL(source).hostname}
                  </a>
                ))}
              </div>
            )}

            {/* Visualizations */}
            {message.visualizations?.map((viz, i) => (
              <div key={i} className="mt-4 bg-gray-800/50 rounded-lg p-4 backdrop-blur-sm">
                <DataChart type={viz.type} data={viz.data} />
              </div>
            ))}

            {/* Model Info */}
            {message.model && (
              <div className="text-xs text-gray-500 mt-2">
                via {message.model}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}