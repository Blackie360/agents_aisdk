"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IntegrationModal } from "./integration-modal";

export function ConnectCalendarButton() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const searchParams = useSearchParams();
  const router = useRouter();

  const checkConnection = async () => {
    try {
      const response = await fetch("/api/integrations/google-calendar/status", {
        cache: "no-store",
      });
      if (response.ok) {
        const data = await response.json();
        const isConnectedStatus = Boolean(data.connected || data.isCalendarConnected);
        setIsConnected(isConnectedStatus);
        return isConnectedStatus;
      } else {
        setIsConnected(false);
        return false;
      }
    } catch (error) {
      console.error("Failed to check Google Calendar connection:", error);
      setIsConnected(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  // Re-check connection status when returning from OAuth callback
  useEffect(() => {
    const oauthReturn = searchParams?.get("code");
    if (oauthReturn) {
      // Wait a bit for backend to process, then check connection
      const timer = setTimeout(async () => {
        const connected = await checkConnection();
        if (connected) {
          // Refresh the router to get fresh data and remove OAuth params
          router.refresh();
          // Also remove params from URL
          router.replace(window.location.pathname);
        }
      }, 2000); // Increased delay to ensure backend has processed
      
      return () => clearTimeout(timer);
    }
  }, [searchParams, router]);

  // Also check on window focus (in case user returns from OAuth in new tab)
  useEffect(() => {
    const handleFocus = () => {
      checkConnection();
    };
    
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  // Don't render anything while loading or if already connected
  if (isLoading || isConnected === null || isConnected) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsModalOpen(true);
        }}
        className="gap-2"
      >
        <Calendar className="h-4 w-4" />
        <span className="hidden sm:inline">Connect Calendar</span>
        <span className="sm:hidden">Calendar</span>
      </Button>
      <IntegrationModal open={isModalOpen} onOpenChange={setIsModalOpen} />
    </>
  );
}

