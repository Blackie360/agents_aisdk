"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, Target, MapPin, DollarSign, CheckCircle, ArrowRight, ArrowLeft, Sparkles } from "lucide-react";

interface EventPlannerFormProps {
  onSubmit: (data: EventFormData) => void;
  onCancel: () => void;
}

interface EventFormData {
  goal: string;
  audience: string;
  topic: string;
  format: string;
  platform: string;
  timeframe: string;
  budget: string;
  resources: string;
  successMetrics: string;
}

const steps = [
  {
    id: 1,
    title: "Event Goal",
    icon: Target,
    fields: ["goal"],
  },
  {
    id: 2,
    title: "Audience & Topic",
    icon: Users,
    fields: ["audience", "topic"],
  },
  {
    id: 3,
    title: "Format & Platform",
    icon: MapPin,
    fields: ["format", "platform"],
  },
  {
    id: 4,
    title: "Timeline & Budget",
    icon: DollarSign,
    fields: ["timeframe", "budget"],
  },
  {
    id: 5,
    title: "Resources & Metrics",
    icon: CheckCircle,
    fields: ["resources", "successMetrics"],
  },
];

export function EventPlannerForm({ onSubmit, onCancel }: EventPlannerFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<EventFormData>({
    goal: "",
    audience: "",
    topic: "",
    format: "",
    platform: "",
    timeframe: "",
    budget: "",
    resources: "",
    successMetrics: "",
  });

  const handleInputChange = (field: keyof EventFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = () => {
    const prompt = `
Help me plan a tech community event with the following details:

**Event Goal/Purpose:**
${formData.goal}

**Target Audience:**
${formData.audience}

**Core Topic/Theme:**
${formData.topic}

**Event Format:**
${formData.format}

**Platform/Venue:**
${formData.platform}

**Timeframe/Duration:**
${formData.timeframe}

**Budget:**
${formData.budget}

**Available Resources/Team:**
${formData.resources}

**Success Metrics:**
${formData.successMetrics}

Based on these details, please provide me with a comprehensive event plan covering:
* Event Concept & Objectives
* Target Audience Analysis
* Content & Speaker Strategy
* Marketing & Promotion Plan
* Logistics & Platform/Venue Setup
* Community Engagement Activities (pre, during, post-event)
* Budget Considerations
* Success Metrics & Reporting
* Timeline/Milestones
`.trim();

    onSubmit(formData);
  };

  const isCurrentStepValid = () => {
    const currentStepConfig = steps.find((s) => s.id === currentStep);
    if (!currentStepConfig) return false;
    
    return currentStepConfig.fields.every((field) => {
      const value = formData[field as keyof EventFormData];
      return value && value.trim().length > 0;
    });
  };

  const progress = (currentStep / steps.length) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-2xl mx-auto"
    >
      <Card className="border-2 shadow-lg">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="size-5 text-primary" />
              <CardTitle className="text-xl">Event Planner</CardTitle>
            </div>
            <Badge variant="secondary">
              Step {currentStep} of {steps.length}
            </Badge>
          </div>
          <CardDescription>
            Fill out the details to generate a comprehensive event plan
          </CardDescription>
          
          {/* Progress Bar */}
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <AnimatePresence mode="wait">
            {/* Step 1: Event Goal */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="goal" className="text-base font-semibold">
                    What is the primary goal or purpose of this event?
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    e.g., Launch a new product/feature, foster networking among developers, attract new contributors, gather feedback, educate on a specific technology
                  </p>
                  <Textarea
                    id="goal"
                    value={formData.goal}
                    onChange={(e) => handleInputChange("goal", e.target.value)}
                    placeholder="Describe your event's main objective..."
                    className="min-h-[120px]"
                  />
                </div>
              </motion.div>
            )}

            {/* Step 2: Audience & Topic */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <Label htmlFor="audience" className="text-base font-semibold">
                    Who is the target audience?
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    e.g., Beginner developers, experienced engineers, Python/JavaScript devs, open-source contributors, DevOps professionals
                  </p>
                  <Textarea
                    id="audience"
                    value={formData.audience}
                    onChange={(e) => handleInputChange("audience", e.target.value)}
                    placeholder="Describe your target attendees..."
                    className="min-h-[100px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="topic" className="text-base font-semibold">
                    What is the core topic or theme?
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    e.g., AI/ML, Web3, Cloud Native, specific framework like React/Vue, API development, cybersecurity, career growth
                  </p>
                  <Textarea
                    id="topic"
                    value={formData.topic}
                    onChange={(e) => handleInputChange("topic", e.target.value)}
                    placeholder="What will the event focus on..."
                    className="min-h-[100px]"
                  />
                </div>
              </motion.div>
            )}

            {/* Step 3: Format & Platform */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <Label htmlFor="format" className="text-base font-semibold">
                    What kind of event are you envisioning?
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    e.g., Online webinar/conference, in-person meetup, multi-day conference, weekend hackathon, hands-on workshop
                  </p>
                  <Textarea
                    id="format"
                    value={formData.format}
                    onChange={(e) => handleInputChange("format", e.target.value)}
                    placeholder="Describe the event format..."
                    className="min-h-[100px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="platform" className="text-base font-semibold">
                    Do you have a preferred platform or venue?
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Online: Zoom, Discord, YouTube Live, dedicated virtual event platform. In-person: co-working space, company office, conference center, local hub
                  </p>
                  <Textarea
                    id="platform"
                    value={formData.platform}
                    onChange={(e) => handleInputChange("platform", e.target.value)}
                    placeholder="Where will the event take place..."
                    className="min-h-[100px]"
                  />
                </div>
              </motion.div>
            )}

            {/* Step 4: Timeline & Budget */}
            {currentStep === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <Label htmlFor="timeframe" className="text-base font-semibold">
                    What is the ideal timeframe or duration?
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    e.g., 1-hour webinar, half-day workshop, full-day conference, weekend hackathon. Do you have a rough date in mind?
                  </p>
                  <Textarea
                    id="timeframe"
                    value={formData.timeframe}
                    onChange={(e) => handleInputChange("timeframe", e.target.value)}
                    placeholder="When and how long..."
                    className="min-h-[100px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="budget" className="text-base font-semibold">
                    What is your estimated budget range, if any?
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Even a rough idea helps determine what's feasible for venue, catering, tools, speakers, etc.
                  </p>
                  <Textarea
                    id="budget"
                    value={formData.budget}
                    onChange={(e) => handleInputChange("budget", e.target.value)}
                    placeholder="Budget considerations..."
                    className="min-h-[100px]"
                  />
                </div>
              </motion.div>
            )}

            {/* Step 5: Resources & Metrics */}
            {currentStep === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <Label htmlFor="resources" className="text-base font-semibold">
                    What resources or team members do you have available?
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    e.g., A team, existing community platform, marketing channels, potential speakers
                  </p>
                  <Textarea
                    id="resources"
                    value={formData.resources}
                    onChange={(e) => handleInputChange("resources", e.target.value)}
                    placeholder="Available resources and support..."
                    className="min-h-[100px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="successMetrics" className="text-base font-semibold">
                    How will you measure the success of this event?
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    e.g., Number of registrations, attendance rate, engagement in chat/Q&A, positive feedback, new sign-ups, code submissions, social media reach
                  </p>
                  <Textarea
                    id="successMetrics"
                    value={formData.successMetrics}
                    onChange={(e) => handleInputChange("successMetrics", e.target.value)}
                    placeholder="Success criteria..."
                    className="min-h-[100px]"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={currentStep === 1 ? onCancel : handleBack}
              className="gap-2"
            >
              <ArrowLeft className="size-4" />
              {currentStep === 1 ? "Cancel" : "Back"}
            </Button>

            {currentStep < steps.length ? (
              <Button
                onClick={handleNext}
                disabled={!isCurrentStepValid()}
                className="gap-2"
              >
                Next
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!isCurrentStepValid()}
                className="gap-2"
              >
                <Sparkles className="size-4" />
                Generate Plan
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

