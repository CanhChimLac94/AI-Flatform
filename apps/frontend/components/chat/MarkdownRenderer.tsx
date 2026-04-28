"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import type { CSSProperties } from "react";
import type { Citation } from "@/lib/types";

interface MarkdownRendererProps {
  content: string;
  citations?: Citation[];
  onCitationClick?: (c: Citation) => void;
}

// Replace [N] citation markers with a placeholder the markdown parser won't mangle
function injectCitationPlaceholders(text: string): string {
  return text.replace(/\[(\d+)\]/g, "‹$1›");
}

// Split plain text nodes on citation placeholders and render interactive buttons
function renderTextWithCitations(
  text: string,
  citations: Citation[],
  onCitationClick: (c: Citation) => void
): React.ReactNode {
  const parts = text.split(/(‹\d+›)/g);
  return parts.map((part, i) => {
    const match = part.match(/^‹(\d+)›$/);
    if (match) {
      const num = parseInt(match[1], 10);
      const citation = citations.find((c) => c.id === num);
      if (citation) {
        return (
          <button
            key={i}
            onClick={() => onCitationClick(citation)}
            className="inline-flex items-center justify-center w-5 h-5 text-xs rounded-full bg-accent text-white font-bold hover:bg-accent-hover transition-colors mx-0.5 align-middle"
          >
            {num}
          </button>
        );
      }
    }
    return part;
  });
}

export function MarkdownRenderer({
  content,
  citations = [],
  onCitationClick,
}: MarkdownRendererProps) {
  const hasCitations = citations.length > 0 && onCitationClick;
  const processedContent = hasCitations
    ? injectCitationPlaceholders(content)
    : content;

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Code blocks with syntax highlighting
        code({ node: _node, className, children }) {
          const match = /language-(\w+)/.exec(className ?? "");
          const isBlock = !!match || String(children).includes("\n");

          if (isBlock) {
            const lang = match?.[1] ?? "text";
            return (
              <div className="my-3 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between bg-gray-800 px-4 py-1.5 text-xs text-gray-400 font-mono">
                  <span>{lang}</span>
                </div>
                <SyntaxHighlighter
                  style={oneDark as { [key: string]: CSSProperties }}
                  language={lang}
                  PreTag="div"
                  customStyle={{
                    margin: 0,
                    borderRadius: 0,
                    fontSize: "0.8125rem",
                    lineHeight: "1.6",
                  }}
                >
                  {String(children).replace(/\n$/, "")}
                </SyntaxHighlighter>
              </div>
            );
          }
          return (
            <code className="bg-gray-700/70 text-pink-300 px-1.5 py-0.5 rounded text-[0.8125em] font-mono">
              {children}
            </code>
          );
        },

        // Paragraphs — inject citations into text nodes
        p({ children }) {
          if (!hasCitations) return <p className="mb-3 last:mb-0">{children}</p>;
          const processed = processChildren(children, citations, onCitationClick!);
          return <p className="mb-3 last:mb-0">{processed}</p>;
        },

        // Headings
        h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-2 text-gray-100">{children}</h1>,
        h2: ({ children }) => <h2 className="text-lg font-semibold mt-4 mb-2 text-gray-100">{children}</h2>,
        h3: ({ children }) => <h3 className="text-base font-semibold mt-3 mb-1.5 text-gray-200">{children}</h3>,
        h4: ({ children }) => <h4 className="text-sm font-semibold mt-2 mb-1 text-gray-200">{children}</h4>,

        // Lists
        ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
        li: ({ children }) => <li className="text-gray-100">{children}</li>,

        // Blockquote
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-accent/60 pl-4 py-1 my-3 text-gray-400 italic bg-gray-800/40 rounded-r">
            {children}
          </blockquote>
        ),

        // Tables (GFM)
        table: ({ children }) => (
          <div className="overflow-x-auto my-3">
            <table className="min-w-full border border-gray-600 rounded-lg text-sm">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-gray-800">{children}</thead>,
        tbody: ({ children }) => <tbody className="divide-y divide-gray-700">{children}</tbody>,
        tr: ({ children }) => <tr className="even:bg-gray-800/30">{children}</tr>,
        th: ({ children }) => (
          <th className="px-3 py-2 text-left font-semibold text-gray-300 border-b border-gray-600">
            {children}
          </th>
        ),
        td: ({ children }) => <td className="px-3 py-2 text-gray-200">{children}</td>,

        // Horizontal rule
        hr: () => <hr className="border-gray-600 my-4" />,

        // Links
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 underline hover:text-indigo-300 transition-colors"
          >
            {children}
          </a>
        ),

        // Strong / em
        strong: ({ children }) => <strong className="font-semibold text-gray-100">{children}</strong>,
        em: ({ children }) => <em className="italic text-gray-300">{children}</em>,
      }}
    >
      {processedContent}
    </ReactMarkdown>
  );
}

// Walk React children and inject citation buttons into text strings
function processChildren(
  children: React.ReactNode,
  citations: Citation[],
  onCitationClick: (c: Citation) => void
): React.ReactNode {
  if (typeof children === "string") {
    return renderTextWithCitations(children, citations, onCitationClick);
  }
  if (Array.isArray(children)) {
    return children.map((child, i) => {
      if (typeof child === "string") {
        const parts = renderTextWithCitations(child, citations, onCitationClick);
        return Array.isArray(parts) ? parts.map((p, j) => <span key={`${i}-${j}`}>{p}</span>) : parts;
      }
      return child;
    });
  }
  return children;
}
