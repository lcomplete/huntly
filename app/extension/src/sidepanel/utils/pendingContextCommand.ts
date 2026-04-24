export type PendingSelectionPageContext = {
  title?: string;
  content?: string;
  url?: string;
  faviconUrl?: string;
  description?: string;
  author?: string;
  siteName?: string;
};

export type PendingSidepanelContextCommand = {
  id: string;
} & (
  | {
      kind: "image";
      source: string;
    }
  | {
      kind: "page-context";
    }
  | {
      kind: "selection";
      page: PendingSelectionPageContext;
    }
);

export function isPendingSelectionPageContext(
  value: unknown
): value is PendingSelectionPageContext {
  return Boolean(
    value &&
      typeof value === "object" &&
      (typeof (value as PendingSelectionPageContext).content === "string" ||
        typeof (value as PendingSelectionPageContext).content === "undefined")
  );
}

export function isPendingSidepanelContextCommand(
  value: unknown
): value is PendingSidepanelContextCommand {
  if (!value || typeof value !== "object") {
    return false;
  }

  const command = value as PendingSidepanelContextCommand;
  if (typeof command.id !== "string" || typeof command.kind !== "string") {
    return false;
  }

  if (command.kind === "image") {
    return typeof command.source === "string";
  }

  if (command.kind === "page-context") {
    return true;
  }

  if (command.kind === "selection") {
    return isPendingSelectionPageContext(command.page);
  }

  return false;
}
