"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { usePathContext } from "@/context/PathContext";
import PathSummary from "@/components/path/PathSummary";
import Roadmap from "@/components/path/Roadmap";
import ModuleCard from "@/components/path/ModuleCard";
import AlternativePaths from "@/components/path/AlternativePaths";
import StudySchedule from "@/components/path/StudySchedule";
import SupplementaryResources from "@/components/path/SupplementaryResources";

function PathContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const {
    currentPath,
    currentProgress,
    paths,
    setCurrentPath,
    markVideoStatus,
    updateNotes,
    toggleCheck,
    switchVariant,
    completeProject,
    removePath,
  } = usePathContext();

  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);

  // Load path from URL param or use most recent
  useEffect(() => {
    const id = searchParams.get("id");
    if (id) {
      setCurrentPath(id);
    } else if (paths.length > 0) {
      setCurrentPath(paths[0].id);
    }
  }, [searchParams, paths, setCurrentPath]);

  // Set first incomplete module as active
  useEffect(() => {
    if (currentPath && currentProgress && !activeModuleId) {
      const firstIncomplete = currentPath.modules.find((m) =>
        m.videos.some(
          (v) =>
            currentProgress.videoProgress[v.videoId]?.status !== "watched"
        )
      );
      setActiveModuleId(firstIncomplete?.id || currentPath.modules[0]?.id || null);
    }
  }, [currentPath, currentProgress, activeModuleId]);

  if (!currentPath || !currentProgress) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 text-center">
        <div className="text-6xl mb-4">&#127891;</div>
        <h2 className="text-2xl font-bold text-white mb-2">
          No learning path yet
        </h2>
        <p className="text-yt-gray-2 mb-6">
          Create your first personalized YouTube learning path
        </p>
        <button
          onClick={() => router.push("/")}
          className="px-6 py-3 bg-yt-red text-white font-medium rounded-lg hover:bg-yt-red-hover transition-colors"
        >
          Create Learning Path
        </button>
      </div>
    );
  }

  // Filter modules by active variant
  const variantModuleIds =
    currentPath.variants.find(
      (v) => v.name === currentProgress.activeVariant
    )?.moduleIds || currentPath.modules.map((m) => m.id);

  const visibleModules = currentPath.modules.filter((m) =>
    variantModuleIds.includes(m.id)
  );

  const handleModuleClick = (moduleId: string) => {
    setActiveModuleId(moduleId);
    document.getElementById(`module-${moduleId}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Path selector if multiple paths */}
      {paths.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {paths.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setCurrentPath(p.id);
                setActiveModuleId(null);
                router.push(`/path?id=${p.id}`);
              }}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                p.id === currentPath.id
                  ? "bg-yt-red text-white"
                  : "bg-yt-dark-3 text-yt-gray-1 hover:bg-yt-dark-4"
              }`}
            >
              {p.summary.topic}
            </button>
          ))}
        </div>
      )}

      {/* Summary */}
      <PathSummary path={currentPath} progress={currentProgress} visibleModules={visibleModules} />

      {/* Roadmap */}
      <Roadmap
        modules={visibleModules}
        progress={currentProgress}
        activeModuleId={activeModuleId}
        onModuleClick={handleModuleClick}
      />

      {/* Variant switcher + Schedule toggle */}
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1">
          {/* Alternative paths */}
          {currentPath.variants.length > 0 && (
            <AlternativePaths
              variants={currentPath.variants}
              modules={currentPath.modules}
              activeVariant={currentProgress.activeVariant}
              onSwitch={switchVariant}
            />
          )}

          {/* Modules */}
          <div className="space-y-4">
            {visibleModules.map((mod) => (
              <ModuleCard
                key={mod.id}
                module={mod}
                progress={currentProgress}
                isActive={mod.id === activeModuleId}
                onVideoStatusChange={markVideoStatus}
                onNotesChange={updateNotes}
                onToggleCheck={toggleCheck}
                onProjectComplete={completeProject}
              />
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:w-80 space-y-6">
          {/* Toggle schedule */}
          <button
            onClick={() => setShowSchedule(!showSchedule)}
            className="w-full text-left p-4 bg-yt-dark-2 rounded-xl border border-yt-dark-4 hover:border-yt-gray-3 transition-colors lg:hidden"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white">
                Study Schedule
              </span>
              <svg
                className={`w-4 h-4 text-yt-gray-2 transition-transform ${
                  showSchedule ? "rotate-180" : ""
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </button>

          <div className={`${showSchedule ? "block" : "hidden"} lg:block`}>
            <StudySchedule path={currentPath} progress={currentProgress} />
          </div>

          <SupplementaryResources
            resources={currentPath.supplementaryResources}
          />

          {/* Danger zone */}
          <div className="bg-yt-dark-2 rounded-xl border border-yt-dark-4 p-4">
            <button
              onClick={() => {
                if (
                  confirm(
                    `Delete the "${currentPath.summary.topic}" learning path? This cannot be undone.`
                  )
                ) {
                  removePath(currentPath.id);
                  router.push("/");
                }
              }}
              className="text-xs text-yt-gray-3 hover:text-red-400 transition-colors"
            >
              Delete this learning path
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PathPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-6xl mx-auto px-4 py-12 text-center">
          <div className="w-10 h-10 mx-auto border-4 border-yt-dark-4 border-t-yt-red rounded-full animate-spin" />
        </div>
      }
    >
      <PathContent />
    </Suspense>
  );
}
