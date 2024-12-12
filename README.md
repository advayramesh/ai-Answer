# AI Answer Engine

An AI-powered chat application that can analyze content from various sources including PDFs, CSVs, and web pages. Uses multiple LLM providers (Groq, Gemini) for responses.

## Prerequisites

- Node.js 18.x or later
- npm 9.x or later
- Git

## Environment Variables

Create a `.env.local` file in the root directory with these variables:

```env
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token
GROQ_API_KEY=your_groq_api_key
GEMINI_API_KEY=your_gemini_api_key
YOUTUBE_API_KEY=your_youtube_api_key  # Optional
```

## Installation

### Windows

```batch
# Clone the repository
git clone https://github.com/your-username/ai-answer-engine.git
cd ai-answer-engine

# Install dependencies
npm install

# Run development server
npm run dev
```

### macOS/Linux

```bash
# Clone the repository
git clone https://github.com/your-username/ai-answer-engine.git
cd ai-answer-engine

# Install dependencies
npm install

# Run development server
npm run dev
```

## Development

The application will be available at `http://localhost:3000`.

### Build for Production

```bash
npm run build
npm start
```

### Project Structure

```
src/
├── app/                # Next.js app router
│   ├── api/           # API routes
│   │   └── chat/      # Chat endpoint
│   └── layout.tsx     # Root layout
├── lib/               # Utility functions
│   └── extractors.ts  # Content extractors
└── types/             # TypeScript types
```

## Features

- Multi-model AI responses (Groq, Gemini)
- Content extraction from:
  - PDFs
  - CSVs
  - Web pages
  - YouTube videos (requires API key)
- Redis caching
- Rate limiting
- Data visualization for CSV files

## API Endpoints

### POST /api/chat

Send messages and get AI responses:

```typescript
// Request body
{
  message: string;
  urls?: string[];     // Optional URLs to analyze
  model?: "groq" | "gemini";  // Default: "groq"
}

// Response
{
  content: string;     // AI response
  suggestions: string[]; // Follow-up questions
  sources: string[];   // Processed URLs
  visualizations?: any[]; // Optional data visualizations
}
```

## Deployment

### Vercel

1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel project settings
3. Deploy

Required build settings:
- Framework Preset: Next.js
- Node.js Version: 18.x
- Build Command: `npm install && npm run build`
- Output Directory: .next

## Troubleshooting

### Common Issues

1. Build Errors
   ```bash
   # Clear cache and node_modules
   # Windows
   rd /s /q .next
   rd /s /q node_modules
   
   # macOS/Linux
   rm -rf .next
   rm -rf node_modules
   
   # Reinstall and rebuild
   npm install
   npm run build
   ```

2. TypeScript Errors
   - Make sure all types are properly installed
   - Check src/types/environment.d.ts for environment variable types

### Rate Limiting

Default limits:
- 50 requests per hour per IP
- Configurable in middleware.ts

## License

MIT

## Support

For issues and feature requests, please open an issue on GitHub.