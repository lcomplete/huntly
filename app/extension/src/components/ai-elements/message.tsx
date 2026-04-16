/**
 * Message component — renders user and assistant messages with markdown support.
 * Source: https://github.com/vercel/ai-elements/blob/main/packages/elements/src/message.tsx
 *
 * Note: Uses react-markdown instead of streamdown (streamdown requires Next.js/RSC).
 * The component API matches the source exactly.
 */

import { Button } from "../ui/button";
import {
  ButtonGroup,
  ButtonGroupText,
} from "../ui/button-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { cn } from "../../lib/utils";
import type { UIMessage } from "ai";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { ComponentProps, HTMLAttributes, ReactElement } from "react";
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ---------------------------------------------------------------------------
// Message Root
// ---------------------------------------------------------------------------

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage["role"];
};

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      "group flex w-full max-w-[95%] flex-col gap-2",
      from === "user" ? "is-user ml-auto justify-end" : "is-assistant",
      className
    )}
    {...props}
  />
);

// ---------------------------------------------------------------------------
// Message Content
// ---------------------------------------------------------------------------

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageContent = ({
  children,
  className,
  ...props
}: MessageContentProps) => (
  <div
    className={cn(
      "is-user:dark flex w-fit min-w-0 max-w-full flex-col gap-2 overflow-hidden text-sm",
      "group-[.is-user]:ml-auto group-[.is-user]:rounded-lg group-[.is-user]:bg-secondary group-[.is-user]:px-4 group-[.is-user]:py-3 group-[.is-user]:text-foreground",
      "group-[.is-assistant]:text-foreground",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

// ---------------------------------------------------------------------------
// Message Actions
// ---------------------------------------------------------------------------

export type MessageActionsProps = ComponentProps<"div">;

export const MessageActions = ({
  className,
  children,
  ...props
}: MessageActionsProps) => (
  <div className={cn("flex items-center gap-1", className)} {...props}>
    {children}
  </div>
);

// ---------------------------------------------------------------------------
// Message Action
// ---------------------------------------------------------------------------

export type MessageActionProps = ComponentProps<typeof Button> & {
  tooltip?: string;
  label?: string;
};

export const MessageAction = ({
  tooltip,
  children,
  label,
  variant = "ghost",
  size = "icon-sm",
  ...props
}: MessageActionProps) => {
  const button = (
    <Button size={size} type="button" variant={variant} {...props}>
      {children}
      <span className="sr-only">{label || tooltip}</span>
    </Button>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
};

// ---------------------------------------------------------------------------
// Message Branch
// ---------------------------------------------------------------------------

interface MessageBranchContextType {
  currentBranch: number;
  totalBranches: number;
  goToPrevious: () => void;
  goToNext: () => void;
  branches: ReactElement[];
  setBranches: (branches: ReactElement[]) => void;
}

const MessageBranchContext = createContext<MessageBranchContextType | null>(
  null
);

const useMessageBranch = () => {
  const context = useContext(MessageBranchContext);

  if (!context) {
    throw new Error(
      "MessageBranch components must be used within MessageBranch"
    );
  }

  return context;
};

export type MessageBranchProps = HTMLAttributes<HTMLDivElement> & {
  defaultBranch?: number;
  onBranchChange?: (branchIndex: number) => void;
};

export const MessageBranch = ({
  defaultBranch = 0,
  onBranchChange,
  className,
  ...props
}: MessageBranchProps) => {
  const [currentBranch, setCurrentBranch] = useState(defaultBranch);
  const [branches, setBranches] = useState<ReactElement[]>([]);

  const handleBranchChange = useCallback(
    (newBranch: number) => {
      setCurrentBranch(newBranch);
      onBranchChange?.(newBranch);
    },
    [onBranchChange]
  );

  const goToPrevious = useCallback(() => {
    const newBranch =
      currentBranch > 0 ? currentBranch - 1 : branches.length - 1;
    handleBranchChange(newBranch);
  }, [currentBranch, branches.length, handleBranchChange]);

  const goToNext = useCallback(() => {
    const newBranch =
      currentBranch < branches.length - 1 ? currentBranch + 1 : 0;
    handleBranchChange(newBranch);
  }, [currentBranch, branches.length, handleBranchChange]);

  const contextValue = useMemo<MessageBranchContextType>(
    () => ({
      branches,
      currentBranch,
      goToNext,
      goToPrevious,
      setBranches,
      totalBranches: branches.length,
    }),
    [branches, currentBranch, goToNext, goToPrevious]
  );

  return (
    <MessageBranchContext.Provider value={contextValue}>
      <div
        className={cn("grid w-full gap-2 [&>div]:pb-0", className)}
        {...props}
      />
    </MessageBranchContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Message Branch Content
// ---------------------------------------------------------------------------

export type MessageBranchContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageBranchContent = ({
  children,
  ...props
}: MessageBranchContentProps) => {
  const { currentBranch, setBranches, branches } = useMessageBranch();
  const childrenArray = useMemo(
    () => (Array.isArray(children) ? children : [children]),
    [children]
  );

  useEffect(() => {
    if (branches.length !== childrenArray.length) {
      setBranches(childrenArray);
    }
  }, [childrenArray, branches, setBranches]);

  return childrenArray.map((branch, index) => (
    <div
      className={cn(
        "grid gap-2 overflow-hidden [&>div]:pb-0",
        index === currentBranch ? "block" : "hidden"
      )}
      key={branch.key}
      {...props}
    >
      {branch}
    </div>
  ));
};

// ---------------------------------------------------------------------------
// Message Branch Selector
// ---------------------------------------------------------------------------

export type MessageBranchSelectorProps = ComponentProps<typeof ButtonGroup>;

export const MessageBranchSelector = ({
  className,
  ...props
}: MessageBranchSelectorProps) => {
  const { totalBranches } = useMessageBranch();

  if (totalBranches <= 1) {
    return null;
  }

  return (
    <ButtonGroup
      className={cn(
        "[&>*:not(:first-child)]:rounded-l-md [&>*:not(:last-child)]:rounded-r-md",
        className
      )}
      orientation="horizontal"
      {...props}
    />
  );
};

// ---------------------------------------------------------------------------
// Message Branch Previous
// ---------------------------------------------------------------------------

export type MessageBranchPreviousProps = ComponentProps<typeof Button>;

export const MessageBranchPrevious = ({
  children,
  ...props
}: MessageBranchPreviousProps) => {
  const { goToPrevious, totalBranches } = useMessageBranch();

  return (
    <Button
      aria-label="Previous branch"
      disabled={totalBranches <= 1}
      onClick={goToPrevious}
      size="icon-sm"
      type="button"
      variant="ghost"
      {...props}
    >
      {children ?? <ChevronLeftIcon size={14} />}
    </Button>
  );
};

// ---------------------------------------------------------------------------
// Message Branch Next
// ---------------------------------------------------------------------------

export type MessageBranchNextProps = ComponentProps<typeof Button>;

export const MessageBranchNext = ({
  children,
  ...props
}: MessageBranchNextProps) => {
  const { goToNext, totalBranches } = useMessageBranch();

  return (
    <Button
      aria-label="Next branch"
      disabled={totalBranches <= 1}
      onClick={goToNext}
      size="icon-sm"
      type="button"
      variant="ghost"
      {...props}
    >
      {children ?? <ChevronRightIcon size={14} />}
    </Button>
  );
};

// ---------------------------------------------------------------------------
// Message Branch Page
// ---------------------------------------------------------------------------

export type MessageBranchPageProps = HTMLAttributes<HTMLSpanElement>;

export const MessageBranchPage = ({
  className,
  ...props
}: MessageBranchPageProps) => {
  const { currentBranch, totalBranches } = useMessageBranch();

  return (
    <ButtonGroupText
      className={cn(
        "border-none bg-transparent text-muted-foreground shadow-none",
        className
      )}
      {...props}
    >
      {currentBranch + 1} of {totalBranches}
    </ButtonGroupText>
  );
};

// ---------------------------------------------------------------------------
// Message Response
// Note: Source uses Streamdown; we use react-markdown as a compatible alternative
// since streamdown requires server components.
// ---------------------------------------------------------------------------

const markdownComponents = {
  code: ({ children, className, ...rest }: any) => {
    const match = /language-(\w+)/.exec(className || "");
    if (!className) {
      return (
        <code className="bg-muted px-1.5 py-0.5 rounded text-[0.875em] font-mono" {...rest}>
          {children}
        </code>
      );
    }
    return (
      <pre className="p-3 overflow-x-auto bg-muted/30 rounded-lg border border-border my-2">
        <code className={cn("text-sm font-mono", className)} {...rest}>
          {children}
        </code>
      </pre>
    );
  },
  p: ({ children, ...props }: any) => (
    <p className="leading-relaxed [&:not(:last-child)]:mb-3" {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }: any) => (
    <ul className="list-disc pl-4 space-y-1 my-2" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }: any) => (
    <ol className="list-decimal pl-4 space-y-1 my-2" {...props}>
      {children}
    </ol>
  ),
  a: ({ children, href, ...props }: any) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:text-primary/80"
      {...props}
    >
      {children}
    </a>
  ),
  blockquote: ({ children, ...props }: any) => (
    <blockquote
      className="border-l-2 border-border pl-4 italic text-muted-foreground my-2"
      {...props}
    >
      {children}
    </blockquote>
  ),
  table: ({ children, ...props }: any) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...props }: any) => (
    <th
      className="border border-border bg-muted px-3 py-2 text-left font-semibold"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }: any) => (
    <td className="border border-border px-3 py-2" {...props}>
      {children}
    </td>
  ),
};

export type MessageResponseProps = HTMLAttributes<HTMLDivElement> & {
  children: string;
};

export const MessageResponse = memo(
  ({ className, children, ...props }: MessageResponseProps) => (
    <div
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
      {...props}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {children}
      </ReactMarkdown>
    </div>
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

MessageResponse.displayName = "MessageResponse";

// ---------------------------------------------------------------------------
// Message Toolbar
// ---------------------------------------------------------------------------

export type MessageToolbarProps = ComponentProps<"div">;

export const MessageToolbar = ({
  className,
  children,
  ...props
}: MessageToolbarProps) => (
  <div
    className={cn(
      "mt-4 flex w-full items-center justify-between gap-4",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

// ---------------------------------------------------------------------------
// Convenience action components (extension-specific additions)
// ---------------------------------------------------------------------------

import { Check, Copy, RefreshCw, ThumbsUp, ThumbsDown } from "lucide-react";

export interface CopyActionProps {
  content: string;
  className?: string;
}

export const CopyAction = ({ content, className }: CopyActionProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  }, [content]);

  return (
    <MessageAction label="Copy" tooltip="Copy" onClick={handleCopy} className={className}>
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </MessageAction>
  );
};

export interface RegenerateActionProps {
  onRegenerate: () => void;
  className?: string;
}

export const RegenerateAction = ({
  onRegenerate,
  className,
}: RegenerateActionProps) => (
  <MessageAction label="Regenerate" tooltip="Regenerate" onClick={onRegenerate} className={className}>
    <RefreshCw className="size-3.5" />
  </MessageAction>
);

export interface LikeActionProps {
  liked?: boolean;
  onToggle?: () => void;
  className?: string;
}

export const LikeAction = ({
  liked = false,
  onToggle,
  className,
}: LikeActionProps) => (
  <MessageAction label="Like" tooltip="Like" onClick={onToggle} className={className}>
    <ThumbsUp className="size-3.5" fill={liked ? "currentColor" : "none"} />
  </MessageAction>
);

export interface DislikeActionProps {
  disliked?: boolean;
  onToggle?: () => void;
  className?: string;
}

export const DislikeAction = ({
  disliked = false,
  onToggle,
  className,
}: DislikeActionProps) => (
  <MessageAction label="Dislike" tooltip="Dislike" onClick={onToggle} className={className}>
    <ThumbsDown className="size-3.5" fill={disliked ? "currentColor" : "none"} />
  </MessageAction>
);

// ---------------------------------------------------------------------------
// Typing Indicator (extension-specific addition)
// ---------------------------------------------------------------------------

export const TypingIndicator = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex items-center gap-1 py-2", className)} {...props}>
    <span
      className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
      style={{ animationDelay: "0ms" }}
    />
    <span
      className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
      style={{ animationDelay: "150ms" }}
    />
    <span
      className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
      style={{ animationDelay: "300ms" }}
    />
  </div>
);
