"use client";

import MarkdownContent from "@/components/ui/MarkdownContent";

interface InstructionsViewerProps {
  instructions: string;
}

export default function InstructionsViewer({
  instructions,
}: InstructionsViewerProps) {
  return <MarkdownContent content={instructions} />;
}
