"use client";

interface InstructionsViewerProps {
  instructions: string;
}

// Simple markdown-like renderer for project instructions
// For production, consider using a proper markdown library like react-markdown
export default function InstructionsViewer({
  instructions,
}: InstructionsViewerProps) {
  // Process markdown-like syntax
  const processText = (text: string): React.ReactNode[] => {
    const lines = text.split("\n");
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeContent: string[] = [];
    let listItems: string[] = [];

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`list-${elements.length}`} className="list-disc list-inside space-y-1 my-2">
            {listItems.map((item, i) => (
              <li key={i}>{processInline(item)}</li>
            ))}
          </ul>
        );
        listItems = [];
      }
    };

    lines.forEach((line, index) => {
      // Code block handling
      if (line.startsWith("```")) {
        if (inCodeBlock) {
          elements.push(
            <pre
              key={`code-${index}`}
              className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4 my-4 overflow-x-auto text-sm font-mono"
            >
              <code>{codeContent.join("\n")}</code>
            </pre>
          );
          codeContent = [];
          inCodeBlock = false;
        } else {
          flushList();
          inCodeBlock = true;
        }
        return;
      }

      if (inCodeBlock) {
        codeContent.push(line);
        return;
      }

      // Empty line
      if (!line.trim()) {
        flushList();
        elements.push(<div key={`br-${index}`} className="h-4" />);
        return;
      }

      // Headers
      if (line.startsWith("### ")) {
        flushList();
        elements.push(
          <h3
            key={`h3-${index}`}
            className="text-lg font-semibold text-zinc-900 dark:text-white mt-6 mb-2"
          >
            {processInline(line.slice(4))}
          </h3>
        );
        return;
      }

      if (line.startsWith("## ")) {
        flushList();
        elements.push(
          <h2
            key={`h2-${index}`}
            className="text-xl font-semibold text-zinc-900 dark:text-white mt-6 mb-3"
          >
            {processInline(line.slice(3))}
          </h2>
        );
        return;
      }

      if (line.startsWith("# ")) {
        flushList();
        elements.push(
          <h1
            key={`h1-${index}`}
            className="text-2xl font-bold text-zinc-900 dark:text-white mt-6 mb-4"
          >
            {processInline(line.slice(2))}
          </h1>
        );
        return;
      }

      // List items
      if (line.match(/^[-*]\s/)) {
        listItems.push(line.slice(2));
        return;
      }

      if (line.match(/^\d+\.\s/)) {
        listItems.push(line.replace(/^\d+\.\s/, ""));
        return;
      }

      // Blockquote
      if (line.startsWith("> ")) {
        flushList();
        elements.push(
          <blockquote
            key={`quote-${index}`}
            className="border-l-4 border-zinc-300 dark:border-zinc-600 pl-4 my-4 italic text-zinc-600 dark:text-zinc-400"
          >
            {processInline(line.slice(2))}
          </blockquote>
        );
        return;
      }

      // Horizontal rule
      if (line.match(/^---+$/) || line.match(/^\*\*\*+$/)) {
        flushList();
        elements.push(
          <hr
            key={`hr-${index}`}
            className="my-6 border-zinc-200 dark:border-zinc-700"
          />
        );
        return;
      }

      // Regular paragraph
      flushList();
      elements.push(
        <p
          key={`p-${index}`}
          className="text-zinc-700 dark:text-zinc-300 my-2"
        >
          {processInline(line)}
        </p>
      );
    });

    // Flush any remaining list
    flushList();

    return elements;
  };

  // Process inline formatting (bold, italic, code, links)
  const processInline = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
      // Bold **text**
      const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
      if (boldMatch) {
        parts.push(
          <strong key={key++} className="font-semibold">
            {boldMatch[1]}
          </strong>
        );
        remaining = remaining.slice(boldMatch[0].length);
        continue;
      }

      // Italic *text*
      const italicMatch = remaining.match(/^\*(.+?)\*/);
      if (italicMatch) {
        parts.push(<em key={key++}>{italicMatch[1]}</em>);
        remaining = remaining.slice(italicMatch[0].length);
        continue;
      }

      // Inline code `code`
      const codeMatch = remaining.match(/^`(.+?)`/);
      if (codeMatch) {
        parts.push(
          <code
            key={key++}
            className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-sm font-mono"
          >
            {codeMatch[1]}
          </code>
        );
        remaining = remaining.slice(codeMatch[0].length);
        continue;
      }

      // Links [text](url)
      const linkMatch = remaining.match(/^\[(.+?)\]\((.+?)\)/);
      if (linkMatch) {
        parts.push(
          <a
            key={key++}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:text-indigo-500 underline"
          >
            {linkMatch[1]}
          </a>
        );
        remaining = remaining.slice(linkMatch[0].length);
        continue;
      }

      // Plain text (consume one character at a time until special syntax found)
      const nextSpecial = remaining.search(/[\*`\[]/);
      if (nextSpecial === -1) {
        parts.push(remaining);
        break;
      } else if (nextSpecial === 0) {
        // Special char that didn't match a pattern, treat as plain text
        parts.push(remaining[0]);
        remaining = remaining.slice(1);
      } else {
        parts.push(remaining.slice(0, nextSpecial));
        remaining = remaining.slice(nextSpecial);
      }
    }

    return parts.length === 1 ? parts[0] : <>{parts}</>;
  };

  return (
    <div className="prose dark:prose-invert max-w-none">
      {processText(instructions)}
    </div>
  );
}
