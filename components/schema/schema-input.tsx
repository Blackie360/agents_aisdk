'use client';

import { useState, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Upload, Loader2 } from 'lucide-react';

interface SchemaInputProps {
  onGenerate: (input: string, type: 'prisma' | 'sql' | 'connection') => void;
  isLoading: boolean;
}

export function SchemaInput({ onGenerate, isLoading }: SchemaInputProps) {
  const [activeTab, setActiveTab] = useState<'prisma' | 'sql' | 'connection'>('prisma');
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
      onGenerate(input, activeTab);
    }
  };

  return (
    <Card className="p-6">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'prisma' | 'sql' | 'connection')}>
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="prisma">Prisma Schema</TabsTrigger>
          <TabsTrigger value="sql">SQL</TabsTrigger>
          <TabsTrigger value="connection">Database</TabsTrigger>
        </TabsList>

        <TabsContent value="prisma" className="mt-4">
          <Textarea 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="model User {&#10;  id        String   @id @default(uuid())&#10;  email     String   @unique&#10;  name      String?&#10;  createdAt DateTime  @default(now())&#10;}"
            className="font-mono min-h-[400px] text-sm"
          />
        </TabsContent>

        <TabsContent value="sql" className="mt-4">
          <Textarea 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="CREATE TABLE users (&#10;  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),&#10;  email VARCHAR(255) UNIQUE NOT NULL,&#10;  name VARCHAR(255),&#10;  created_at TIMESTAMP NOT NULL DEFAULT NOW()&#10;);"
            className="font-mono min-h-[400px] text-sm"
          />
        </TabsContent>

        <TabsContent value="connection" className="mt-4">
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Database connection feature coming soon. For now, paste your schema directly.
            </div>
            <Textarea 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste your schema here..."
              className="font-mono min-h-[400px] text-sm"
            />
          </div>
        </TabsContent>
      </Tabs>

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
          <div>Analyzing schema → Detecting relationships → Generating diagram</div>
        </div>
      )}
    </Card>
  );
}

