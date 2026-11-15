import type { UsageLimitsBudget, UsageLimitsInfo, UsageLimitsMeter } from "@opencode/client"

export type Meter = UsageLimitsMeter
export type Budget = UsageLimitsBudget
export type Usage = UsageLimitsInfo

/** Meters the OpenCode Go allowance reports, in display order. */
export const METERS = [
  { key: "rolling", label: "Rolling", short: "roll" },
  { key: "weekly", label: "Weekly", short: "week" },
  { key: "monthly", label: "Monthly", short: "month" },
] as const

export type MeterKey = (typeof METERS)[number]["key"]
export type Severity = "ok" | "warn" | "high"

export function severity(percent: number): Severity {
  if (percent >= 90) return "high"
  if (percent >= 70) return "warn"
  return "ok"
}

/** Whole percent, never below 0 or above 100. */
export function percent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10))
}

export function formatPercent(value: number): string {
  const rounded = percent(value)
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`
}

/** Filled/empty cell counts for a bar. `width` is the total cell count. */
export function bar(value: number, width = 20): { filled: number; empty: number } {
  const filled = Math.max(0, Math.min(width, Math.round((percent(value) / 100) * width)))
  return { filled, empty: width - filled }
}

export function barText(value: number, width = 20): string {
  const cells = bar(value, width)
  return "█".repeat(cells.filled) + "░".repeat(cells.empty)
}

/** Largest meter percent, used for the one-line summary color. */
export function worst(usage: Usage | null): number {
  if (!usage?.go) return 0
  return Math.max(...METERS.map((meter) => percent(usage.go![meter.key].percent)))
}

export function limited(usage: Usage | null): boolean {
  if (!usage) return false
  const meters = usage.go ? METERS.some((meter) => usage.go![meter.key].limited) : false
  return meters || usage.budgets.some((budget) => budget.limit > 0 && budget.spent >= budget.limit)
}

/**
 * Human duration until a timestamp. Deliberately coarse: quota windows are
 * hours to weeks out, so seconds are noise.
 */
export function duration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "now"
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return "<1m"
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const rest = minutes % 60
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`
  if (hours > 0) return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`
  return `${minutes}m`
}

export function resetsIn(at: number, now = Date.now()): string {
  return duration(at - now)
}

export function money(value: number): string {
  if (!Number.isFinite(value)) return "$0.00"
  if (value > 0 && value < 0.01) return "<$0.01"
  return `$${value.toFixed(2)}`
}

/** Compact summary for a footer: `1%·3%·2%`. */
export function summary(usage: Usage | null): string | undefined {
  if (!usage?.go) return undefined
  return METERS.map((meter) => formatPercent(usage.go![meter.key].percent)).join("·")
}

export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  if (error && typeof error === "object" && "message" in error) return String((error as { message: unknown }).message)
  return "Unknown error"
}
