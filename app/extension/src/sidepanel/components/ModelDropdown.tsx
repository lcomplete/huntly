import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FC,
} from "react";
import { Brain, Check, ChevronDown, Search, Settings } from "lucide-react";
import type { HuntlyModelInfo } from "../types";
import { findModelByKey, getModelKey } from "../modelBridge";
import { formatModelName, getProviderLabel } from "../utils/format";
import { useOutsideClick } from "../utils/dom";
import { IconButton } from "./IconButton";
import { useI18n } from "../../i18n";

interface ModelDropdownProps {
  models: HuntlyModelInfo[];
  currentModelId: string | null;
  thinkingMode: boolean;
  onSelect: (model: HuntlyModelInfo) => void;
  onOpenSettings: () => void;
  onThinkingModeToggle: () => void;
}

export const ModelDropdown: FC<ModelDropdownProps> = ({
  models,
  currentModelId,
  thinkingMode,
  onSelect,
  onOpenSettings,
  onThinkingModeToggle,
}) => {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  useOutsideClick(open, wrapperRef, close);

  useEffect(() => {
    if (!open) return;

    const focusFrame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
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

  const currentModel = useMemo(
    () => findModelByKey(models, currentModelId),
    [models, currentModelId]
  );

  const groupedModels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = normalizedQuery
      ? models.filter(
          (model) =>
            model.modelId.toLowerCase().includes(normalizedQuery) ||
            getProviderLabel(model.provider)
              .toLowerCase()
              .includes(normalizedQuery)
        )
      : models;

    const grouped = new Map<string, HuntlyModelInfo[]>();
    for (const model of filtered) {
      const label = getProviderLabel(model.provider);
      grouped.set(label, [...(grouped.get(label) || []), model]);
    }
    return grouped;
  }, [models, query]);

  return (
    <div ref={wrapperRef} className="relative flex min-w-0 items-center">
      <button
        ref={buttonRef}
        type="button"
        className="flex h-8 max-w-[200px] items-center gap-1 rounded-md px-1.5 text-xs font-medium text-[#6f6254] transition-colors hover:bg-[#eee7dc] hover:text-[#2f261f]"
        aria-controls={open ? panelId : undefined}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="truncate">
          {formatModelName(currentModel?.modelId)}
        </span>
        {thinkingMode && <Brain className="size-4 shrink-0" />}
        <ChevronDown className="size-4 shrink-0" />
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={t("sidepanel.modelDropdown.picker")}
          className="absolute bottom-full left-0 z-50 mb-2 w-[min(340px,calc(100vw-92px))] overflow-hidden rounded-xl border border-[#d9cfbf] bg-[#fffaf4] shadow-[0_18px_45px_rgba(64,48,31,0.18)]"
        >
          <div className="border-b border-[#e7ded0] p-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg bg-[#f4efe6] px-3 text-[#6f6254]">
                <Search className="size-4 shrink-0" />
                <input
                  ref={searchInputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  aria-label={t("sidepanel.modelDropdown.search")}
                  placeholder={t("sidepanel.modelDropdown.search")}
                  className="min-w-0 flex-1 bg-transparent text-sm text-[#2f261f] outline-none placeholder:text-[#6f6254]"
                />
              </div>
              <IconButton
                className="h-9 w-9 shrink-0"
                label={t("sidepanel.modelDropdown.settings")}
                onClick={() => {
                  setOpen(false);
                  onOpenSettings();
                }}
              >
                <Settings className="size-4" />
              </IconButton>
            </div>
          </div>

          <div className="max-h-[330px] overflow-y-auto py-1">
            {groupedModels.size === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-[#6f6254]">
                {t("sidepanel.modelDropdown.noModels")}
              </div>
            ) : (
              Array.from(groupedModels.entries()).map(
                ([provider, providerModels]) => (
                  <div key={provider} className="py-1">
                    <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[#6f6254]">
                      {provider}
                    </div>
                    {providerModels.map((model) => {
                      const key = getModelKey(model);
                      const selected = key === currentModelId;
                      return (
                        <button
                          key={key}
                          type="button"
                          className={[
                            "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                            selected
                              ? "bg-[#e9dcc7] text-[#2f261f]"
                              : "text-[#3c3027] hover:bg-[#f1e8da]",
                          ].join(" ")}
                          onClick={() => {
                            onSelect(model);
                            setOpen(false);
                          }}
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#efe4d3] text-[11px] font-bold uppercase text-[#7a4a2e]">
                            {provider.slice(0, 1)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">
                              {formatModelName(model.modelId)}
                            </span>
                            <span className="block truncate text-xs text-[#6f6254]">
                              {model.modelId}
                            </span>
                          </span>
                          {selected && <Check className="size-4 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )
              )
            )}
          </div>

          <div className="border-t border-[#e7ded0] p-2">
            <button
              type="button"
              role="switch"
              aria-checked={thinkingMode}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#3c3027] transition-colors hover:bg-[#f1e8da]"
              onClick={onThinkingModeToggle}
            >
              <Brain
                className={[
                  "size-4 shrink-0",
                  thinkingMode ? "text-[#9a4f2c]" : "text-[#6f6254]",
                ].join(" ")}
              />
              <span className="min-w-0 flex-1 font-medium">
                {t("common.thinking")}
              </span>
              <span
                aria-hidden="true"
                className={[
                  "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200",
                  thinkingMode ? "bg-[#d97745]" : "bg-[#d8cfbf]",
                ].join(" ")}
              >
                <span
                  className={[
                    "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-[#fffaf4] shadow-sm transition-transform duration-200",
                    thinkingMode ? "translate-x-4" : "translate-x-0",
                  ].join(" ")}
                />
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
