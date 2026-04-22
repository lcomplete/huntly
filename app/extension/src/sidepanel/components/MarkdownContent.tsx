import React, { type FC } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ErrorBoundary } from "./ErrorBoundary";

interface MarkdownContentProps {
  text: string;
  className?: string;
}

const MarkdownContentImpl: FC<MarkdownContentProps> = ({ text, className }) => (
  <ErrorBoundary
    fallback={
      <pre className="whitespace-pre-wrap text-xs text-[#5f5347]">{text}</pre>
    }
  >
    <div className={className}>
      <ReactMarkdown
        components={{
          a: ({ ...props }) => (
            <a {...props} rel="noopener noreferrer" target="_blank" />
          ),
        }}
        remarkPlugins={[remarkGfm]}
      >
        {text}
      </ReactMarkdown>
    </div>
  </ErrorBoundary>
);

export const MarkdownContent = React.memo(
  MarkdownContentImpl,
  (prev, next) => prev.text === next.text && prev.className === next.className
);
MarkdownContent.displayName = "MarkdownContent";
