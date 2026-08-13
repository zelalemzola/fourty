"use client";

import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function ProofViewer({
  url,
  open,
  onOpenChange,
  title = "Proof screenshot",
}: {
  url: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="gap-3 overflow-hidden p-3 sm:max-w-4xl lg:max-w-5xl"
        showCloseButton
      >
        <DialogHeader className="flex-row items-start justify-between gap-3 space-y-0 pr-8 text-left">
          <div className="space-y-1">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Preview below — open original for full resolution.
            </DialogDescription>
          </div>
          {url && (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              render={
                <a href={url} target="_blank" rel="noopener noreferrer" />
              }
            >
              <ExternalLink className="size-3.5" />
              Open
            </Button>
          )}
        </DialogHeader>

        <div className="flex max-h-[min(80vh,720px)] min-h-[240px] items-center justify-center overflow-auto rounded-lg bg-muted/40 ring-1 ring-border/60">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={title}
              className="max-h-[min(80vh,720px)] w-full object-contain"
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ProofThumb({
  url,
  alt = "Proof",
  className,
  onPreview,
}: {
  url: string;
  alt?: string;
  className?: string;
  onPreview: (url: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPreview(url)}
      className={cn(
        "inline-flex shrink-0 overflow-hidden rounded-md ring-1 ring-border transition hover:ring-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        className
      )}
      aria-label={`Preview ${alt}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt} className="size-full object-cover" />
    </button>
  );
}
