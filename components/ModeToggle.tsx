"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function ModeToggle({
  className,
  collapsed,
}: {
  className?: string;
  collapsed?: boolean;
}) {
  const { resolvedTheme, setTheme } = useTheme();

  function toggleTheme() {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }

  const icon = (
    <>
      <Sun className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      {!collapsed && <span className="ml-1">Theme</span>}
      <span className="sr-only">Toggle theme</span>
    </>
  );

  const buttonClass = cn(
    "relative",
    collapsed ? "size-8" : "w-full justify-start gap-2",
    className
  );

  return (
    <>
      <Button
        variant="outline"
        size={collapsed ? "icon" : "default"}
        className={cn(buttonClass, "md:hidden")}
        onClick={toggleTheme}
        aria-label="Toggle theme"
      >
        {icon}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size={collapsed ? "icon" : "default"}
              className={cn(buttonClass, "hidden md:inline-flex")}
            />
          }
        >
          {icon}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top">
          <DropdownMenuItem onClick={() => setTheme("light")}>
            Light
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("dark")}>
            Dark
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("system")}>
            System
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
