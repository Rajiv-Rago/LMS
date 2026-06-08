import type {
  GeneratedSyllabus,
  GeneratedLesson,
  GeneratedModule,
} from "@/lib/ai/services/syllabusGenerator";

export interface SampledLesson {
  position: "first" | "last";
  moduleTitle: string;
  lesson: GeneratedLesson;
  moduleIndex: number;
  lessonIndex: number;
}

/**
 * v1 sampling: first lesson of first module + last lesson of last module.
 * Catches intro quality and end-of-course laziness.
 */
export function sampleFirstAndLast(syllabus: GeneratedSyllabus): SampledLesson[] {
  if (!syllabus.modules?.length) return [];

  const modules = [...syllabus.modules].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const samples: SampledLesson[] = [];

  const firstModule = modules[0];
  const firstLesson = sortedLessons(firstModule)[0];
  if (firstLesson) {
    samples.push({
      position: "first",
      moduleTitle: firstModule.title,
      lesson: firstLesson,
      moduleIndex: 0,
      lessonIndex: 0,
    });
  }

  if (modules.length === 1 && sortedLessons(firstModule).length < 2) {
    return samples;
  }

  const lastModule = modules[modules.length - 1];
  const lastLessons = sortedLessons(lastModule);
  const lastLesson = lastLessons[lastLessons.length - 1];
  if (lastLesson && (modules.length > 1 || lastLesson !== firstLesson)) {
    samples.push({
      position: "last",
      moduleTitle: lastModule.title,
      lesson: lastLesson,
      moduleIndex: modules.length - 1,
      lessonIndex: lastLessons.length - 1,
    });
  }

  return samples;
}

function sortedLessons(courseModule: GeneratedModule): GeneratedLesson[] {
  return [...(courseModule.lessons ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}
