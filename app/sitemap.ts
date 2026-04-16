import { MetadataRoute } from "next";
import { dbConnect } from "@/lib/db";
import Course from "@/lib/models/Course";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kantigo.dev";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/explore`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/register`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  try {
    await dbConnect();
    const courses = await Course.find(
      { accessLevel: "published", deletedAt: null },
      { _id: 1, updatedAt: 1 }
    )
      .sort({ updatedAt: -1 })
      .limit(5000)
      .lean();

    const courseRoutes: MetadataRoute.Sitemap = courses.map((c) => ({
      url: `${SITE_URL}/courses/${c._id}`,
      lastModified: c.updatedAt || now,
      changeFrequency: "weekly",
      priority: 0.7,
    }));

    return [...staticRoutes, ...courseRoutes];
  } catch {
    return staticRoutes;
  }
}
