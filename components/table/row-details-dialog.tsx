"use client";

import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { DetailField } from "@/components/table/mobile-row-card";
import { cn } from "@/lib/utils";

export function RowDetailsDialog({
  open,
  onOpenChange,
  title,
  description,
  fields,
  footer,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  fields: DetailField[];
  footer?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        <dl className="grid gap-2.5 text-sm">
          {fields.map((f) => (
            <div
              key={f.label}
              className={cn(
                "flex justify-between gap-3 border-b border-border/40 pb-2 last:border-0 last:pb-0",
                f.fullWidth && "flex-col"
              )}
            >
              <dt className="shrink-0 text-muted-foreground">{f.label}</dt>
              <dd
                className={cn(
                  "text-right font-medium text-foreground",
                  f.fullWidth && "text-left whitespace-pre-wrap"
                )}
              >
                {f.value ?? "—"}
              </dd>
            </div>
          ))}
        </dl>

        {children}

        <DialogFooter className="border-0 bg-transparent p-0 sm:justify-end">
          {footer}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Clickable table row helper props */
export function rowClickProps(onClick?: () => void) {
  if (!onClick) return {};
  return {
    className: "cursor-pointer",
    onClick,
    role: "button" as const,
    tabIndex: 0,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick();
      }
    },
  };
}
