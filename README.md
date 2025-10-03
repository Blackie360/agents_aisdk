# AI SDK 5 Document Processing Agent

Document Processing Agent built with AI SDK 5 and Google Gemini 2.0 Flash. This agent can analyze documents, extract text content, detect file types, summarize, search within documents, and export structured analysis.

## Setup

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvercel-labs%2Fship-25-agents-workshop-starter&project-name=vercel-ship-25-coding-agent&repository-name=vercel-ship-25-coding-agent&demo-title=Ship%202025%20Agents%20Workshop%20Companion%20Site&demo-url=https%3A%2F%2Fship-25-agents-workshop.vercel.app%2Fdocs)

1. Install the Vercel CLI: `npm i -g vercel`
1. Deploy this repo with the button above.
1. Clone the new repo locally.
1. Link to Vercel project: `vercel link`
1. Pull environment variables: `vercel env pull` (may need team/project IDs too)
1. Install dependencies: `pnpm install`
1. Start dev server: `vercel dev`

## Environment Variables

- `VERCEL_OIDC_TOKEN` - For AI Gateway and Sandbox (this will be automatically added when you run `vercel dev`)
- `GITHUB_TOKEN` - GitHub personal access token

### GitHub Personal Access Token

To create a GitHub Personal Access Token (PAT):

1. Go to https://github.com/settings/personal-access-tokens
2. Click "Generate new token"
3. Give it a descriptive name
4. Set repository access to "All repositories"
5. Add the following repository permissions:
   - Issues: Read and write
   - Pull requests: Read and write
6. Click "Generate token"
7. Copy the token immediately (you won't be able to see it again)
8. Add it to your `.env.local` file as `GITHUB_TOKEN`

## Features

- **Document Type Detection**: Automatically detect file types (txt, md, json, csv, html, **PDF**)
- **Text Extraction**: Extract and clean text content from various formats including PDFs
- **Content Analysis**: Generate summaries, extract entities (emails, URLs, names), identify topics
- **Document Search**: Search for terms within documents with context
- **Analysis Export**: Save structured analysis results to JSON

## Usage

### API Endpoint

```bash
curl -X POST https://your-deployment.vercel.app/api/document \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Analyze the README.md file and provide a summary",
    "filePath": "./README.md"
  }'
```

Parameters:

- `prompt` - What you want the agent to do
- `filePath` (optional) - Path to document file
- `content` (optional) - Raw document content

### Test Locally

```bash
# Run default test
pnpm test

# Run document processing tests
pnpm test-document
```
