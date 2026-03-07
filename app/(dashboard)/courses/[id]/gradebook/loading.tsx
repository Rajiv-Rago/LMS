import { Skeleton, SkeletonTable } from "@/components/ui/Skeleton";

export default function GradebookLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40" />
      <SkeletonTable rows={8} cols={5} />
    </div>
  );
}
