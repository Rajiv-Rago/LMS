import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";

export default function AssignmentDetailLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-32" />
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
        <SkeletonText lines={5} />
      </div>
      <Skeleton className="h-10 w-32" />
    </div>
  );
}
