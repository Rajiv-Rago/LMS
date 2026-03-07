"use client";

import { use } from "react";
import CoursePreview from "@/app/(public)/courses/[id]/CoursePreview";

export default function CourseOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return <CoursePreview courseId={id} />;
}
