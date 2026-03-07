import { Skeleton } from "@/components/ui/Skeleton";

export default function AITutorLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 h-96 flex flex-col justify-end space-y-4">
        <div className="flex justify-end">
          <Skeleton className="h-12 w-2/3" />
        </div>
        <div className="flex justify-start">
          <Skeleton className="h-12 w-2/3" />
        </div>
        <div className="flex justify-end">
          <Skeleton className="h-12 w-2/3" />
        </div>
      </div>

      <div className="flex gap-2">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-20" />
      </div>
    </div>
  );
}
