import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";

export default function CoursePreviewLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-4 w-32" />
      <SkeletonText lines={3} />
      <Skeleton className="h-12 w-40" />
      <Skeleton className="h-6 w-32" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
