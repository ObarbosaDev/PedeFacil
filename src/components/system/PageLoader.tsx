import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type PageLoaderProps = {
  label?: string;
  className?: string;
};

export default function PageLoader({ label = "Carregando dados...", className }: PageLoaderProps) {
  return (
    <div className={cn("min-h-screen w-full bg-muted/30", className)} role="status" aria-live="polite">
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 md:px-8">
        <div className="rounded-2xl border bg-card p-6 md:p-8">
          <Skeleton className="mb-3 h-4 w-40" />
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="mt-3 h-4 w-2/3" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-xl border bg-card p-4">
              <Skeleton className="mb-2 h-4 w-24" />
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-xl border bg-card p-4">
            <Skeleton className="mb-3 h-5 w-48" />
            <Skeleton className="h-20 w-full" />
          </div>
          <div className="rounded-xl border bg-card p-4">
            <Skeleton className="mb-3 h-5 w-40" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
