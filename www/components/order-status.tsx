import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { OrderStatus as Status } from "@/lib/mock-data"

export function OrderTimeline({ statuses }: { statuses: Status[] }) {
  const activeIndex = statuses.findIndex((s) => !s.done)

  return (
    <div className="space-y-0">
      {statuses.map((status, i) => {
        const isActive = i === activeIndex
        const isDone = status.done

        return (
          <div key={status.label} className="flex gap-4">
            {/* Line + Dot */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
                  isDone
                    ? "border-foreground bg-foreground text-background"
                    : isActive
                    ? "border-foreground bg-background"
                    : "border-muted-foreground/30 bg-background"
                )}
              >
                {isDone && <Check size={14} strokeWidth={3} />}
                {isActive && <div className="h-2.5 w-2.5 rounded-full bg-foreground animate-pulse" />}
              </div>
              {i < statuses.length - 1 && (
                <div
                  className={cn("w-0.5 flex-1 min-h-8", isDone ? "bg-foreground" : "bg-muted-foreground/20")}
                />
              )}
            </div>

            {/* Content */}
            <div className="pb-8 pt-1">
              <p
                className={cn("text-sm font-medium", isDone || isActive ? "text-foreground" : "text-muted-foreground")}
              >
                {status.label}
              </p>
              <p className="text-xs text-muted-foreground">{status.time}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
