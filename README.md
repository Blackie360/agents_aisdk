# CommunitySync

<p align="center">
  <strong>AI-Powered Community Management Assistant</strong>
</p>

<p align="center">
  Stop juggling calendars, spreadsheets, and multiple tools. CommunitySync automates community management so you can focus on building meaningful connections.
</p>

<p align="center">
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#getting-started"><strong>Getting Started</strong></a> ·
  <a href="#configuration"><strong>Configuration</strong></a> ·
  <a href="#tech-stack"><strong>Tech Stack</strong></a>
</p>

---

## Features

### 🤖 Intelligent Automation
- **Event Management**: Schedule, modify, and track community events with natural language
- **Calendar Integration**: Full Google Calendar sync—view, create, and manage events directly from chat
- **Content Planning**: AI-powered content calendar suggestions and optimal posting times
- **Engagement Tracking**: Monitor community metrics and get actionable insights
- **Member Support**: Facilitate onboarding and answer questions automatically
- **Team Coordination**: Coordinate between team members and stakeholders seamlessly

### 💬 Natural Conversation
- Chat naturally—no complex forms or menus
- Context-aware responses that remember your community's needs
- Proactive suggestions based on best practices
- Multimodal input: upload files, share attachments, format with markdown

### ⚡ Built for Performance
- Next.js 15 with React Server Components and Turbo mode
- Lightning-fast responses with streaming AI
- Modern, accessible UI with shadcn/ui
- Type-safe codebase with TypeScript

---

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm installed
- A PostgreSQL database (Vercel Postgres recommended)
- Google Cloud project with Calendar API enabled
- Google Generative AI API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd agents_aisdk
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file in the root directory with the following variables:
   
   ```env
   # Database
   POSTGRES_URL=your_postgres_connection_string
   
   # Authentication
   AUTH_SECRET=your_auth_secret_generate_with_openssl_rand_base64_32
   
   # Google OAuth (for Calendar integration)
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback/google
   
   # Google Generative AI
   GOOGLE_GENERATIVE_AI_API_KEY=your_google_ai_api_key
   
   # Vercel AI Gateway (optional but recommended for rate limiting)
   # Get your API key from: https://vercel.com/docs/ai-gateway
   AI_GATEWAY_API_KEY=your_ai_gateway_api_key
   
   # Vercel Blob (optional, for file uploads)
   BLOB_READ_WRITE_TOKEN=your_blob_token
   ```

   **How to get these values:**
   
   - **AUTH_SECRET**: Generate with `openssl rand -base64 32`
   - **POSTGRES_URL**: Get from your Vercel Postgres dashboard or any PostgreSQL provider
   - **GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET**: 
     1. Go to [Google Cloud Console](https://console.cloud.google.com/)
     2. Create a new project or select existing
     3. Enable Google Calendar API
     4. Create OAuth 2.0 credentials
     5. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
   - **GOOGLE_GENERATIVE_AI_API_KEY**: Get from [Google AI Studio](https://makersuite.google.com/app/apikey)
   - **AI_GATEWAY_API_KEY**: Get from [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) (optional but recommended to handle rate limiting)
   - **BLOB_READ_WRITE_TOKEN**: Get from Vercel dashboard (Storage → Blob)

4. **Run database migrations**
   ```bash
   pnpm run build
   ```
   This will automatically run migrations before building. Alternatively:
   ```bash
   tsx db/migrate
   ```

5. **Start the development server**
   ```bash
   pnpm dev
   ```

6. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

   You'll be prompted to:
   - Register/Login (create an account or use Google OAuth)
   - Connect your Google Calendar (click the integration button in the UI)

---

## Configuration

### Google Calendar Setup

1. **Enable Google Calendar API**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to APIs & Services → Library
   - Search for "Google Calendar API" and enable it

2. **Create OAuth 2.0 Credentials**
   - Go to APIs & Services → Credentials
   - Click "Create Credentials" → "OAuth client ID"
   - Choose "Web application"
   - Add authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google` (for local development)
     - `https://yourdomain.com/api/auth/callback/google` (for production)

3. **Configure Scopes**
   - The app requests: `openid email profile https://www.googleapis.com/auth/calendar`
   - Make sure these scopes are enabled in your OAuth consent screen

### Database Setup

**Option 1: Vercel Postgres (Recommended)**
1. Go to your Vercel project dashboard
2. Navigate to Storage → Create Database → Postgres
3. Copy the `POSTGRES_URL` connection string to your `.env.local`

**Option 2: Other PostgreSQL Providers**
- Use any PostgreSQL database (Neon, Supabase, Railway, etc.)
- Copy the connection string to `POSTGRES_URL` in `.env.local`

### Model Providers

CommunitySync uses **Google Gemini 2.5 Pro** via **Vercel AI Gateway** by default. The AI Gateway provides:

- **Automatic rate limiting handling**: Prevents rate limit errors from Google Generative API
- **Retry logic**: Automatically retries failed requests with exponential backoff
- **Better reliability**: Improved uptime and error handling
- **Usage tracking**: Monitor API usage per user and feature
- **Cost optimization**: Better request management and caching

You can switch to other providers by modifying `ai/index.ts`:

```typescript
// Using Vercel AI Gateway (recommended - handles rate limiting)
import { gateway } from 'ai';
export const model = gateway('google/gemini-2.5-pro');

// Direct Google provider (without gateway)
import { google } from '@ai-sdk/google';
export const model = google('gemini-2.5-pro');

// For OpenAI via Gateway
export const model = gateway('openai/gpt-4');

// For Anthropic via Gateway
export const model = gateway('anthropic/claude-3-opus-20240229');
```

**Note**: To use Vercel AI Gateway, set the `AI_GATEWAY_API_KEY` environment variable. If not set, the gateway will still work but with limited features.

---

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org) 15 with App Router
- **UI**: [React](https://react.dev) 19, [shadcn/ui](https://ui.shadcn.com), [Tailwind CSS](https://tailwindcss.com)
- **AI**: [Vercel AI SDK](https://sdk.vercel.ai/docs), [Vercel AI Gateway](https://vercel.com/docs/ai-gateway), Google Gemini
- **Database**: [Vercel Postgres](https://vercel.com/storage/postgres) (Neon), [Drizzle ORM](https://orm.drizzle.team)
- **Storage**: [Vercel Blob](https://vercel.com/storage/blob)
- **Authentication**: [NextAuth.js](https://github.com/nextauthjs/next-auth)
- **Calendar**: Google Calendar API

---

## Project Structure

```
├── app/
│   ├── (auth)/          # Authentication pages (login, register)
│   ├── (chat)/          # Chat interface and API routes
│   └── layout.tsx       # Root layout
├── components/
│   ├── custom/          # Custom components (chat, calendar, etc.)
│   └── ui/              # shadcn/ui components
├── db/
│   ├── schema.ts        # Database schema
│   ├── queries.ts       # Database queries
│   └── migrate.ts       # Migration runner
├── lib/
│   └── tools/           # AI tools (Google Calendar integration)
└── ai/
    └── index.ts         # AI model configuration
```

---

## Usage

### Basic Chat

Once logged in, simply start chatting with the AI assistant:

- "Show me my upcoming events"
- "Schedule a community meetup next Friday at 6 PM"
- "What's on my calendar this week?"
- "Create an event for the team standup tomorrow at 10 AM"

### Calendar Integration

1. **Connect Google Calendar**: Click the integration button in the UI and authorize access
2. **View Events**: Ask the assistant to show your calendar
3. **Create Events**: Describe the event naturally, and the AI will create it
4. **Manage Events**: Update, delete, or check availability through conversation

### File Uploads

- Attach files to your messages
- The AI can process and reference uploaded documents
- Files are stored securely in Vercel Blob

---

## Development

### Available Scripts

- `pnpm dev` - Start development server with Turbo mode
- `pnpm build` - Build for production (runs migrations automatically)
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint

### Database Migrations

Migrations are automatically run during `pnpm build`. To run manually:

```bash
tsx db/migrate
```

### Environment Variables

All environment variables should be set in `.env.local` for local development. Never commit this file to version control.

---

## Troubleshooting

### "Failed to get Google refresh token"
- Make sure you've connected your Google account via the integration button
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
- Check that Google Calendar API is enabled in your Google Cloud project

### "Failed to save chat"
- Verify `POSTGRES_URL` is set correctly
- Ensure database migrations have been run
- Check database connection and permissions

### Calendar not working
- Verify Google Calendar API is enabled
- Check OAuth scopes include calendar access
- Ensure redirect URI matches exactly in Google Cloud Console

---

## License

[Add your license here]

---

## Contributing

[Add contribution guidelines here]

---

**Built with ❤️ using Next.js, React, and the Vercel AI SDK.**
