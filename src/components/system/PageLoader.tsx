import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type PageLoaderProps = {
  label?: string;
  className?: string;
};

export default function PageLoader({ label = "Carregando dados...", className }: PageLoaderProps) {
  return (
    <div className={cn("min-h-screen w-full bg-[#f3efe6]", className)} role="status" aria-live="polite">
      <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 md:px-8">
        <div className="h-1.5 overflow-hidden rounded-full bg-black/5">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
        </div>

        <div className="rounded-[28px] border border-zinc-950/10 bg-white/95 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] md:p-8">
          <Skeleton className="mb-3 h-4 w-40" />
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="mt-3 h-4 w-2/3" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-[24px] border border-zinc-950/10 bg-white/95 p-4 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
              <Skeleton className="mb-2 h-4 w-24" />
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-[24px] border border-zinc-950/10 bg-white/95 p-4 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
            <Skeleton className="mb-3 h-5 w-48" />
            <Skeleton className="h-20 w-full" />
          </div>
          <div className="rounded-[24px] border border-zinc-950/10 bg-white/95 p-4 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
            <Skeleton className="mb-3 h-5 w-40" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
