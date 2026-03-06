import { ImageResponse } from "next/og";
import { dbConnect } from "@/lib/db";
import Course from "@/lib/models/Course";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let title = "Kantigo";

  try {
    await dbConnect();
    const course = await Course.findById(id).select("title");
    if (course) {
      title = course.title;
    }
  } catch {
    // Use fallback title
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
          padding: "60px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            maxWidth: "900px",
          }}
        >
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: "white",
              lineHeight: 1.2,
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 28,
              color: "#c7d2fe",
              marginTop: 24,
            }}
          >
            kantigo.dev
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
