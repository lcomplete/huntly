import type { FC } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

export const LoadingScreen: FC = () => (
  <div className="flex h-full items-center justify-center bg-[#f7f3ea] text-[#75695b]">
    <Loader2 className="size-6 animate-spin" />
  </div>
);

export const WelcomePane: FC = () => (
  <div className="flex w-full max-w-[420px] flex-col items-center text-center">
    <div className="mb-3 text-xs font-semibold uppercase text-[#9a4f2c]">
      Huntly AI
    </div>
    <h1 className="max-w-[360px] font-serif text-[34px] leading-tight text-[#332a22]">
      Read, save, and search from the side panel
    </h1>
    <p className="mt-4 max-w-[340px] text-sm leading-6 text-[#75695b]">
      Ask about the current page, capture it to Huntly, or find answers from
      your saved library.
    </p>
  </div>
);

interface EmptyProvidersProps {
  onOpenSettings: () => void;
}

export const EmptyProviders: FC<EmptyProvidersProps> = ({ onOpenSettings }) => (
  <div className="flex h-full items-center justify-center bg-[#f7f3ea] px-8">
    <div className="max-w-sm text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#f1e4d2] text-[#9a4f2c]">
        <AlertTriangle className="size-6" />
      </div>
      <div className="text-lg font-semibold text-[#332a22]">
        No AI providers configured
      </div>
      <div className="mt-2 text-sm leading-6 text-[#75695b]">
        Configure at least one AI provider in settings to start chatting.
      </div>
      <button
        type="button"
        className="mt-5 rounded-lg bg-[#2f261f] px-4 py-2 text-sm font-medium text-[#fffaf4] transition-colors hover:bg-[#46382d]"
        onClick={onOpenSettings}
      >
        Open settings
      </button>
    </div>
  </div>
);
