# Quick Start Guide - Tech Community Manager AI

## 🚀 Getting Started in 5 Minutes

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Set Up Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Get your Google AI API key from: https://aistudio.google.com/app/apikey
GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key_here

# Generate a secret for authentication
AUTH_SECRET=$(openssl rand -base64 32)

# Database and Storage (Get from Vercel or Supabase)
DATABASE_URL=your_postgres_connection_string
BLOB_READ_WRITE_TOKEN=your_blob_storage_token
```

### 3. Run Database Migrations

```bash
pnpm db:migrate
# or
tsx db/migrate.ts
```

### 4. Start the Development Server

```bash
pnpm dev
```

Your app will be running at [http://localhost:3000](http://localhost:3000)

## ✨ Key Features You Can Try Immediately

### Event Planning (NEW: Guided Form! ✨)
- Click the **"Plan an Event (Guided Form)"** button on the home screen
- Fill out the 5-step interactive form
- Get a comprehensive event plan instantly
- No more back-and-forth questions!

### Community Strategy
```
"Help me create a 6-month community growth strategy for our developer platform"
```

### Event Planning (Chat Method)
```
"Create a comprehensive plan for a 48-hour virtual hackathon"
```

### Content Creation
```
"Write 5 LinkedIn posts announcing our new community forum"
```

### Research & Trends
```
"What are the top DevRel trends for 2025?"
```

### Web Search (Always Active!)
```
"Find the latest articles about Discord vs Slack for developer communities"
```

## 🎯 What Makes This Special

1. **Always-On Google Search**: Every query can access real-time web information
2. **Specialized for Community Managers**: Built-in expertise for DevRel and community building
3. **Improved Streaming UI**: Beautiful, readable responses with proper formatting
4. **Smart Input Handling**: Input disables during generation to prevent issues
5. **Mobile-Friendly**: Works great on all devices

## 🎨 UI Improvements You'll Notice

- **Input Field**: 
  - Disables during message generation
  - Shows visual feedback (opacity change)
  - Dynamic placeholder text
  - Enter key sends message
  
- **Streaming Output**:
  - Beautiful markdown rendering
  - Proper heading hierarchy
  - Styled code blocks
  - Clean tables and lists
  - Responsive typography

- **Loading States**:
  - Spinner animation during generation
  - Clear "Generating response..." placeholder
  - Disabled buttons prevent duplicate submissions

## 📚 Documentation

- **[README.md](./README.md)** - Full project documentation and features
- **[COMMUNITY_MANAGER_PROMPTS.md](./COMMUNITY_MANAGER_PROMPTS.md)** - 50+ example prompts
- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - Technical details

## 🔧 Troubleshooting

### Google Search Not Working?
- Verify `GOOGLE_GENERATIVE_AI_API_KEY` is set correctly
- Check the API key has necessary permissions at [Google AI Studio](https://aistudio.google.com/)
- Restart the development server after adding the key

### Input Not Disabling?
- Check browser console for errors
- Clear browser cache and reload
- Make sure you're using the latest code

### Markdown Not Rendering?
- The Response component has been updated with improved styling
- Check that the content is being passed correctly to the `<Response>` component

## 🚢 Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import the project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

The app will automatically set up Postgres and Blob storage.

## 💡 Pro Tips

1. **Be Specific**: The more context you provide, the better the responses
2. **Use Follow-ups**: Ask clarifying questions to refine outputs
3. **Request Examples**: Ask for real-world case studies
4. **Leverage Search**: The agent will automatically search for latest info
5. **Multi-turn Conversations**: Build on previous responses for better results

## 🎯 Example Workflow

1. Start with a broad question:
   ```
   "Help me plan a developer meetup for our API community"
   ```

2. Refine based on the response:
   ```
   "Can you make it more interactive? We want hands-on activities"
   ```

3. Request specific details:
   ```
   "Create a budget template for this meetup"
   ```

4. Get real-world examples:
   ```
   "Find examples of successful API developer meetups from other companies"
   ```

## 🔥 Popular Use Cases

### For Community Managers
- Growth strategies and engagement plans
- Community guidelines and codes of conduct
- Member onboarding flows
- Health metrics and KPIs

### For DevRel Professionals
- Technical content creation
- Developer advocacy programs
- Conference speaking proposals
- Demo and tutorial scripts

### For Event Organizers
- Hackathon planning and logistics
- CFP creation and speaker outreach
- Virtual event platform selection
- Post-event follow-up strategies

## 📞 Need Help?

- Check the [COMMUNITY_MANAGER_PROMPTS.md](./COMMUNITY_MANAGER_PROMPTS.md) for inspiration
- Review the [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) for technical details
- The agent can help you learn how to use itself - just ask!

## 🎉 You're Ready!

Start chatting with your Tech Community Manager AI and build amazing communities! 🚀

