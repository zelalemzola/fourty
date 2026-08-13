import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  subDays,
} from "date-fns";
import type { DateRangeFilter } from "@/types/database";

export function resolveDateRange(filter?: DateRangeFilter) {
  const now = new Date();
  const preset = filter?.preset || "month";

  if (preset === "custom" && filter?.from && filter?.to) {
    return {
      from: startOfDay(new Date(filter.from)).toISOString(),
      to: endOfDay(new Date(filter.to)).toISOString(),
    };
  }

  switch (preset) {
    case "today":
      return {
        from: startOfDay(now).toISOString(),
        to: endOfDay(now).toISOString(),
      };
    case "week":
      return {
        from: startOfWeek(now, { weekStartsOn: 1 }).toISOString(),
        to: endOfWeek(now, { weekStartsOn: 1 }).toISOString(),
      };
    case "quarter":
      return {
        from: startOfQuarter(now).toISOString(),
        to: endOfQuarter(now).toISOString(),
      };
    case "year":
      return {
        from: startOfYear(now).toISOString(),
        to: endOfYear(now).toISOString(),
      };
    case "month":
    default:
      return {
        from: startOfMonth(now).toISOString(),
        to: endOfMonth(now).toISOString(),
      };
  }
}

export function previousPeriod(fromIso: string, toIso: string) {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const days = Math.max(
    1,
    Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
  );
  return {
    from: startOfDay(subDays(from, days)).toISOString(),
    to: endOfDay(subDays(to, days)).toISOString(),
  };
}
