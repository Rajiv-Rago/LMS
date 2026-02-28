import { LearningPath, PathProgress, StoredData, VideoProgress } from "./types";

const STORAGE_KEY = "yt-learning-paths";

function getStored(): StoredData {
  if (typeof window === "undefined") return { paths: {}, progress: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { paths: {}, progress: {} };
    return JSON.parse(raw);
  } catch {
    return { paths: {}, progress: {} };
  }
}

function save(data: StoredData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function savePath(path: LearningPath) {
  const data = getStored();
  data.paths[path.id] = path;
  // Initialize progress
  if (!data.progress[path.id]) {
    const videoProgress: Record<string, VideoProgress> = {};
    for (const mod of path.modules) {
      for (const vid of mod.videos) {
        videoProgress[vid.videoId] = {
          videoId: vid.videoId,
          status: "unwatched",
          notes: "",
          timestamps: [],
        };
      }
    }
    data.progress[path.id] = {
      pathId: path.id,
      activeVariant: "standard",
      videoProgress,
      moduleChecks: {},
      projectsCompleted: [],
      startedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      streakDays: 0,
      lastStreakDate: "",
    };
  }
  save(data);
}

export function getPath(pathId: string): LearningPath | null {
  return getStored().paths[pathId] || null;
}

export function getAllPaths(): LearningPath[] {
  const data = getStored();
  return Object.values(data.paths).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getProgress(pathId: string): PathProgress | null {
  return getStored().progress[pathId] || null;
}

export function updateVideoStatus(
  pathId: string,
  videoId: string,
  status: VideoProgress["status"]
) {
  const data = getStored();
  const progress = data.progress[pathId];
  if (!progress) return;

  if (!progress.videoProgress[videoId]) {
    progress.videoProgress[videoId] = {
      videoId,
      status: "unwatched",
      notes: "",
      timestamps: [],
    };
  }

  progress.videoProgress[videoId].status = status;
  if (status === "watched") {
    progress.videoProgress[videoId].watchedAt = new Date().toISOString();
  }

  // Update streak
  const today = new Date().toISOString().split("T")[0];
  if (progress.lastStreakDate !== today) {
    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .split("T")[0];
    if (progress.lastStreakDate === yesterday) {
      progress.streakDays += 1;
    } else {
      progress.streakDays = 1;
    }
    progress.lastStreakDate = today;
  }

  progress.lastActivityAt = new Date().toISOString();
  save(data);
}

export function updateVideoNotes(
  pathId: string,
  videoId: string,
  notes: string
) {
  const data = getStored();
  const progress = data.progress[pathId];
  if (!progress || !progress.videoProgress[videoId]) return;
  progress.videoProgress[videoId].notes = notes;
  save(data);
}

export function addVideoTimestamp(
  pathId: string,
  videoId: string,
  time: string,
  note: string
) {
  const data = getStored();
  const progress = data.progress[pathId];
  if (!progress || !progress.videoProgress[videoId]) return;
  progress.videoProgress[videoId].timestamps.push({ time, note });
  save(data);
}

export function toggleModuleCheck(
  pathId: string,
  moduleId: string,
  index: number
) {
  const data = getStored();
  const progress = data.progress[pathId];
  if (!progress) return;
  if (!progress.moduleChecks[moduleId]) {
    progress.moduleChecks[moduleId] = [];
  }
  progress.moduleChecks[moduleId][index] =
    !progress.moduleChecks[moduleId][index];
  save(data);
}

export function setActiveVariant(
  pathId: string,
  variant: "fast_track" | "standard" | "deep_dive"
) {
  const data = getStored();
  const progress = data.progress[pathId];
  if (!progress) return;
  progress.activeVariant = variant;
  save(data);
}

export function markProjectComplete(pathId: string, projectTitle: string) {
  const data = getStored();
  const progress = data.progress[pathId];
  if (!progress) return;
  if (!progress.projectsCompleted.includes(projectTitle)) {
    progress.projectsCompleted.push(projectTitle);
  }
  save(data);
}

export function deletePath(pathId: string) {
  const data = getStored();
  delete data.paths[pathId];
  delete data.progress[pathId];
  save(data);
}
