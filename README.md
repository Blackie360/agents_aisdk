# SchemaMind

A powerful database schema visualization tool with AI-powered explanations. Transform your database schemas into interactive diagrams and get intelligent insights about your database structure.

## Features

- **Visual Schema Diagrams**: Interactive, drag-and-drop database schema visualizations
- **Multiple Input Formats**: Support for Prisma schemas, SQL DDL statements, and database connections
- **AI-Powered Explanations**: Get intelligent insights about your database structure, relationships, and design patterns
- **Interactive Exploration**: Click on tables to view detailed column information, relationships, and constraints
- **Modern UI**: Built with Next.js, React Flow, and shadcn/ui components

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **AI**: Google Gemini via Vercel AI SDK
- **Visualization**: React Flow (@xyflow/react)
- **UI Components**: shadcn/ui with Radix UI
- **Styling**: Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- Google AI API key (for AI explanations)

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd agents_aisdk
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Set up environment variables**:
   Create a `.env.local` file in the root directory:
   ```bash
   # Google AI API (Required for AI explanations)
   # Get from: https://aistudio.google.com/app/apikey
   GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key

   # Optional: Vercel AI Gateway (Alternative to direct Google API)
   # AI_GATEWAY_API_KEY=your_gateway_key
   ```

4. **Start the development server**:
   ```bash
   pnpm dev
   ```

5. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

1. **Input Your Schema**: Paste your database schema in one of the supported formats:
   - Prisma schema format
   - SQL DDL statements
   - Database connection string (coming soon)

2. **Generate Visualization**: Click "Generate Diagram" to create an interactive schema diagram

3. **Explore**: 
   - Click on table nodes to view detailed information
   - Drag nodes to rearrange the diagram
   - Use zoom and pan controls to navigate large schemas

4. **Get AI Insights**: View AI-powered explanations about your schema structure, relationships, and design patterns

## Project Structure

```
├── app/
│   ├── page.tsx              # Main application page
│   ├── layout.tsx            # Root layout
│   └── globals.css           # Global styles
├── components/
│   ├── schema/               # Schema visualization components
│   │   ├── schema-input.tsx           # Schema input form
│   │   ├── diagram-canvas.tsx         # React Flow diagram canvas
│   │   ├── table-node.tsx            # Custom table node component
│   │   ├── table-details-drawer.tsx  # Table details panel
│   │   └── ai-explanation-panel.tsx  # AI explanation display
│   └── ui/                   # shadcn/ui components
├── lib/
│   ├── services/
│   │   ├── schema-parser.ts      # Schema parsing logic
│   │   ├── diagram-generator.ts  # Diagram layout generation
│   │   └── ai-explainer.ts       # AI explanation service
│   └── types/
│       └── schema.ts            # TypeScript type definitions
└── ai/
    └── index.ts                # AI model configuration
```

## Development

### Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint

## License

See [LICENSE](LICENSE) file for details.


