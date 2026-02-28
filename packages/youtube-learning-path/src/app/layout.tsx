import type { Metadata } from "next";
import "./globals.css";
import { PathProvider } from "@/context/PathContext";

export const metadata: Metadata = {
  title: "YouTube Learning Path Builder",
  description:
    "Build structured, AI-powered learning paths from YouTube videos. Tell us what you want to learn and we'll create a personalized curriculum.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-yt-black">
        <PathProvider>
          {/* Header */}
          <header className="sticky top-0 z-50 bg-yt-dark-1/95 backdrop-blur-sm border-b border-yt-dark-4">
            <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
              <a href="/" className="flex items-center gap-2">
                {/* YouTube-style logo */}
                <div className="w-8 h-6 bg-yt-red rounded-md flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-white"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <span className="text-white font-bold text-lg tracking-tight">
                  LearnPath
                </span>
              </a>
              <nav className="flex items-center gap-4">
                <a
                  href="/"
                  className="text-sm text-yt-gray-1 hover:text-white transition-colors"
                >
                  New Path
                </a>
              </nav>
            </div>
          </header>

          <main>{children}</main>
        </PathProvider>
      </body>
    </html>
  );
}
