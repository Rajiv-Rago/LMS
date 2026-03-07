import { Skeleton } from "@/components/ui/Skeleton";

export default function QuizLoading() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-24" />
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 space-y-3"
          >
            <Skeleton className="h-5 w-full" />
            {Array.from({ length: 4 }).map((_, j) => (
              <Skeleton key={j} className="h-10 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
