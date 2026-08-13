"use client";

import type { ReactNode } from "react";
import { Building2, CalendarDays } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "@/store";
import { setDateFilter, setStoreFilter } from "@/store/slices/uiSlice";
import { useGetStoresQuery } from "@/store/api/fourtyApi";
import { Label } from "@/components/ui/label";
import { CompactSelect } from "@/components/table/data-table-toolbar";
import { DateRangePicker } from "@/components/filters/date-range-picker";
import { cn } from "@/lib/utils";
import type { DateRangeFilter } from "@/types/database";

const presets: { value: string; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
  { value: "custom", label: "Custom range" },
];

export function FilterBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      {children}
    </div>
  );
}

/** @deprecated Prefer CompactSelect — kept for gradual migration */
export function FilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-[8rem] shrink-0 space-y-1", className)}>
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export function GlobalFilters({
  showStore = true,
  showDate = true,
  className,
  children,
}: {
  showStore?: boolean;
  showDate?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const dispatch = useDispatch();
  const { storeFilter, dateFilter } = useSelector((s: RootState) => s.ui);
  const profile = useSelector((s: RootState) => s.auth.profile);
  const { data: stores = [] } = useGetStoresQuery();
  const isOwner = profile?.role === "owner";

  return (
    <FilterBar className={className}>
      {showStore && isOwner && (
        <CompactSelect
          icon={Building2}
          label="Store"
          value={storeFilter}
          onChange={(v) => dispatch(setStoreFilter(v))}
          options={[
            { value: "all", label: "All stores" },
            ...stores.map((s) => ({ value: s.id, label: s.name })),
          ]}
        />
      )}

      {showDate && (
        <CompactSelect
          icon={CalendarDays}
          label="Period"
          value={dateFilter.preset || "month"}
          onChange={(v) => {
            const preset = v as DateRangeFilter["preset"];
            if (preset === "custom") {
              const today = new Date().toISOString().slice(0, 10);
              dispatch(
                setDateFilter({
                  preset: "custom",
                  from: dateFilter.from || today,
                  to: dateFilter.to || today,
                })
              );
              return;
            }
            dispatch(
              setDateFilter({
                preset,
                from: undefined,
                to: undefined,
              })
            );
          }}
          options={presets}
        />
      )}

      {showDate && dateFilter.preset === "custom" && (
        <DateRangePicker
          from={dateFilter.from}
          to={dateFilter.to}
          onChange={({ from, to }) =>
            dispatch(
              setDateFilter({
                preset: "custom",
                from,
                to,
              })
            )
          }
          placeholder="Select custom range"
        />
      )}

      {children}
    </FilterBar>
  );
}
