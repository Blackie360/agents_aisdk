'use client';

import { Card } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

interface AIExplanationPanelProps {
  explanation: string;
  isStreaming?: boolean;
}

export function AIExplanationPanel({ explanation, isStreaming = false }: AIExplanationPanelProps) {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    if (!isStreaming) {
      setDisplayedText(explanation);
      return;
    }

    // Simulate streaming
    let index = 0;
    const interval = setInterval(() => {
      if (index < explanation.length) {
        setDisplayedText(explanation.slice(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
      }
    }, 20);

    return () => clearInterval(interval);
  }, [explanation, isStreaming]);

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-primary" />
        <h2 className="font-semibold text-lg">Schema Explanation</h2>
      </div>
      
      <div className="prose prose-sm dark:prose-invert max-w-none">
        {displayedText ? (
          <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {displayedText}
            {isStreaming && <span className="animate-pulse">▊</span>}
          </div>
        ) : (
          <p className="text-muted-foreground italic">
            Generate a diagram to see AI-powered insights...
          </p>
        )}
      </div>
    </Card>
  );
}

