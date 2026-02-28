"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  LearningPath,
  PathProgress,
  VideoProgress,
  PathFormData,
} from "@/lib/types";
import * as storage from "@/lib/storage";

interface PathContextType {
  // All saved paths
  paths: LearningPath[];
  // Currently viewed path
  currentPath: LearningPath | null;
  currentProgress: PathProgress | null;
  // Loading state
  isGenerating: boolean;
  generationError: string | null;
  // Actions
  generatePath: (formData: PathFormData) => Promise<void>;
  setCurrentPath: (pathId: string) => void;
  markVideoStatus: (videoId: string, status: VideoProgress["status"]) => void;
  updateNotes: (videoId: string, notes: string) => void;
  addTimestamp: (videoId: string, time: string, note: string) => void;
  toggleCheck: (moduleId: string, index: number) => void;
  switchVariant: (variant: "fast_track" | "standard" | "deep_dive") => void;
  completeProject: (projectTitle: string) => void;
  removePath: (pathId: string) => void;
  refreshPaths: () => void;
}

const PathContext = createContext<PathContextType | null>(null);

export function PathProvider({ children }: { children: React.ReactNode }) {
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [currentPath, setCurrentPathState] = useState<LearningPath | null>(null);
  const [currentProgress, setCurrentProgress] = useState<PathProgress | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const refreshPaths = useCallback(() => {
    setPaths(storage.getAllPaths());
  }, []);

  useEffect(() => {
    refreshPaths();
  }, [refreshPaths]);

  const setCurrentPath = useCallback((pathId: string) => {
    const path = storage.getPath(pathId);
    const progress = storage.getProgress(pathId);
    setCurrentPathState(path);
    setCurrentProgress(progress);
  }, []);

  const generatePath = useCallback(async (formData: PathFormData) => {
    setIsGenerating(true);
    setGenerationError(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate learning path");
      }

      const path: LearningPath = await res.json();
      storage.savePath(path);
      setCurrentPathState(path);
      setCurrentProgress(storage.getProgress(path.id));
      refreshPaths();
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : "Unknown error");
      throw err;
    } finally {
      setIsGenerating(false);
    }
  }, [refreshPaths]);

  const markVideoStatus = useCallback(
    (videoId: string, status: VideoProgress["status"]) => {
      if (!currentPath) return;
      storage.updateVideoStatus(currentPath.id, videoId, status);
      setCurrentProgress(storage.getProgress(currentPath.id));
    },
    [currentPath]
  );

  const updateNotes = useCallback(
    (videoId: string, notes: string) => {
      if (!currentPath) return;
      storage.updateVideoNotes(currentPath.id, videoId, notes);
      setCurrentProgress(storage.getProgress(currentPath.id));
    },
    [currentPath]
  );

  const addTimestamp = useCallback(
    (videoId: string, time: string, note: string) => {
      if (!currentPath) return;
      storage.addVideoTimestamp(currentPath.id, videoId, time, note);
      setCurrentProgress(storage.getProgress(currentPath.id));
    },
    [currentPath]
  );

  const toggleCheck = useCallback(
    (moduleId: string, index: number) => {
      if (!currentPath) return;
      storage.toggleModuleCheck(currentPath.id, moduleId, index);
      setCurrentProgress(storage.getProgress(currentPath.id));
    },
    [currentPath]
  );

  const switchVariant = useCallback(
    (variant: "fast_track" | "standard" | "deep_dive") => {
      if (!currentPath) return;
      storage.setActiveVariant(currentPath.id, variant);
      setCurrentProgress(storage.getProgress(currentPath.id));
    },
    [currentPath]
  );

  const completeProject = useCallback(
    (projectTitle: string) => {
      if (!currentPath) return;
      storage.markProjectComplete(currentPath.id, projectTitle);
      setCurrentProgress(storage.getProgress(currentPath.id));
    },
    [currentPath]
  );

  const removePath = useCallback(
    (pathId: string) => {
      storage.deletePath(pathId);
      if (currentPath?.id === pathId) {
        setCurrentPathState(null);
        setCurrentProgress(null);
      }
      refreshPaths();
    },
    [currentPath, refreshPaths]
  );

  return (
    <PathContext.Provider
      value={{
        paths,
        currentPath,
        currentProgress,
        isGenerating,
        generationError,
        generatePath,
        setCurrentPath,
        markVideoStatus,
        updateNotes,
        addTimestamp,
        toggleCheck,
        switchVariant,
        completeProject,
        removePath,
        refreshPaths,
      }}
    >
      {children}
    </PathContext.Provider>
  );
}

export function usePathContext() {
  const ctx = useContext(PathContext);
  if (!ctx) throw new Error("usePathContext must be used within PathProvider");
  return ctx;
}
