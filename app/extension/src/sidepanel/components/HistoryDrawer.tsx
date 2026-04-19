import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
} from "react";
import { MessageSquare, Trash, X } from "lucide-react";
import type { SessionMetadata } from "../types";
import {
  DATE_GROUP_ORDER,
  getSessionListDate,
  groupSessionsByDate,
  hasUnreadMessages,
} from "../utils/sessions";
import { getFocusableElements } from "../utils/dom";
import { IconButton } from "./IconButton";
import { SmartMoment } from "./SmartMoment";

interface HistoryDrawerProps {
  open: boolean;
  sessions: SessionMetadata[];
  currentSessionId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

const LEAVE_ANIMATION_MS = 200;

export const HistoryDrawer: FC<HistoryDrawerProps> = ({
  open,
  sessions,
  currentSessionId,
  onClose,
  onSelect,
  onDelete,
}) => {
  const drawerRootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [rendered, setRendered] = useState(open);
  const [visible, setVisible] = useState(open);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setRendered(true);
      const frame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }

    setVisible(false);
    setPendingDeleteId(null);
    const timer = window.setTimeout(
      () => setRendered(false),
      LEAVE_ANIMATION_MS
    );
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    const root = drawerRootRef.current;
    if (!root) return;

    if (open) {
      root.removeAttribute("inert");
      return;
    }

    root.setAttribute("inert", "");
  }, [open, rendered]);

  useEffect(() => {
    if (!open || !rendered) return;

    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const focusFrame = window.requestAnimationFrame(() => {
      getFocusableElements(dialogRef.current)[0]?.focus();
    });

    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = getFocusableElements(dialogRef.current);
      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (
        activeElement instanceof Node &&
        dialogRef.current &&
        !dialogRef.current.contains(activeElement)
      ) {
        event.preventDefault();
        firstElement.focus();
        return;
      }

      if (event.shiftKey) {
        if (
          activeElement === firstElement ||
          activeElement === dialogRef.current
        ) {
          event.preventDefault();
          lastElement.focus();
        }
        return;
      }

      if (activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handler);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handler);
      restoreFocusRef.current?.focus();
      restoreFocusRef.current = null;
    };
  }, [open, rendered, onClose]);

  const groupedSessions = useMemo(
    () => groupSessionsByDate(sessions),
    [sessions]
  );

  if (!rendered) return null;

  return (
    <div
      ref={drawerRootRef}
      aria-hidden={!open}
      className={[
        "absolute inset-0 z-40 transition",
        open ? "pointer-events-auto" : "pointer-events-none",
      ].join(" ")}
    >
      <div
        aria-hidden="true"
        className={[
          "absolute inset-0 bg-[#2f261f]/20 transition-opacity duration-200 ease-out",
          visible ? "opacity-100" : "opacity-0",
        ].join(" ")}
        onClick={onClose}
      />

      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Chat history"
        tabIndex={-1}
        className={[
          "absolute inset-x-0 bottom-0 flex max-h-[min(74vh,560px)] flex-col rounded-t-2xl border border-b-0 border-[#e2d8c9] bg-[#f7f2e9] shadow-[0_-18px_45px_rgba(64,48,31,0.16)] transition-transform duration-200 ease-out",
          visible ? "translate-y-0" : "translate-y-full",
        ].join(" ")}
      >
        <div className="flex items-center justify-between px-3 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#2f261f]">
            <MessageSquare className="size-4" />
            Chats
          </div>
          <IconButton label="Close history" onClick={onClose}>
            <X className="size-4" />
          </IconButton>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {sessions.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-[#6f6254]">
              No recent chats
            </div>
          ) : (
            <div className="space-y-3">
              {DATE_GROUP_ORDER.filter((label) =>
                groupedSessions.has(label)
              ).map((label) => (
                <div key={label}>
                  <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[#6f6254]">
                    {label}
                  </div>
                  <div className="space-y-1">
                    {groupedSessions.get(label)!.map((session) => {
                      const active = session.id === currentSessionId;
                      const unread = hasUnreadMessages(
                        session,
                        currentSessionId
                      );
                      const listDate = getSessionListDate(session);
                      const pendingDelete = pendingDeleteId === session.id;
                      return (
                        <div
                          key={session.id}
                          className={[
                            "group flex items-center gap-1 rounded-lg",
                            active ? "bg-[#e9dcc7]" : "hover:bg-[#eee7dc]",
                          ].join(" ")}
                        >
                          <button
                            type="button"
                            className="min-w-0 flex-1 px-3 py-2 text-left"
                            onClick={() => onSelect(session.id)}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <div
                                className={[
                                  "truncate text-sm text-[#332a22]",
                                  unread ? "font-semibold" : "font-medium",
                                ].join(" ")}
                              >
                                {session.title}
                              </div>
                              {unread ? (
                                <span className="shrink-0 rounded-full bg-[#2f6fed] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                                  Unread
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#6f6254]">
                              <span>{session.messageCount} msgs</span>
                              <span className="inline-flex min-w-0 items-center gap-1">
                                <SmartMoment
                                  dt={listDate}
                                  timeTypeLabel="Last message"
                                />
                              </span>
                            </div>
                          </button>
                          <button
                            type="button"
                            aria-label={
                              pendingDelete
                                ? `Confirm delete ${session.title}`
                                : `Delete ${session.title}`
                            }
                            title={
                              pendingDelete ? "Confirm delete" : "Delete chat"
                            }
                            className={[
                              "flex h-9 shrink-0 items-center justify-center rounded-md transition-colors",
                              pendingDelete
                                ? "px-2 text-xs font-semibold text-[#a34020] hover:bg-[#f4d7cc]"
                                : "w-9 text-[#6f6254] opacity-80 hover:bg-[#f4d7cc] hover:text-[#a34020] hover:opacity-100",
                            ].join(" ")}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (pendingDelete) {
                                onDelete(session.id);
                                setPendingDeleteId(null);
                                return;
                              }
                              setPendingDeleteId(session.id);
                            }}
                          >
                            {pendingDelete ? (
                              "Delete"
                            ) : (
                              <Trash className="size-4" />
                            )}
                          </button>
                          {pendingDelete && (
                            <button
                              type="button"
                              aria-label={`Cancel delete ${session.title}`}
                              title="Cancel delete"
                              className="mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[#6f6254] transition-colors hover:bg-[#eee7dc] hover:text-[#2f261f]"
                              onClick={(event) => {
                                event.stopPropagation();
                                setPendingDeleteId(null);
                              }}
                            >
                              <X className="size-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
