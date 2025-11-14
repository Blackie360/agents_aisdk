import Image from "next/image";

import { History } from "./history";
import { SlashIcon } from "./icons";
import { ThemeToggle } from "./theme-toggle";
import { WorkspaceSwitcher } from "./workspace-switcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";

export const Navbar = async () => {
  return (
    <>
      <div className="bg-background absolute top-0 left-0 w-dvw py-3 px-3 sm:px-4 md:px-6 justify-between flex flex-row items-center z-30 border-b shadow-sm">
        <div className="flex flex-row gap-2 sm:gap-3 items-center">
          <History />
          <div className="flex flex-row gap-1.5 sm:gap-2 items-center">
            <Image
              src="/images/gemini-logo.png"
              height={20}
              width={20}
              alt="Tech Community Manager AI"
            />
            <div className="text-muted-foreground hidden sm:block">
              <SlashIcon size={16} />
            </div>
            <div className="text-sm sm:text-base font-semibold truncate w-32 sm:w-48 md:w-fit tracking-wide">
              Community Manager AI
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <WorkspaceSwitcher />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="py-1.5 px-3 h-fit font-semibold"
                variant="secondary"
              >
                Menu
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <ThemeToggle />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </>
  );
};
