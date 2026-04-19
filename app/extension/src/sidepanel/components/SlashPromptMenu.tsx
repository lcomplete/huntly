import type { FC } from "react";
import type { SlashPrompt } from "../types";

interface SlashPromptMenuProps {
  visible: boolean;
  prompts: SlashPrompt[];
  selectedIndex: number;
  onSelect: (prompt: SlashPrompt) => void;
}

export const SlashPromptMenu: FC<SlashPromptMenuProps> = ({
  visible,
  prompts,
  selectedIndex,
  onSelect,
}) => {
  if (!visible || prompts.length === 0) return null;

  return (
    <div
      role="listbox"
      aria-label="Prompt suggestions"
      className="absolute bottom-full left-0 right-0 z-30 mb-2 overflow-hidden rounded-xl border border-[#d9cfbf] bg-[#fffaf4] shadow-[0_16px_42px_rgba(64,48,31,0.14)]"
    >
      {prompts.map((prompt, index) => {
        const isSelected = index === selectedIndex;
        return (
          <div
            key={prompt.id}
            role="option"
            aria-selected={isSelected}
            tabIndex={-1}
            onClick={() => onSelect(prompt)}
            className={[
              "flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors",
              isSelected
                ? "bg-[#e9dcc7] text-[#2f261f]"
                : "text-[#3c3027] hover:bg-[#f1e8da]",
            ].join(" ")}
          >
            <span className="font-semibold text-[#9a4f2c]">
              /{prompt.trigger}
            </span>
          </div>
        );
      })}
    </div>
  );
};
