import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
} from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BookOpen,
  Globe,
  Image as ImageIcon,
  Loader2,
  Sparkles,
} from "lucide-react";

import type { SlashPrompt } from "../types";
import type { TabContext } from "../utils/tabContext";
import { useI18n } from "../../i18n";

export const LoadingScreen: FC = () => (
  <div className="flex h-full items-center justify-center bg-[#f7f3ea] text-[#75695b]">
    <Loader2 className="size-6 animate-spin" />
  </div>
);

type WelcomeActionGroupId =
  | "shortcuts"
  | "page"
  | "image"
  | "library";

type QuickActionMode = "send" | "fill";
type WelcomeQuickActionTone = "default" | "prompt";

interface WelcomeQuickAction {
  id: string;
  label: string;
  prompt: string;
  mode?: QuickActionMode;
  tone?: WelcomeQuickActionTone;
  includeCurrentPageContext?: boolean;
  disabled?: boolean;
  hint?: string;
}

interface WelcomeActionGroup {
  id: WelcomeActionGroupId;
  title: string;
  icon: LucideIcon;
  emptyState: string;
  actions: WelcomeQuickAction[];
}

interface WelcomeQuickActionSendOptions {
  includeCurrentPageContext?: boolean;
}

interface WelcomePaneProps {
  slashPrompts: SlashPrompt[];
  tabContext: TabContext | null;
  huntlyMcpEnabled: boolean;
  onQuickActionSend: (
    prompt: string,
    options?: WelcomeQuickActionSendOptions
  ) => void;
  onQuickActionFillComposer: (prompt: string) => void;
  disabled?: boolean;
}

type TranslateFn = ReturnType<typeof useI18n>["t"];

const MAX_PROMPT_CHIPS = 6;
const MAX_STATIC_ACTIONS = 4;

function buildWelcomeGroups(
  t: TranslateFn,
  slashPrompts: SlashPrompt[],
  tabContext: TabContext | null,
  huntlyMcpEnabled: boolean
): WelcomeActionGroup[] {
  const pageReady = Boolean(tabContext?.url);

  const promptActions: WelcomeQuickAction[] = slashPrompts
    .slice(0, MAX_PROMPT_CHIPS)
    .map((prompt) => ({
      id: prompt.id,
      label: `/${prompt.trigger}`,
      prompt: `/${prompt.trigger}`,
      tone: "prompt",
      includeCurrentPageContext: true,
      disabled: !pageReady,
    }));

  const pageActions: WelcomeQuickAction[] = [
    {
      id: "page-summary",
      label: t("sidepanel.welcome.action.pageSummary.prompt"),
      prompt: t("sidepanel.welcome.action.pageSummary.prompt"),
      includeCurrentPageContext: true,
      disabled: !pageReady,
    },
    {
      id: "page-plain",
      label: t("sidepanel.welcome.action.pageExplain.prompt"),
      prompt: t("sidepanel.welcome.action.pageExplain.prompt"),
      includeCurrentPageContext: true,
      disabled: !pageReady,
    },
  ];

  const selectionActions: WelcomeQuickAction[] = [
    {
      id: "selection-explain",
      label: t("sidepanel.welcome.action.selectionExplain.prompt"),
      prompt: t("sidepanel.welcome.action.selectionExplain.prompt"),
      disabled: !pageReady,
    },
    {
      id: "selection-translate",
      label: t("sidepanel.welcome.action.selectionTranslate.prompt"),
      prompt: t("sidepanel.welcome.action.selectionTranslate.prompt"),
      disabled: !pageReady,
    },
  ];

  const imageActions: WelcomeQuickAction[] = [
    {
      id: "image-translate",
      label: t("sidepanel.welcome.action.imageTranslate.prompt"),
      prompt: t("sidepanel.welcome.action.imageTranslate.prompt"),
      mode: "fill",
    },
    {
      id: "image-describe",
      label: t("sidepanel.welcome.action.imageDescribe.prompt"),
      prompt: t("sidepanel.welcome.action.imageDescribe.prompt"),
      mode: "fill",
    },
    {
      id: "image-ocr",
      label: t("sidepanel.welcome.action.imageOcr.prompt"),
      prompt: t("sidepanel.welcome.action.imageOcr.prompt"),
      mode: "fill",
    },
  ];

  const libraryActions: WelcomeQuickAction[] = [
    {
      id: "library-related",
      label: t("sidepanel.welcome.action.libraryRelated.prompt"),
      prompt: t("sidepanel.welcome.action.libraryRelated.prompt"),
      includeCurrentPageContext: true,
      disabled: !pageReady,
    },
    {
      id: "library-recent",
      label: t("sidepanel.welcome.action.libraryRecent.prompt"),
      prompt: t("sidepanel.welcome.action.libraryRecent.prompt"),
    },
    {
      id: "library-themes",
      label: t("sidepanel.welcome.action.libraryThemes.prompt"),
      prompt: t("sidepanel.welcome.action.libraryThemes.prompt"),
    },
    {
      id: "library-briefing",
      label: t("sidepanel.welcome.action.libraryBriefing.prompt"),
      prompt: t("sidepanel.welcome.action.libraryBriefing.prompt"),
    },
  ];

  const groups: WelcomeActionGroup[] = [
    {
      id: "shortcuts",
      title: t("sidepanel.welcome.group.shortcuts"),
      icon: Sparkles,
      emptyState: t("sidepanel.welcome.empty.prompts"),
      actions: promptActions,
    },
    {
      id: "page",
      title: t("sidepanel.welcome.group.page"),
      icon: Globe,
      emptyState: t("sidepanel.welcome.empty.page"),
      actions: [...pageActions, ...selectionActions].slice(0, MAX_STATIC_ACTIONS),
    },
    {
      id: "image",
      title: t("sidepanel.welcome.group.image"),
      icon: ImageIcon,
      emptyState: t("sidepanel.welcome.empty.image"),
      actions: imageActions.slice(0, MAX_STATIC_ACTIONS),
    },
  ];

  if (huntlyMcpEnabled) {
    groups.push({
      id: "library",
      title: t("sidepanel.welcome.group.library"),
      icon: BookOpen,
      emptyState: t("sidepanel.welcome.empty.library"),
      actions: libraryActions.slice(0, MAX_STATIC_ACTIONS),
    });
  }

  return groups;
}

export const WelcomePane: FC<WelcomePaneProps> = ({
  slashPrompts,
  tabContext,
  huntlyMcpEnabled,
  onQuickActionSend,
  onQuickActionFillComposer,
  disabled = false,
}) => {
  const { t } = useI18n();
  const [activeGroupId, setActiveGroupId] =
    useState<WelcomeActionGroupId | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(
    () => buildWelcomeGroups(t, slashPrompts, tabContext, huntlyMcpEnabled),
    [slashPrompts, t, tabContext, huntlyMcpEnabled]
  );

  const activeGroup =
    groups.find((group) => group.id === activeGroupId) || null;

  useEffect(() => {
    if (!activeGroupId) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target)) return;
      setActiveGroupId(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveGroupId(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeGroupId]);

  const handleActionClick = (action: WelcomeQuickAction) => {
    if (disabled || action.disabled) return;
    setActiveGroupId(null);
    if (action.mode === "fill") {
      onQuickActionFillComposer(action.prompt);
      return;
    }
    onQuickActionSend(action.prompt, {
      includeCurrentPageContext: action.includeCurrentPageContext,
    });
  };

  return (
    <div
      className="flex h-full w-full items-center justify-center px-5 py-8"
      onClick={() => setActiveGroupId(null)}
    >
      <div ref={panelRef} className="relative w-full max-w-[520px]">
        <div className="text-center">
          <h1 className="font-serif text-[34px] leading-none text-[#2f261f]">
            {t("sidepanel.welcome.title")}
          </h1>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-2.5">
          {groups.map((group) => {
            const isActive = group.id === activeGroupId;
            const Icon = group.icon;

            return (
              <button
                key={group.id}
                type="button"
                aria-pressed={isActive}
                className={`min-h-11 rounded-full border px-4 py-2.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a34020] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f3ea] ${
                  isActive
                    ? "border-[#cc7b58] bg-[#fff4e7] text-[#7a3118] shadow-[0_10px_24px_rgba(64,48,31,0.08)]"
                    : "border-[#e5d8c9] bg-[#fffdf9] text-[#5f5246] hover:border-[#d9c3af] hover:bg-[#fff5eb]"
                }`}
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveGroupId(group.id);
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <Icon className="size-4" />
                  <span>{group.title}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div
          className={`absolute left-0 right-0 top-full z-10 mt-6 transition-[opacity,transform] duration-200 ${
            activeGroup
              ? "pointer-events-auto translate-y-0 opacity-100"
              : "pointer-events-none -translate-y-1 opacity-0"
          }`}
        >
          {activeGroup ? (
            <div className="space-y-1.5">
              {activeGroup.actions.length > 0 ? (
                activeGroup.actions.map((action) => {
                  const isActionDisabled = action.disabled || disabled;
                  const actionTextClass = isActionDisabled
                    ? "text-[#b19d88]"
                    : action.tone === "prompt"
                      ? "font-semibold text-[#9a4f2c]"
                      : "text-[#3c3027]";

                  return (
                    <button
                      key={action.id}
                      type="button"
                      className={`w-full rounded-[18px] px-4 py-3 text-left text-[15px] font-medium leading-6 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a34020] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f3ea] ${
                        isActionDisabled
                          ? "cursor-not-allowed"
                          : "cursor-pointer hover:bg-[#f1e8dd]"
                      }`}
                      disabled={isActionDisabled}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleActionClick(action);
                      }}
                    >
                      <span className={actionTextClass}>{action.label}</span>
                    </button>
                  );
                })
              ) : (
                <div className="px-4 py-3 text-[15px] leading-6 text-[#8b7764]">
                  {activeGroup.emptyState}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

interface EmptyProvidersProps {
  onOpenSettings: () => void;
}

export const EmptyProviders: FC<EmptyProvidersProps> = ({ onOpenSettings }) => {
  const { t } = useI18n();

  return (
    <div className="flex h-full items-center justify-center bg-[#f7f3ea] px-8">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#f1e4d2] text-[#9a4f2c]">
          <AlertTriangle className="size-6" />
        </div>
        <div className="text-lg font-semibold text-[#332a22]">
          {t("sidepanel.emptyProviders.title")}
        </div>
        <div className="mt-2 text-sm leading-6 text-[#75695b]">
          {t("sidepanel.emptyProviders.description")}
        </div>
        <button
          type="button"
          className="mt-5 rounded-lg bg-[#2f261f] px-4 py-2 text-sm font-medium text-[#fffaf4] transition-colors hover:bg-[#46382d]"
          onClick={onOpenSettings}
        >
          {t("common.openSettings")}
        </button>
      </div>
    </div>
  );
};
