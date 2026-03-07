import { Skeleton } from "@/components/ui/Skeleton";

export default function StudentGradesLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-5 w-32" />
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 space-y-2"
          >
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-1/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
