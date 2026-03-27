import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold",
        ORDER_STATUS_COLORS[status] || "bg-muted text-muted-foreground"
      )}
    >
      {ORDER_STATUS_LABELS[status] || status}
    </span>
  );
}
