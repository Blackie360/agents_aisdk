<a href="https://chat.vercel.ai/">
  <img alt="Tech Community Manager AI Assistant" src="app/(chat)/opengraph-image.png">
  <h1 align="center">Tech Community Manager AI</h1>
</a>

<p align="center">
  An AI-powered assistant for DevRel professionals and community managers, built with Next.js and the AI SDK by Vercel.
</p>

<p align="center">
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#model-providers"><strong>Model Providers</strong></a> ·
  <a href="#deploy-your-own"><strong>Deploy Your Own</strong></a> ·
  <a href="#running-locally"><strong>Running locally</strong></a>
</p>
<br/>

## What This Agent Can Do

This specialized AI assistant helps DevRel professionals and community managers with:

### Community Strategy & Growth
- Develop community engagement strategies and growth plans
- Create community programs (ambassador programs, mentorship, user groups)
- Build community guidelines and codes of conduct
- Analyze community metrics and KPIs

### Event Planning & Management
- Plan tech events (conferences, meetups, hackathons, workshops)
- Create event runbooks and checklists
- Develop speaker and sponsor outreach strategies
- Design event marketing campaigns

### Content & Communication
- Craft engaging social media content for tech audiences
- Write newsletters and community updates
- Create technical tutorials and documentation
- Develop presentation materials

### Developer Relations
- Plan developer advocacy programs
- Build relationships with open source communities
- Manage developer feedback and feature requests
- Track industry trends and competitor activities

### Web Research & Insights
- **Always-on Google Search**: The agent has continuous access to web search to provide the latest information
- Find relevant tech news, articles, and community best practices
- Research upcoming conferences and events
- Discover new community tools and platforms

### Guided Forms (New! ✨)
- **Event Planner Form**: Interactive 5-step form for comprehensive event planning
- Structured input collection for complex tasks
- No more back-and-forth - provide all details at once
- Generate complete, actionable plans instantly

## Features

- [Next.js](https://nextjs.org) App Router
  - Advanced routing for seamless navigation and performance
  - React Server Components (RSCs) and Server Actions for server-side rendering and increased performance
- [AI SDK](https://sdk.vercel.ai/docs)
  - Unified API for generating text, structured objects, and tool calls with LLMs
  - Hooks for building dynamic chat and generative user interfaces
  - **Google Search Integration**: Built-in web search capabilities for real-time information
  - Supports Google Gemini 2.5 Flash (default) with advanced reasoning
- [shadcn/ui](https://ui.shadcn.com)
  - Styling with [Tailwind CSS](https://tailwindcss.com)
  - Component primitives from [Radix UI](https://radix-ui.com) for accessibility and flexibility
- Data Persistence
  - [Vercel Postgres powered by Neon](https://vercel.com/storage/postgres) for saving chat history and user data
  - [Vercel Blob](https://vercel.com/storage/blob) for efficient object storage
- [NextAuth.js](https://github.com/nextauthjs/next-auth)
  - Simple and secure authentication

## Model Providers

This agent uses Google Gemini `gemini-2.5-flash` as the default model, which provides:
- Advanced reasoning capabilities for complex community management scenarios
- Built-in Google Search integration for real-time web information
- Fast response times for interactive conversations
- Support for multimodal inputs (text, images, documents)

However, with the [AI SDK](https://sdk.vercel.ai/docs), you can switch LLM providers to [OpenAI](https://openai.com), [Anthropic](https://anthropic.com), [Cohere](https://cohere.com/), and [many more](https://sdk.vercel.ai/providers/ai-sdk-providers) with just a few lines of code.

## Example Use Cases

Here are some ways you can use the Tech Community Manager AI:

**Community Strategy**
- "Help me create a 6-month community growth strategy for our developer platform"
- "What are the best practices for building an ambassador program?"
- "How can I measure community health and engagement?"

**Event Planning**
- "Create a checklist for organizing a virtual hackathon"
- "What are some creative ideas for developer meetup topics?"
- "Help me draft a CFP (Call for Proposals) for our upcoming conference"

**Content Creation**
- "Write a LinkedIn post announcing our new community forum"
- "Create an outline for a technical tutorial on getting started with our API"
- "Draft a monthly community newsletter highlighting key achievements"

**DevRel Activities**
- "Find the latest trends in developer advocacy for 2025"
- "What are some successful open source community engagement strategies?"
- "Help me create a developer feedback loop process"

**Research & Insights**
- "What are the top tech conferences happening in the next quarter?"
- "Find recent articles about Discord vs Slack for developer communities"
- "What are the latest community management tools and platforms?"

The agent will automatically search the web to provide you with the most current and relevant information.

**Event Planning (Using Guided Form)**
- Click the "Plan an Event (Guided Form)" button
- Fill out the 5-step form with your event details
- Get a comprehensive event plan instantly

📝 **For more detailed examples and use cases, see [COMMUNITY_MANAGER_PROMPTS.md](./COMMUNITY_MANAGER_PROMPTS.md)**

✨ **Learn about the new Guided Forms feature: [GUIDED_FORMS.md](./GUIDED_FORMS.md)**

## Deploy Your Own

You can deploy your own version of the Tech Community Manager AI to Vercel with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvercel-labs%2Fgemini-chatbot&env=AUTH_SECRET,GOOGLE_GENERATIVE_AI_API_KEY&envDescription=Learn%20more%20about%20how%20to%20get%20the%20API%20Keys%20for%20the%20application&envLink=https%3A%2F%2Fgithub.com%2Fvercel-labs%2Fgemini-chatbot%2Fblob%2Fmain%2F.env.example&demo-title=Next.js%20Gemini%20Chatbot&demo-description=An%20Open-Source%20AI%20Chatbot%20Template%20Built%20With%20Next.js%20and%20the%20AI%20SDK%20by%20Vercel.&demo-url=https%3A%2F%2Fgemini.vercel.ai&stores=[{%22type%22:%22postgres%22},{%22type%22:%22blob%22}])

## Running locally

You will need to use the environment variables [defined in `.env.example`](.env.example) to run Next.js AI Chatbot. It's recommended you use [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables) for this, but a `.env` file is all that is necessary.

> Note: You should not commit your `.env` file or it will expose secrets that will allow others to control access to your various Google Cloud and authentication provider accounts.

1. Install Vercel CLI: `npm i -g vercel`
2. Link local instance with Vercel and GitHub accounts (creates `.vercel` directory): `vercel link`
3. Download your environment variables: `vercel env pull`

```bash
pnpm install
pnpm dev
```

Your app template should now be running on [localhost:3000](http://localhost:3000/).
