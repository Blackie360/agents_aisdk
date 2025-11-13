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
        <SheetContent side="left" className="p-3 w-80 bg-muted">
          <SheetHeader>
            <VisuallyHidden.Root>
              <SheetTitle className="text-left">History</SheetTitle>
              <SheetDescription className="text-left">
                0 chats
              </SheetDescription>
            </VisuallyHidden.Root>
          </SheetHeader>

          <div className="text-sm flex flex-row items-center justify-between">
            <div className="flex flex-row gap-2">
              <div className="dark:text-zinc-300">History</div>
              <div className="dark:text-zinc-400 text-zinc-500">0 chats</div>
            </div>
          </div>

          <div className="mt-10 flex flex-col">
            <Button
              className="font-normal text-sm flex flex-row justify-between text-white"
              asChild
            >
              <Link href="/">
                <div>Start a new chat</div>
                <PencilEditIcon size={14} />
              </Link>
            </Button>

            <div className="flex flex-col overflow-y-scroll p-1 h-[calc(100dvh-124px)]">
              <div className="text-zinc-500 h-dvh w-full flex flex-row justify-center items-center text-sm gap-2">
                <InfoIcon />
                <div>No chat history available</div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
