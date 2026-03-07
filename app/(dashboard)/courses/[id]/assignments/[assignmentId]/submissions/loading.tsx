import { Skeleton, SkeletonTable } from "@/components/ui/Skeleton";

export default function SubmissionsLoading() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Skeleton className="h-8 w-48" />
      <SkeletonTable rows={5} cols={4} />
    </div>
  );
}
