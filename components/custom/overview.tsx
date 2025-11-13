import { motion } from "framer-motion";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Calendar, TrendingUp, MessageSquare, Megaphone, Globe } from "lucide-react";

import { LogoGoogle, MessageIcon, VercelIcon } from "./icons";

const capabilities = [
  { icon: Users, label: "Community Growth", desc: "Strategies & programs" },
  { icon: Calendar, label: "Event Planning", desc: "Meetups & hackathons" },
  { icon: TrendingUp, label: "Metrics & Analytics", desc: "Track engagement" },
  { icon: MessageSquare, label: "Content Creation", desc: "Social & technical" },
  { icon: Megaphone, label: "DevRel Campaigns", desc: "Advocacy programs" },
  { icon: Globe, label: "Web Research", desc: "Latest trends & news" },
];

export const Overview = () => {
  return (
    <motion.div
      key="overview"
      className="max-w-full sm:max-w-[500px] mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="relative">
        <CardHeader className="space-y-3 pb-3">
          <CardTitle className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-4 items-center">
            <div className="flex items-center gap-2">
              <VercelIcon />
              <span className="text-lg sm:text-xl">+</span>
              <MessageIcon />
            </div>
          </CardTitle>
          <CardDescription className="text-center text-sm sm:text-base">
            Your AI-powered Tech Community Manager & DevRel Assistant
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-2">
          <div className="h-px bg-border opacity-50" />
          
          <p className="text-sm text-muted-foreground text-center">
            Specialized in DevRel, community building, and tech event planning
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {capabilities.map((cap, index) => (
              <motion.div
                key={cap.label}
                initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ delay: 0.1 * index, duration: 0.3 }}
              >
                <Badge
                  variant="secondary"
                  className="w-full h-auto flex flex-col items-center gap-1.5 p-2 sm:p-3 transition-all cursor-default"
                >
                  <cap.icon className="size-4 sm:size-5" />
                  <span className="text-xs font-semibold text-center leading-tight">{cap.label}</span>
                  <span className="text-[10px] opacity-70 text-center">{cap.desc}</span>
                </Badge>
              </motion.div>
            ))}
          </div>

          <div className="h-px bg-border opacity-50" />

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground text-center">
              Try asking:
            </p>
            <div className="text-[10px] sm:text-xs text-muted-foreground space-y-1 text-center">
              <p>• "Create a 3-month community growth strategy"</p>
              <p>• "What are the latest DevRel trends for 2025?"</p>
              <p>• "Help me plan a virtual hackathon"</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
