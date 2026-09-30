"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Root, RootContent, Link, Text } from "mdast";
import type { PluggableList } from "unified";

interface CitationSource { title: string; url: string }

function citationLinks(sources: CitationSource[]) {
  return () => (tree: Root) => {
    function walk(node: Root | RootContent) {
      if (node.type === "link" || !("children" in node)) return;
      const children: RootContent[] = [];
      for (const child of node.children) {
        if (child.type !== "text") { walk(child); children.push(child); continue; }
        let offset = 0;
        for (const match of child.value.matchAll(/\[(\d+)\]/g)) {
          const source = sources[Number(match[1]) - 1];
          if (!source || !/^https?:\/\//.test(source.url)) continue;
          const index = match.index!;
          if (index > offset) children.push({ type: "text", value: child.value.slice(offset, index) } as Text);
          children.push({ type: "link", url: source.url, children: [{ type: "text", value: match[1] }] } as Link);
          offset = index + match[0].length;
        }
        if (offset < child.value.length) children.push({ type: "text", value: child.value.slice(offset) } as Text);
      }
      node.children = children as typeof node.children;
    }
    walk(tree);
  };
}

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
  a({ children, href, title }) {
    const label = nodeText(children);
    if (/^\d+$/.test(label)) return <sup><a href={href} title={title} aria-label={`Source ${label}`} target="_blank" rel="noopener noreferrer">{label}</a></sup>;
    return <a href={href} title={title}>{children}</a>;
  },
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
  sources?: CitationSource[];
}

export default function MarkdownContent({
  content,
  className = "",
  sources = [],
}: MarkdownContentProps) {
  const plugins: PluggableList = [remarkGfm, citationLinks(sources)];
  return (
    <div className={`prose dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown remarkPlugins={plugins} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
