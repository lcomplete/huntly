import type { FC } from "react";

interface HighlightedPromptTextProps {
  text: string;
  promptPrefix: string | null;
  promptClassName: string;
}

export const HighlightedPromptText: FC<HighlightedPromptTextProps> = ({
  text,
  promptPrefix,
  promptClassName,
}) => {
  const prefixIndex = text.match(/^\s*/)?.[0].length || 0;
  if (!promptPrefix || !text.startsWith(promptPrefix, prefixIndex)) {
    return <>{text}</>;
  }

  return (
    <>
      {text.slice(0, prefixIndex)}
      <span className={promptClassName}>{promptPrefix}</span>
      {text.slice(prefixIndex + promptPrefix.length)}
    </>
  );
};
