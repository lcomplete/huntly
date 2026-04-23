export type DisplayLanguage = "en" | "zh-CN";

export type DisplayLanguageOption = {
  value: DisplayLanguage;
  label: string;
  nativeLabel: string;
};

export const DISPLAY_LANGUAGE_OPTIONS: DisplayLanguageOption[] = [
  {
    value: "en",
    label: "English",
    nativeLabel: "English",
  },
  {
    value: "zh-CN",
    label: "Simplified Chinese",
    nativeLabel: "简体中文",
  },
];

export function normalizeDisplayLanguage(
  value?: string | null
): DisplayLanguage {
  const normalized = (value || "").toLowerCase();
  if (normalized.startsWith("zh")) {
    return "zh-CN";
  }
  return "en";
}

export function getBrowserDisplayLanguage(): DisplayLanguage {
  const browserLanguage =
    typeof chrome !== "undefined" && typeof chrome.i18n?.getUILanguage === "function"
      ? chrome.i18n.getUILanguage()
      : typeof navigator !== "undefined"
        ? navigator.language
        : "en";

  return normalizeDisplayLanguage(browserLanguage);
}