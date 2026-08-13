"use client";

import * as React from "react";
import { format, parseISO, isValid } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CalendarRange } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function parseYmd(value?: string | null) {
  if (!value) return undefined;
  const d = parseISO(value.slice(0, 10));
  return isValid(d) ? d : undefined;
}

function toYmd(date?: Date) {
  if (!date || !isValid(date)) return "";
  return format(date, "yyyy-MM-dd");
}

export function DateRangePicker({
  from,
  to,
  onChange,
  className,
  placeholder = "Pick dates",
  compact = true,
  numberOfMonths,
}: {
  from?: string | null;
  to?: string | null;
  onChange: (next: { from: string; to: string }) => void;
  className?: string;
  placeholder?: string;
  compact?: boolean;
  numberOfMonths?: number;
}) {
  const [open, setOpen] = React.useState(false);
  const selected: DateRange | undefined = React.useMemo(() => {
    const f = parseYmd(from);
    const t = parseYmd(to);
    if (!f && !t) return undefined;
    return { from: f, to: t };
  }, [from, to]);

  const label = React.useMemo(() => {
    const f = parseYmd(from);
    const t = parseYmd(to);
    if (f && t) {
      return `${format(f, "MMM d, yyyy")} – ${format(t, "MMM d, yyyy")}`;
    }
    if (f) return `${format(f, "MMM d, yyyy")} – …`;
    return placeholder;
  }, [from, to, placeholder]);

  const [monthsShown, setMonthsShown] = React.useState(numberOfMonths ?? 1);

  React.useEffect(() => {
    if (numberOfMonths) {
      setMonthsShown(numberOfMonths);
      return;
    }
    const mq = window.matchMedia("(min-width: 640px)");
    const apply = () => setMonthsShown(mq.matches ? 2 : 1);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [numberOfMonths]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              compact
                ? "h-8 max-w-[14rem] justify-start gap-1.5 border-border/80 bg-background/70 px-2 text-xs font-normal shadow-sm"
                : "h-9 justify-start gap-2 text-sm font-normal",
              !from && "text-muted-foreground",
              className
            )}
          />
        }
      >
        <CalendarRange className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{label}</span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-auto max-w-[calc(100vw-1.5rem)] p-0"
      >
        <Calendar
          mode="range"
          selected={selected}
          onSelect={(range) => {
            if (!range?.from) return;
            const nextFrom = toYmd(range.from);
            const nextTo = toYmd(range.to ?? range.from);
            onChange({ from: nextFrom, to: nextTo });
            if (range.from && range.to) setOpen(false);
          }}
          numberOfMonths={monthsShown}
          defaultMonth={selected?.from || new Date()}
          className="rounded-lg"
        />
        <div className="flex items-center justify-between gap-2 border-t border-border/60 px-3 py-2">
          <p className="text-[11px] text-muted-foreground">
            {from && to ? "Range selected" : "Select start and end dates"}
          </p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => setOpen(false)}
            disabled={!from || !to}
          >
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Single-date picker for forms (closeout date, etc.) */
export function DatePicker({
  value,
  onChange,
  className,
  placeholder = "Pick a date",
}: {
  value?: string | null;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = parseYmd(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-9 w-full justify-start gap-2 text-sm font-normal",
              !value && "text-muted-foreground",
              className
            )}
          />
        }
      >
        <CalendarRange className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">
          {selected ? format(selected, "MMM d, yyyy") : placeholder}
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            if (!date) return;
            onChange(toYmd(date));
            setOpen(false);
          }}
          defaultMonth={selected || new Date()}
        />
      </PopoverContent>
    </Popover>
  );
}
