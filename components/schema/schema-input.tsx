'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Upload, Loader2, Sparkles } from 'lucide-react';

interface SchemaInputProps {
  onGenerate: (input: string) => void;
  isLoading: boolean;
}

export function SchemaInput({ onGenerate, isLoading }: SchemaInputProps) {
  const [input, setInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setInput(content);
    };
    reader.readAsText(file);
  };

  const handleGenerate = () => {
    if (input.trim()) {
      onGenerate(input);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="w-4 h-4" />
          <span>Paste your database schema (Prisma or SQL) - we'll detect it automatically</span>
        </div>
        
        <Textarea 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste your Prisma schema or SQL statements here...&#10;&#10;Example (Prisma):&#10;model User {&#10;  id    String @id @default(uuid())&#10;  email String @unique&#10;  posts Post[]&#10;}&#10;&#10;Example (SQL):&#10;CREATE TABLE users (&#10;  id UUID PRIMARY KEY,&#10;  email VARCHAR(255) UNIQUE NOT NULL&#10;);"
          className="font-mono min-h-[450px] text-sm"
        />
      </div>

      <div className="mt-4 flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".prisma,.sql,.txt"
          onChange={handleFileUpload}
          className="hidden"
        />
        <Button 
          variant="outline" 
          className="gap-2"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
        >
          <Upload className="w-4 h-4" />
          Upload File
        </Button>
        <Button 
          onClick={handleGenerate}
          disabled={isLoading || !input.trim()}
          className="flex-1"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            'Generate Diagram'
          )}
        </Button>
      </div>
      
      {isLoading && (
        <div className="mt-4 text-sm text-muted-foreground space-y-1">
          <div>🔍 Auto-detecting schema type → 🔗 Finding relationships → 📊 Generating diagram</div>
        </div>
      )}
    </Card>
  );
}
