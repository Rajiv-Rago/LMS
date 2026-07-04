"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { PluggableList } from "unified";

const plugins: PluggableList = [remarkGfm];

// Shared with the lesson TOC so anchor ids match the rendered headings.
export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function nodeText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return nodeText(
      (node as React.ReactElement<{ children?: React.ReactNode }>).props
        .children
    );
  }
  return "";
}

// ponytail: duplicate heading texts produce duplicate ids; dedupe if it bites
const heading = (Tag: "h2" | "h3"): Components["h2"] =>
  function Heading({ children, ...props }) {
    return (
      <Tag id={slugify(nodeText(children))} className="scroll-mt-20" {...props}>
        {children}
      </Tag>
    );
  };

const components: Components = {
  h2: heading("h2"),
  h3: heading("h3"),
  code({ className: codeClassName, children, ...props }) {
    const isBlock = /language-/.test(codeClassName || "");
    if (isBlock) {
      return (
        <code className={codeClassName} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-sm font-mono"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre({ children }) {
    return (
      <pre className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4 overflow-x-auto text-sm text-zinc-800 dark:text-zinc-100">
        {children}
      </pre>
    );
  },
};

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export default function MarkdownContent({
  content,
  className = "",
}: MarkdownContentProps) {
  return (
    <div className={`prose dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown remarkPlugins={plugins} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
