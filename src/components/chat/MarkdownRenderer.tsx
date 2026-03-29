"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface MarkdownRendererProps {
  content: string;
}

function CodeBlock({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const lang = match ? match[1] : "";
  const code = String(children).replace(/\n$/, "");

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-3">
      <div className="flex items-center justify-between bg-white/[0.08] rounded-t-lg px-4 py-2 border border-white/[0.06] border-b-0">
        <span className="text-xs text-slate-400 font-mono">{lang || "code"}</span>
        <button
          onClick={handleCopy}
          className="text-slate-400 hover:text-white transition-colors p-1"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      <pre className="bg-white/[0.04] rounded-b-lg px-4 py-3 overflow-x-auto border border-white/[0.06] border-t-0">
        <code className="text-sm text-slate-200 font-mono leading-relaxed">{code}</code>
      </pre>
    </div>
  );
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children, ...props }) {
          const isInline = !className && typeof children === "string" && !children.includes("\n");
          if (isInline) {
            return (
              <code className="bg-white/[0.08] text-purple-300 px-1.5 py-0.5 rounded text-[13px] font-mono" {...props}>
                {children}
              </code>
            );
          }
          return <CodeBlock className={className}>{children}</CodeBlock>;
        },
        h1: ({ children }) => <h1 className="text-xl font-bold text-white mt-4 mb-2">{children}</h1>,
        h2: ({ children }) => <h2 className="text-lg font-semibold text-white mt-4 mb-2">{children}</h2>,
        h3: ({ children }) => <h3 className="text-base font-semibold text-white mt-3 mb-1.5">{children}</h3>,
        p: ({ children }) => <p className="text-sm text-slate-200 leading-relaxed mb-2">{children}</p>,
        ul: ({ children }) => <ul className="list-disc list-inside text-sm text-slate-200 mb-2 space-y-1 ml-2">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside text-sm text-slate-200 mb-2 space-y-1 ml-2">{children}</ol>,
        li: ({ children }) => <li className="text-sm text-slate-200 leading-relaxed">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
        em: ({ children }) => <em className="italic text-slate-300">{children}</em>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-purple-500/50 pl-4 my-2 text-slate-300 italic">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-3">
            <table className="min-w-full border border-white/[0.08] rounded-lg text-sm">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="bg-white/[0.06] px-4 py-2 text-left text-slate-300 font-medium border-b border-white/[0.08]">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-4 py-2 text-slate-200 border-b border-white/[0.06]">{children}</td>
        ),
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 underline">
            {children}
          </a>
        ),
        hr: () => <hr className="border-white/[0.08] my-4" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
