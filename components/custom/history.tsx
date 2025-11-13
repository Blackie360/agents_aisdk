"use client";

import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import Link from "next/link";
import { useState } from "react";

import {
  InfoIcon,
  MenuIcon,
  PencilEditIcon,
} from "./icons";
import { Button } from "../ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";

// No database - history is empty
export const History = () => {
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        className="p-1.5 h-fit"
        onClick={() => {
          setIsHistoryVisible(true);
        }}
      >
        <MenuIcon />
      </Button>

      <Sheet
        open={isHistoryVisible}
        onOpenChange={(state) => {
          setIsHistoryVisible(state);
        }}
      >
        <SheetContent side="left" className="p-4 w-80">
          <SheetHeader>
            <VisuallyHidden.Root>
              <SheetTitle className="text-left">History</SheetTitle>
              <SheetDescription className="text-left">
                0 chats
              </SheetDescription>
            </VisuallyHidden.Root>
          </SheetHeader>

          <div className="text-sm flex flex-row items-center justify-between border-b pb-3 mb-4">
            <div className="flex flex-row gap-2">
              <div className="font-semibold">History</div>
              <div className="text-muted-foreground">0 chats</div>
            </div>
          </div>

          <div className="flex flex-col">
            <Button
              className="font-semibold text-sm flex flex-row justify-between mb-4"
              asChild
            >
              <Link href="/">
                <div>Start a new chat</div>
                <PencilEditIcon size={14} />
              </Link>
            </Button>

            <div className="flex flex-col overflow-y-scroll p-1 h-[calc(100dvh-180px)]">
              <div className="text-muted-foreground h-dvh w-full flex flex-col justify-center items-center text-sm gap-3">
                <InfoIcon />
                <div className="text-center">No chat history available</div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
