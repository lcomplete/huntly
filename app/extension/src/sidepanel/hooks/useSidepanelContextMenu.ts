import { useEffect, useRef } from "react";

import {
  isPendingSidepanelContextCommand,
  type PendingSidepanelContextCommand,
} from "../utils/pendingContextCommand";

type CommandHandler = (
  commands: PendingSidepanelContextCommand[]
) => Promise<string[]>;

/**
 * Wires up the two sources that feed pending context-menu commands into the
 * sidepanel:
 *
 * 1. A runtime message listener for commands dispatched while this sidepanel
 *    is already open.
 * 2. A one-shot consumption of any pending commands enqueued by the
 *    background page before this window opened.
 *
 * The handler is stashed in a ref so the subscription stays mount-once even
 * when the caller passes a fresh callback on every render. Re-subscribing
 * would otherwise double-consume the background-page queue.
 */
export function useSidepanelContextMenu(handleCommands: CommandHandler) {
  const handlerRef = useRef(handleCommands);

  useEffect(() => {
    handlerRef.current = handleCommands;
  }, [handleCommands]);

  useEffect(() => {
    let cancelled = false;

    const handleRuntimeMessage = (
      message: unknown,
      _sender: unknown,
      sendResponse: (response?: unknown) => void
    ) => {
      const typedMessage = message as
        | {
            type?: string;
            payload?: { command?: unknown };
          }
        | undefined;
      if (typedMessage?.type !== "sidepanel_context_menu_command") {
        return undefined;
      }

      const command = typedMessage.payload?.command;
      if (!isPendingSidepanelContextCommand(command)) {
        sendResponse({
          success: false,
          error: "Invalid sidepanel context command.",
        });
        return undefined;
      }

      void handlerRef
        .current([command])
        .then((completedIds) => {
          const completed = completedIds.includes(command.id);
          sendResponse({
            success: completed,
            commandId: completed ? command.id : null,
          });
        })
        .catch((error) => {
          console.error(
            "[useSidepanelContextMenu] Failed to handle command",
            error
          );
          sendResponse({
            success: false,
            error:
              (error as Error)?.message || "Failed to process command",
          });
        });

      return true;
    };

    const consumePending = async () => {
      try {
        const currentWindow = await chrome.windows.getCurrent();
        if (cancelled || typeof currentWindow.id !== "number") {
          return;
        }

        const response = (await chrome.runtime.sendMessage({
          type: "consume_pending_sidepanel_context_commands",
          payload: {
            windowId: currentWindow.id,
          },
        })) as unknown as { commands?: unknown } | undefined;
        const pendingCommands = Array.isArray(response?.commands)
          ? response.commands.filter(isPendingSidepanelContextCommand)
          : [];

        if (!cancelled && pendingCommands.length > 0) {
          await handlerRef.current(pendingCommands);
        }
      } catch (error) {
        if (!cancelled) {
          console.error(
            "[useSidepanelContextMenu] Failed to consume pending commands",
            error
          );
        }
      }
    };

    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    void consumePending();

    return () => {
      cancelled = true;
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
    };
  }, []);
}
