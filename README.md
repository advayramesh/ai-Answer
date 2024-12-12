# AI Answer Engine

An AI-powered chat application that can analyze content from various sources including PDFs, CSVs, and web pages, using multiple LLM providers (Groq, Gemini) for responses.

## Features

- 🤖 Multi-model AI responses (Groq, Gemini)
- 📄 Content extraction and analysis from:
  - PDFs
  - CSVs
  - Web pages
  - YouTube videos (requires API key)
- 📊 Automatic data visualization for CSV files
- 💾 Redis caching for improved performance
- 🔒 Rate limiting protection
- 📎 Link sharing capabilities
- 🎨 Modern, responsive UI with dark mode

## Prerequisites

- Node.js 18.x or later
- npm 9.x or later
- Git

### Required API Keys
You'll need to obtain the following API keys:
- Groq API key from [Groq](https://console.groq.com)
- Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
- Upstash Redis credentials from [Upstash](https://console.upstash.com/)

## Installation

### Windows
```batch
# Clone the repository
git clone https://github.com/your-username/ai-answer-engine.git
cd ai-answer-engine

# Install dependencies
npm install

# Create environment file
copy .env.example .env.local
```

### macOS/Linux
```bash
# Clone the repository
git clone https://github.com/your-username/ai-answer-engine.git
cd ai-answer-engine

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local
```

## Environment Setup

Create a `.env.local` file in the root directory with these variables:
```env
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token
GROQ_API_KEY=your_groq_api_key
GEMINI_API_KEY=your_gemini_api_key
YOUTUBE_API_KEY=your_youtube_api_key  # Optional
```

## Development

### Running the Development Server

```bash
npm run dev
```
The application will be available at `http://localhost:3000`

### Building for Production

```bash
npm run build
npm start
```

## Project Structure
```
src/
├── app/                # Next.js app router
│   ├── api/           # API routes
│   │   ├── chat/      # Chat endpoint
│   │   └── share/     # Share endpoint
│   ├── layout.tsx     # Root layout
│   └── page.tsx       # Main chat interface
├── components/        # React components
│   ├── DataChart.tsx  # Chart visualization
│   └── Message.tsx    # Chat message component
├── lib/              # Utility functions
│   ├── cache.ts      # Redis caching
│   ├── crawler.ts    # Web crawler
│   ├── extractors.ts # Content extractors
│   └── utils.ts      # Helper functions
├── types/            # TypeScript types
└── middleware.ts     # Rate limiting
```

## Usage

1. **Starting a Chat**
   - Click "New Chat" to start a conversation
   - Type a message or paste a URL to analyze
   - Press Enter or click Send

2. **Content Analysis**
   - Paste URLs of PDFs, CSVs, or web pages
   - The AI will analyze and summarize the content
   - For CSV files, automatic visualizations will be generated

3. **Model Selection**
   - Choose between Groq and Gemini models
   - Each has different capabilities and response styles

4. **Sharing Conversations**
   - Click the Share button to generate a shareable link
   - Links are valid for 24 hours

## Common Issues & Troubleshooting

### Windows
1. If you get module not found errors:
```batch
rd /s /q node_modules
del package-lock.json
npm install
```

2. If TypeScript errors occur:
```batch
npm install --save-dev typescript @types/react @types/node
```

### macOS/Linux
1. If you get module not found errors:
```bash
rm -rf node_modules
rm package-lock.json
npm install
```

2. If permission errors occur:
```bash
sudo chown -R $USER:$GROUP ~/.npm
sudo chown -R $USER:$GROUP .
```

## Deployment

### Vercel (Recommended)
1. Fork this repository
2. Connect to Vercel
3. Add environment variables
4. Deploy

Required build settings:
- Framework Preset: Next.js
- Node.js Version: 18.x
- Build Command: `npm install && npm run build`
- Output Directory: .next

## Rate Limiting

- 50 requests per hour per IP
- Configurable in middleware.ts
- Redis required for rate limiting

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit changes
4. Push to the branch
5. Open a pull request

## License

MIT

## Support

For issues and feature requests, please open an issue on GitHub.