import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Seconds → "m:ss" (e.g. 120 → "2:00", 30 → "0:30", 5 → "0:05").
export function formatMMSS(totalSeconds: number) {
  const s = Math.max(0, Math.ceil(totalSeconds))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, "0")}`
}
