import { CourseTutorProvider } from '@/components/tutor/FloatingTutor';

export default async function CourseLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CourseTutorProvider key={id} courseId={id}>{children}</CourseTutorProvider>;
}
