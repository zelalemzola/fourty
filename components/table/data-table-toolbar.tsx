"use client";

import type { LucideIcon } from "lucide-react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type TableFilterOption = {
  value: string;
  label: string;
};

export type TableFilterDef = {
  id: string;
  label: string;
  icon?: LucideIcon;
  value: string;
  onChange: (value: string) => void;
  options: TableFilterOption[];
  allLabel?: string;
};

export function CompactSelect({
  icon: Icon,
  label,
  value,
  onChange,
  options,
  placeholder,
  className,
  triggerClassName,
}: {
  icon?: LucideIcon;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: TableFilterOption[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
}) {
  const selected = options.find((o) => o.value === value);
  const display = selected?.label || placeholder || label;

  return (
    <div className={cn("shrink-0", className)}>
      <Select value={value} onValueChange={(v) => onChange(v ?? options[0]?.value ?? "")}>
        <SelectTrigger
          size="sm"
          aria-label={label}
          title={`${label}: ${display}`}
          className={cn(
            "h-8 max-w-[9.5rem] gap-1.5 border-border/80 bg-background/70 px-2 text-xs shadow-sm",
            triggerClassName
          )}
        >
          {Icon && <Icon className="size-3.5 shrink-0 text-muted-foreground" />}
          <SelectValue placeholder={placeholder || label} />
        </SelectTrigger>
        <SelectContent
          alignItemWithTrigger={false}
          align="start"
          className="min-w-[12.5rem]"
        >
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function DataTableToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  filters = [],
  className,
  trailing,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: TableFilterDef[];
  className?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="relative min-w-0 flex-1 sm:max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-8 bg-background/70 pl-8 text-sm shadow-sm"
        />
      </div>
      <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {filters.map((f) => (
          <CompactSelect
            key={f.id}
            icon={f.icon}
            label={f.label}
            value={f.value}
            onChange={f.onChange}
            options={
              f.allLabel
                ? [{ value: "all", label: f.allLabel }, ...f.options]
                : f.options
            }
          />
        ))}
        {trailing}
      </div>
    </div>
  );
}
