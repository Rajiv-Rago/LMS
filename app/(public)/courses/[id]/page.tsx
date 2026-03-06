import { Metadata } from "next";
import { dbConnect } from "@/lib/db";
import Course from "@/lib/models/Course";
import CoursePreview from "./CoursePreview";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  try {
    await dbConnect();
    const course = await Course.findById(id).populate("instructor", "name");

    if (!course || course.accessLevel === "restricted") {
      return { title: "Course Not Found" };
    }

    const title = `${course.title} | Kantigo`;
    const description = course.description.slice(0, 150);

    return {
      title,
      description,
      openGraph: {
        title: course.title,
        description,
        type: "website",
      },
    };
  } catch {
    return { title: "Course Not Found" };
  }
}

export default async function CourseDetailPage({ params }: Props) {
  const { id } = await params;

  return <CoursePreview courseId={id} />;
}
