import { useState, type FC } from "react";
import { Loader2, Paperclip, X } from "lucide-react";
import type { ChatPart } from "../types";
import { formatFileSize } from "../utils/format";
import { useI18n } from "../../i18n";

interface AttachmentPreviewListProps {
  attachments: ChatPart[];
  processingLabel?: string | null;
  onRemove: (id: string) => void;
}

export const AttachmentPreviewList: FC<AttachmentPreviewListProps> = ({
  attachments,
  processingLabel,
  onRemove,
}) => {
  const { t } = useI18n();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  if (attachments.length === 0 && !processingLabel) return null;

  return (
    <>
      <div className="flex flex-wrap items-start gap-2">
        {processingLabel && (
          <div className="flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border border-dashed border-[#d8b18d] bg-[#fff5eb] px-2 py-1 text-xs font-medium text-[#8b4b2d] shadow-[0_6px_18px_rgba(64,48,31,0.06)]">
            <Loader2 className="size-4 shrink-0 animate-spin" />
            <span className="truncate">{processingLabel}</span>
          </div>
        )}
        {attachments.map((attachment) => {
          const label = attachment.filename || t("sidepanel.attachment");
          const size = formatFileSize(attachment.size);
          const isImage = attachment.mediaType?.startsWith("image/");
          return isImage && attachment.dataUrl ? (
            <div
              key={attachment.id || label}
              className="relative h-16 w-16 shrink-0 rounded-lg border border-[#d8cfbf] bg-[#fffaf4] shadow-[0_6px_18px_rgba(64,48,31,0.06)]"
            >
              <button
                type="button"
                className="h-full w-full overflow-hidden rounded-lg"
                onClick={() => setPreviewUrl(attachment.dataUrl!)}
                aria-label={t("sidepanel.previewLabel", { label })}
                title={label}
              >
                <img
                  src={attachment.dataUrl}
                  alt={label}
                  className="h-full w-full object-cover"
                />
              </button>
              {attachment.id && (
                <button
                  type="button"
                  aria-label={`${t("common.remove")} ${label}`}
                  title={`${t("common.remove")} ${label}`}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#2f261f] text-white shadow-[0_4px_10px_rgba(64,48,31,0.2)] transition-colors hover:bg-[#46382d]"
                  onClick={() => onRemove(attachment.id!)}
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          ) : (
            <div
              key={attachment.id || label}
              className="flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border border-[#d8cfbf] bg-[#fffaf4]/80 px-2 py-1 text-xs text-[#5f5347] shadow-[0_6px_18px_rgba(64,48,31,0.06)]"
            >
              <Paperclip className="size-4 shrink-0 text-[#6f6254]" />
              <span className="max-w-[180px] truncate font-medium">
                {label}
              </span>
              {size && (
                <span className="shrink-0 text-[#6f6254]">{size}</span>
              )}
              {attachment.id && (
                <button
                  type="button"
                  aria-label={`${t("common.remove")} ${label}`}
                  title={`${t("common.remove")} ${label}`}
                  className="ml-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[#6f6254] transition-colors hover:bg-[#e9dcc7] hover:text-[#2f261f]"
                  onClick={() => onRemove(attachment.id!)}
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#2f261f]/60"
          onClick={() => setPreviewUrl(null)}
        >
          <button
            type="button"
            aria-label={t("sidepanel.closePreview")}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#2f261f]/60 text-white transition-colors hover:bg-[#2f261f]/90"
            onClick={() => setPreviewUrl(null)}
          >
            <X className="size-5" />
          </button>
          <img
            src={previewUrl}
            alt={t("sidepanel.previewLabel", { label: t("sidepanel.attachment") })}
            className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-lg"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};
