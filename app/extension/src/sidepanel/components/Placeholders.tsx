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
  Command,
  Loader2,
  Search,
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

type WelcomeActionGroupId = "understand" | "question" | "library" | "prompts";

interface WelcomeQuickAction {
  id: string;
  label: string;
  prompt: string;
  includeCurrentPageContext?: boolean;
  disabled?: boolean;
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
  onQuickActionSend: (
    prompt: string,
    options?: WelcomeQuickActionSendOptions
  ) => void;
  disabled?: boolean;
}

type TranslateFn = ReturnType<typeof useI18n>["t"];

function buildWelcomeGroups(
  t: TranslateFn,
  slashPrompts: SlashPrompt[],
  tabContext: TabContext | null
): WelcomeActionGroup[] {
  const pageReady = Boolean(tabContext?.url);
  const promptActions = slashPrompts.slice(0, 4).map((prompt) => ({
    id: prompt.id,
    label: `/${prompt.trigger}`,
    prompt: `/${prompt.trigger}`,
  }));

  const pageActions: WelcomeQuickAction[] = [
    {
      id: "page-summary",
      label: t("sidepanel.welcome.action.pageSummary.label"),
      prompt: t("sidepanel.welcome.action.pageSummary.prompt"),
      includeCurrentPageContext: true,
      disabled: !pageReady,
    },
    {
      id: "page-takeaways",
      label: t("sidepanel.welcome.action.pageTakeaways.label"),
      prompt: t("sidepanel.welcome.action.pageTakeaways.prompt"),
      includeCurrentPageContext: true,
      disabled: !pageReady,
    },
    {
      id: "page-plain",
      label: t("sidepanel.welcome.action.pageExplain.label"),
      prompt: t("sidepanel.welcome.action.pageExplain.prompt"),
      includeCurrentPageContext: true,
      disabled: !pageReady,
    },
    {
      id: "page-outline",
      label: t("sidepanel.welcome.action.pageOutline.label"),
      prompt: t("sidepanel.welcome.action.pageOutline.prompt"),
      includeCurrentPageContext: true,
      disabled: !pageReady,
    },
  ];

  const questionActions: WelcomeQuickAction[] = [
    {
      id: "page-risks",
      label: t("sidepanel.welcome.action.pageWeakClaims.label"),
      prompt: t("sidepanel.welcome.action.pageWeakClaims.prompt"),
      includeCurrentPageContext: true,
      disabled: !pageReady,
    },
    {
      id: "page-questions",
      label: t("sidepanel.welcome.action.pageQuestions.label"),
      prompt: t("sidepanel.welcome.action.pageQuestions.prompt"),
      includeCurrentPageContext: true,
      disabled: !pageReady,
    },
    {
      id: "page-verify",
      label: t("sidepanel.welcome.action.pageVerify.label"),
      prompt: t("sidepanel.welcome.action.pageVerify.prompt"),
      includeCurrentPageContext: true,
      disabled: !pageReady,
    },
    {
      id: "page-angles",
      label: t("sidepanel.welcome.action.pageAngles.label"),
      prompt: t("sidepanel.welcome.action.pageAngles.prompt"),
      includeCurrentPageContext: true,
      disabled: !pageReady,
    },
  ];

  const libraryActions: WelcomeQuickAction[] = [
    {
      id: "library-related",
      label: t("sidepanel.welcome.action.libraryRelated.label"),
      prompt: t("sidepanel.welcome.action.libraryRelated.prompt"),
      includeCurrentPageContext: true,
      disabled: !pageReady,
    },
    {
      id: "library-recent",
      label: t("sidepanel.welcome.action.libraryRecent.label"),
      prompt: t("sidepanel.welcome.action.libraryRecent.prompt"),
    },
    {
      id: "library-themes",
      label: t("sidepanel.welcome.action.libraryThemes.label"),
      prompt: t("sidepanel.welcome.action.libraryThemes.prompt"),
    },
    {
      id: "library-briefing",
      label: t("sidepanel.welcome.action.libraryBriefing.label"),
      prompt: t("sidepanel.welcome.action.libraryBriefing.prompt"),
    },
  ];

  return [
    {
      id: "prompts",
      title: t("sidepanel.welcome.group.prompts"),
      icon: Sparkles,
      emptyState: t("sidepanel.welcome.empty.prompts"),
      actions: promptActions,
    },
    {
      id: "understand",
      title: t("sidepanel.welcome.group.understand"),
      icon: Command,
      emptyState: t("sidepanel.welcome.empty.page"),
      actions: pageActions,
    },
    {
      id: "question",
      title: t("sidepanel.welcome.group.question"),
      icon: Search,
      emptyState: t("sidepanel.welcome.empty.page"),
      actions: questionActions,
    },
    {
      id: "library",
      title: t("sidepanel.welcome.group.library"),
      icon: BookOpen,
      emptyState: t("sidepanel.welcome.empty.library"),
      actions: libraryActions,
    },
  ];
}

export const WelcomePane: FC<WelcomePaneProps> = ({
  slashPrompts,
  tabContext,
  onQuickActionSend,
  disabled = false,
}) => {
  const { t } = useI18n();
  const [activeGroupId, setActiveGroupId] =
    useState<WelcomeActionGroupId | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(
    () => buildWelcomeGroups(t, slashPrompts, tabContext),
    [slashPrompts, t, tabContext]
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
    onQuickActionSend(action.prompt, {
      includeCurrentPageContext: action.includeCurrentPageContext,
    });
  };

  return (
    <div
      className="flex h-full w-full items-center justify-center px-5 py-8"
      onClick={() => setActiveGroupId(null)}
    >
      <div
        ref={panelRef}
        className="relative w-full max-w-[520px]"
      >
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

                  return (
                    <button
                      key={action.id}
                      type="button"
                      className={`w-full rounded-[18px] px-4 py-3 text-left text-[15px] font-medium leading-6 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a34020] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f3ea] ${
                        isActionDisabled
                          ? "cursor-not-allowed text-[#b19d88]"
                          : "text-[#3c3027] hover:bg-[#f1e8dd]"
                      }`}
                      disabled={isActionDisabled}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleActionClick(action);
                      }}
                    >
                      {action.label}
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
