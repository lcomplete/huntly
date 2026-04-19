import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FC,
} from "react";
import { Paperclip, Plus, Sparkles } from "lucide-react";
import type { SlashPrompt } from "../types";
import { getFocusableElements, useOutsideClick } from "../utils/dom";
import { IconButton } from "./IconButton";

interface ComposerActionMenuProps {
  prompts: SlashPrompt[];
  onUploadClick: () => void;
  onPromptSelect: (prompt: SlashPrompt) => void;
}

export const ComposerActionMenu: FC<ComposerActionMenuProps> = ({
  prompts,
  onUploadClick,
  onPromptSelect,
}) => {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  useOutsideClick(open, wrapperRef, close);

  useEffect(() => {
    if (!open) return;

    const focusFrame = window.requestAnimationFrame(() => {
      getFocusableElements(menuRef.current)[0]?.focus();
    });
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    };

    document.addEventListener("keydown", handler);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handler);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <IconButton
        ref={buttonRef}
        active={open}
        label="Add"
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <Plus className="size-4" />
      </IconButton>

      {open && (
        <div
          id={menuId}
          ref={menuRef}
          role="menu"
          aria-label="Add content"
          className="absolute bottom-full left-0 z-50 mb-2 w-[min(320px,calc(100vw-88px))] overflow-hidden rounded-xl border border-[#d9cfbf] bg-[#fffaf4] shadow-[0_16px_42px_rgba(64,48,31,0.16)]"
        >
          <div className="p-1.5">
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-[#3c3027] transition-colors hover:bg-[#f1e8da]"
              onClick={() => {
                onUploadClick();
                setOpen(false);
              }}
            >
              <Paperclip className="size-4 shrink-0 text-[#6f6254]" />
              <span className="font-medium">Add photos and files</span>
            </button>
          </div>

          {prompts.length > 0 && (
            <div className="border-t border-[#e7ded0]">
              <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[#6f6254]">
                Prompts
              </div>
              <div className="max-h-52 overflow-y-auto py-1">
                {prompts.map((prompt) => (
                  <button
                    key={prompt.id}
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#3c3027] transition-colors hover:bg-[#f1e8da]"
                    onClick={() => {
                      onPromptSelect(prompt);
                      setOpen(false);
                    }}
                  >
                    <Sparkles className="size-4 shrink-0 text-[#6f6254]" />
                    <span className="font-semibold text-[#9a4f2c]">
                      /{prompt.trigger}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
