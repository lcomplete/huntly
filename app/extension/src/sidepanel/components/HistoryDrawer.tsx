import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FC,
} from "react";
import {
  Archive,
  ArchiveRestore,
  Check,
  Filter,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Trash,
  X,
} from "lucide-react";
import type { SessionMetadata } from "../types";
import {
  DATE_GROUP_ORDER,
  DEFAULT_SESSION_TITLE,
  getSessionListDate,
  groupSessionsByDate,
  hasUnreadMessages,
} from "../utils/sessions";
import { getFocusableElements, useOutsideClick } from "../utils/dom";
import { IconButton } from "./IconButton";
import { SmartMoment } from "./SmartMoment";
import { useI18n } from "../../i18n";

interface HistoryDrawerProps {
  open: boolean;
  sessions: SessionMetadata[];
  currentSessionId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onTogglePinned: (id: string, pinned: boolean) => void;
  onToggleArchived: (id: string, archived: boolean) => void;
  showArchived: boolean;
  onToggleShowArchived: () => void;
}

const LEAVE_ANIMATION_MS = 200;

export const HistoryDrawer: FC<HistoryDrawerProps> = ({
  open,
  sessions,
  currentSessionId,
  onClose,
  onSelect,
  onDelete,
  onRename,
  onTogglePinned,
  onToggleArchived,
  showArchived,
  onToggleShowArchived,
}) => {
  const { t } = useI18n();
  const drawerRootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [rendered, setRendered] = useState(open);
  const [visible, setVisible] = useState(open);
  const [minDrawerHeight, setMinDrawerHeight] = useState<number | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  useEffect(() => {
    if (open) {
      setRendered(true);
      const frame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }

    setVisible(false);
    setPendingDeleteId(null);
    setMenuOpenId(null);
    setRenamingId(null);
    setRenameDraft("");
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
    if (!rendered) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const updateMinHeight = () => {
      const nextHeight = Math.ceil(dialog.getBoundingClientRect().height);
      if (!Number.isFinite(nextHeight) || nextHeight <= 0) return;

      setMinDrawerHeight((current) =>
        current && current >= nextHeight ? current : nextHeight
      );
    };

    updateMinHeight();
    const resizeObserver = new ResizeObserver(() => {
      updateMinHeight();
    });
    resizeObserver.observe(dialog);
    window.addEventListener("resize", updateMinHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateMinHeight);
    };
  }, [rendered]);

  useEffect(() => {
    if (!open || !rendered) return;

    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const focusFrame = window.requestAnimationFrame(() => {
      getFocusableElements(dialogRef.current)[0]?.focus();
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      restoreFocusRef.current?.focus();
      restoreFocusRef.current = null;
    };
  }, [open, rendered]);

  useEffect(() => {
    if (!open || !rendered) return;

    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (renamingId) {
          setRenamingId(null);
          setRenameDraft("");
          return;
        }
        if (menuOpenId) {
          setMenuOpenId(null);
          return;
        }
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
      document.removeEventListener("keydown", handler);
    };
  }, [open, rendered, onClose, renamingId, menuOpenId]);

  const visibleSessions = useMemo(
    () =>
      sessions.filter((session) =>
        showArchived ? Boolean(session.archived) : !session.archived
      ),
    [sessions, showArchived]
  );

  const groupedSessions = useMemo(
    () => groupSessionsByDate(visibleSessions),
    [visibleSessions]
  );

  const beginRename = useCallback((session: SessionMetadata) => {
    setRenamingId(session.id);
    setRenameDraft(session.title || "");
    setMenuOpenId(null);
    setPendingDeleteId(null);
  }, []);

  const commitRename = useCallback(
    (sessionId: string) => {
      const trimmed = renameDraft.trim();
      if (trimmed) {
        onRename(sessionId, trimmed);
      }
      setRenamingId(null);
      setRenameDraft("");
    },
    [onRename, renameDraft]
  );

  const cancelRename = useCallback(() => {
    setRenamingId(null);
    setRenameDraft("");
  }, []);

  const toggleSessionMenu = useCallback((sessionId: string) => {
    setPendingDeleteId(null);
    setMenuOpenId((current) => (current === sessionId ? null : sessionId));
  }, []);

  const closeSessionMenu = useCallback(() => {
    setPendingDeleteId(null);
    setMenuOpenId(null);
  }, []);

  if (!rendered) return null;

  const emptyLabel = showArchived
    ? t("sidepanel.history.noArchived")
    : t("sidepanel.history.noRecent");

  const translateDateGroupLabel = (label: string) => {
    switch (label) {
      case "Pinned":
        return t("sidepanel.history.group.pinned");
      case "Today":
        return t("sidepanel.history.group.today");
      case "Yesterday":
        return t("sidepanel.history.group.yesterday");
      case "Last 7 days":
        return t("sidepanel.history.group.last7");
      case "Last 30 days":
        return t("sidepanel.history.group.last30");
      case "Older":
        return t("sidepanel.history.group.older");
      default:
        return label;
    }
  };

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
        aria-label={t("common.history")}
        tabIndex={-1}
        style={
          minDrawerHeight ? { minHeight: `${minDrawerHeight}px` } : undefined
        }
        className={[
          "absolute inset-x-0 bottom-0 flex w-full max-h-[min(74vh,560px)] max-w-full flex-col rounded-t-2xl border border-b-0 border-[#e2d8c9] bg-[#f7f2e9] shadow-[0_-18px_45px_rgba(64,48,31,0.16)] transition-transform duration-200 ease-out",
          visible ? "translate-y-0" : "translate-y-full",
        ].join(" ")}
      >
        <div className="flex items-center justify-between px-3 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#2f261f]">
            <MessageSquare className="size-4" />
            {showArchived
              ? t("sidepanel.history.archivedChats")
              : t("sidepanel.history.chats")}
          </div>
          <div className="flex items-center gap-1">
            <IconButton
              label={
                showArchived
                  ? t("sidepanel.history.showActive")
                  : t("sidepanel.history.showArchived")
              }
              active={showArchived}
              onClick={onToggleShowArchived}
            >
              <Filter className="size-4" />
            </IconButton>
            <IconButton label={t("sidepanel.history.close")} onClick={onClose}>
              <X className="size-4" />
            </IconButton>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {visibleSessions.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-[#6f6254]">
              {emptyLabel}
            </div>
          ) : (
            <div className="space-y-3">
              {DATE_GROUP_ORDER.filter((label) =>
                groupedSessions.has(label)
              ).map((label) => (
                <div key={label}>
                  <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[#6f6254]">
                    {translateDateGroupLabel(label)}
                  </div>
                  <div className="space-y-1">
                    {groupedSessions.get(label)!.map((session) => (
                      <SessionRow
                        key={session.id}
                        session={session}
                        active={session.id === currentSessionId}
                        unread={hasUnreadMessages(session, currentSessionId)}
                        menuOpen={menuOpenId === session.id}
                        pendingDelete={pendingDeleteId === session.id}
                        renaming={renamingId === session.id}
                        renameDraft={renameDraft}
                        onOpenMenu={() => toggleSessionMenu(session.id)}
                        onCloseMenu={closeSessionMenu}
                        onSelect={() => onSelect(session.id)}
                        onRequestRename={() => beginRename(session)}
                        onRenameChange={setRenameDraft}
                        onRenameCommit={() => commitRename(session.id)}
                        onRenameCancel={cancelRename}
                        onTogglePinned={() =>
                          onTogglePinned(
                            session.id,
                            !Boolean(session.pinned)
                          )
                        }
                        onToggleArchived={() =>
                          onToggleArchived(
                            session.id,
                            !Boolean(session.archived)
                          )
                        }
                        onRequestDelete={() => setPendingDeleteId(session.id)}
                        onConfirmDelete={() => {
                          onDelete(session.id);
                          setPendingDeleteId(null);
                          setMenuOpenId(null);
                        }}
                        onCancelDelete={() => setPendingDeleteId(null)}
                      />
                    ))}
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

interface SessionRowProps {
  session: SessionMetadata;
  active: boolean;
  unread: boolean;
  menuOpen: boolean;
  pendingDelete: boolean;
  renaming: boolean;
  renameDraft: string;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
  onSelect: () => void;
  onRequestRename: () => void;
  onRenameChange: (value: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onTogglePinned: () => void;
  onToggleArchived: () => void;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}

const SessionRow: FC<SessionRowProps> = ({
  session,
  active,
  unread,
  menuOpen,
  pendingDelete,
  renaming,
  renameDraft,
  onOpenMenu,
  onCloseMenu,
  onSelect,
  onRequestRename,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
  onTogglePinned,
  onToggleArchived,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
}) => {
  const { t } = useI18n();
  const listDate = getSessionListDate(session);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const displayTitle =
    session.title === DEFAULT_SESSION_TITLE ? t("common.newChat") : session.title;

  useEffect(() => {
    if (!renaming) return;

    const frame = window.requestAnimationFrame(() => {
      const input = renameInputRef.current;
      if (!input) return;

      input.focus({ preventScroll: true });
      input.select();
      input.setSelectionRange(0, input.value.length);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [renaming]);

  return (
    <div
      className={[
        "group flex items-center gap-1 rounded-lg",
        active ? "bg-[#e9dcc7]" : "hover:bg-[#eee7dc]",
      ].join(" ")}
    >
      {renaming ? (
        <div className="flex min-w-0 flex-1 items-center gap-1 px-2 py-1.5">
          <input
            ref={renameInputRef}
            autoFocus
            type="text"
            value={renameDraft}
            onChange={(event) => onRenameChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onRenameCommit();
              } else if (event.key === "Escape") {
                event.preventDefault();
                onRenameCancel();
              }
            }}
            className="min-w-0 flex-1 rounded-md border border-[#d8cfbf] bg-[#fffaf4] px-2 py-1 text-sm text-[#2f261f] shadow-inner focus:border-[#9a4f2c] focus:outline-none focus:ring-1 focus:ring-[#9a4f2c]"
            aria-label={t("sidepanel.history.renameChat")}
          />
          <button
            type="button"
            aria-label={t("sidepanel.history.saveChatName")}
            title={t("common.save")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#2f261f] transition-colors hover:bg-[#e0d3bd]"
            onClick={onRenameCommit}
          >
            <Check className="size-4" />
          </button>
          <button
            type="button"
            aria-label={t("sidepanel.cancelEdit")}
            title={t("common.cancel")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#6f6254] transition-colors hover:bg-[#eee7dc] hover:text-[#2f261f]"
            onClick={onRenameCancel}
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            className="min-w-0 flex-1 px-3 py-2 text-left"
            onClick={onSelect}
          >
            <div className="flex min-w-0 items-center gap-2">
              {session.pinned ? (
                <Pin className="size-3 shrink-0 text-[#9a4f2c]" />
              ) : null}
              <div
                className={[
                  "truncate text-sm text-[#332a22]",
                  unread ? "font-semibold" : "font-medium",
                ].join(" ")}
              >
                {displayTitle}
              </div>
              {unread ? (
                <span className="shrink-0 rounded-full bg-[#2f6fed] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                  {t("common.unread")}
                </span>
              ) : null}
            </div>
            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#6f6254]">
              <span>{t("sidepanel.history.messageCount", { count: session.messageCount })}</span>
              <span className="inline-flex min-w-0 items-center gap-1">
                <SmartMoment dt={listDate} timeTypeLabel={t("sidepanel.history.lastMessage")} />
              </span>
            </div>
          </button>

          <SessionMenu
            session={session}
            open={menuOpen}
            pendingDelete={pendingDelete}
            onOpen={onOpenMenu}
            onClose={onCloseMenu}
            onRename={onRequestRename}
            onTogglePinned={onTogglePinned}
            onToggleArchived={onToggleArchived}
            onRequestDelete={onRequestDelete}
            onConfirmDelete={onConfirmDelete}
            onCancelDelete={onCancelDelete}
          />
        </>
      )}
    </div>
  );
};

interface SessionMenuProps {
  session: SessionMetadata;
  open: boolean;
  pendingDelete: boolean;
  onOpen: () => void;
  onClose: () => void;
  onRename: () => void;
  onTogglePinned: () => void;
  onToggleArchived: () => void;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}

const SessionMenu: FC<SessionMenuProps> = ({
  session,
  open,
  pendingDelete,
  onOpen,
  onClose,
  onRename,
  onTogglePinned,
  onToggleArchived,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
}) => {
  const { t } = useI18n();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const handleClose = useCallback(() => {
    onCancelDelete();
    onClose();
  }, [onCancelDelete, onClose]);

  useOutsideClick(open, wrapperRef, handleClose);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      getFocusableElements(menuRef.current)[0]?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const pinned = Boolean(session.pinned);
  const archived = Boolean(session.archived);
  const menuTitle =
    session.title === DEFAULT_SESSION_TITLE ? t("common.newChat") : session.title;

  return (
    <div ref={wrapperRef} className="relative mr-1 shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-label={t("sidepanel.history.moreActionsFor", { title: menuTitle })}
        title={t("sidepanel.history.moreActions")}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className={[
          "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
          open
            ? "bg-[#e0d3bd] text-[#2f261f]"
            : "text-[#6f6254] opacity-0 hover:bg-[#eee7dc] hover:text-[#2f261f] focus:opacity-100 group-hover:opacity-100",
        ].join(" ")}
        onClick={(event) => {
          event.stopPropagation();
          if (open) {
            handleClose();
            return;
          }

          onOpen();
        }}
      >
        <MoreHorizontal className="size-4" />
      </button>

      {open ? (
        <div
          id={menuId}
          ref={menuRef}
          role="menu"
          aria-label={t("sidepanel.history.chatActions")}
          className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border border-[#d9cfbf] bg-[#fffaf4] shadow-[0_16px_42px_rgba(64,48,31,0.16)]"
          onClick={(event) => event.stopPropagation()}
        >
          <MenuItem
            icon={<Pencil className="size-4 text-[#6f6254]" />}
            label={t("common.rename")}
            onClick={() => {
              onRename();
              handleClose();
            }}
          />
          <MenuItem
            icon={
              pinned ? (
                <PinOff className="size-4 text-[#6f6254]" />
              ) : (
                <Pin className="size-4 text-[#6f6254]" />
              )
            }
            label={pinned ? t("common.unpin") : t("common.pin")}
            onClick={() => {
              onTogglePinned();
              handleClose();
            }}
          />
          <MenuItem
            icon={
              archived ? (
                <ArchiveRestore className="size-4 text-[#6f6254]" />
              ) : (
                <Archive className="size-4 text-[#6f6254]" />
              )
            }
            label={archived ? t("common.unarchive") : t("common.archive")}
            onClick={() => {
              onToggleArchived();
              handleClose();
            }}
          />
          <div className="my-1 h-px bg-[#e7ded0]" />
          {pendingDelete ? (
            <MenuItem
              icon={<Check className="size-4 text-[#a34020]" />}
              label={t("sidepanel.history.clickToConfirm")}
              danger
              onClick={() => {
                onConfirmDelete();
                handleClose();
              }}
            />
          ) : (
            <MenuItem
              icon={<Trash className="size-4 text-[#a34020]" />}
              label={t("common.delete")}
              danger
              onClick={onRequestDelete}
            />
          )}
        </div>
      ) : null}
    </div>
  );
};

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}

const MenuItem: FC<MenuItemProps> = ({ icon, label, danger, onClick }) => (
  <button
    type="button"
    role="menuitem"
    className={[
      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
      danger
        ? "text-[#a34020] hover:bg-[#f4d7cc]"
        : "text-[#3c3027] hover:bg-[#f1e8da]",
    ].join(" ")}
    onClick={onClick}
  >
    {icon}
    <span className="font-medium">{label}</span>
  </button>
);
