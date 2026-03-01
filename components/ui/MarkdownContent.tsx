"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { PluggableList } from "unified";

const plugins: PluggableList = [remarkGfm];

const components: Components = {
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
      <pre className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4 overflow-x-auto text-sm">
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
