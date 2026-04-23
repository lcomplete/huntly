import { useEffect, useState, type FC } from "react";
import { BookOpen } from "lucide-react";
import { useI18n } from "../../i18n";

interface TabFaviconProps {
  faviconUrl?: string;
  title?: string;
  muted?: boolean;
}

export const TabFavicon: FC<TabFaviconProps> = ({
  faviconUrl,
  title,
  muted,
}) => {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [faviconUrl]);

  if (faviconUrl && !failed) {
    return (
      <img
        src={faviconUrl}
        alt=""
        className="h-4 w-4 shrink-0 rounded-sm"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <BookOpen
      aria-label={title || t("sidepanel.context.currentTab")}
      className={[
        "size-4 shrink-0",
        muted ? "text-[#6f6254]" : "text-[#75695b]",
      ].join(" ")}
    />
  );
};
