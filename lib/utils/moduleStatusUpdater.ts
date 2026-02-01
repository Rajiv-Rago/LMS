import { Module, Lesson } from "@/lib/models";

export type ModuleContentStatus = "skeleton" | "generating" | "completed" | "failed";

/**
 * Calculates the content status for a module based on its lessons' generation status.
 *
 * @param moduleId - The module ID to check
 * @returns The calculated status based on lesson states
 */
export async function calculateModuleStatus(
  moduleId: string
): Promise<ModuleContentStatus> {
  const [failedCount, skeletonCount, generatingCount] = await Promise.all([
    Lesson.countDocuments({ module: moduleId, generationStatus: "failed" }),
    Lesson.countDocuments({ module: moduleId, generationStatus: "skeleton" }),
    Lesson.countDocuments({ module: moduleId, generationStatus: "generating" }),
  ]);

  if (failedCount > 0) return "failed";
  if (generatingCount > 0) return "generating";
  if (skeletonCount > 0) return "skeleton";
  return "completed";
}

/**
 * Recalculates and updates the content status for a module based on its lessons.
 *
 * @param moduleId - The module ID to update
 * @returns The new status that was set
 */
export async function recalculateModuleStatus(
  moduleId: string
): Promise<ModuleContentStatus> {
  const status = await calculateModuleStatus(moduleId);

  await Module.findByIdAndUpdate(moduleId, { contentStatus: status });

  return status;
}

/**
 * Updates module status to completed only if all lessons are completed.
 * Use this after successfully completing a single lesson generation.
 *
 * @param moduleId - The module ID to check and potentially update
 * @returns true if the module was marked as completed, false otherwise
 */
export async function markModuleCompletedIfReady(
  moduleId: string
): Promise<boolean> {
  const incompleteCount = await Lesson.countDocuments({
    module: moduleId,
    generationStatus: { $ne: "completed" },
  });

  if (incompleteCount === 0) {
    await Module.findByIdAndUpdate(moduleId, { contentStatus: "completed" });
    return true;
  }

  return false;
}
