"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { Calendar } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface IntegrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IntegrationModal({
  open,
  onOpenChange,
}: IntegrationModalProps) {
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (open) {
      console.log("Modal opened");
    } else {
      console.log("Modal closed");
    }
  }, [open]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      // Get current URL to redirect back after OAuth
      const returnUrl = window.location.pathname + window.location.search;
      await signIn("google", {
        callbackUrl: returnUrl,
        redirect: true,
      });
    } catch (error) {
      console.error("Failed to connect Google Calendar:", error);
      setIsConnecting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    // Only allow closing via Cancel button or X button, not by clicking outside
    // Prevent closing if trying to close while opening
    if (newOpen) {
      onOpenChange(true);
      return;
    }
    if (!newOpen && !isConnecting) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} modal={true}>
      <DialogContent 
        className="sm:max-w-[500px]"
        onInteractOutside={(e) => {
          // Prevent closing when clicking outside
          e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          // Allow ESC to close only if not connecting
          if (isConnecting) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <DialogTitle>Connect Google Calendar</DialogTitle>
          </div>
          <DialogDescription className="text-left pt-2">
            Connect your Google Calendar to enable the assistant to help you:
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
            <p className="text-sm text-muted-foreground">
              Schedule and manage community events
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
            <p className="text-sm text-muted-foreground">
              Check calendar availability before scheduling
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
            <p className="text-sm text-muted-foreground">
              View and organize your upcoming events
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
            <p className="text-sm text-muted-foreground">
              Get reminders and event details automatically
            </p>
          </div>
        </div>

        <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          <p>
            By connecting, you authorize this app to access your Google Calendar.
            Your data is secure and only used to provide calendar management
            features.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isConnecting}
          >
            Cancel
          </Button>
          <Button onClick={handleConnect} disabled={isConnecting}>
            {isConnecting ? "Connecting..." : "Connect Google Calendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

