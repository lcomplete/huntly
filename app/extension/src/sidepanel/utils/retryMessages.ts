import type { HuntlyUIMessage } from "../useHuntlyChat";

export function prepareMessagesForRetry(
  messages: HuntlyUIMessage[]
): HuntlyUIMessage[] {
  let lastUserIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user") {
      lastUserIndex = index;
      break;
    }
  }

  return lastUserIndex === -1 ? [] : messages.slice(0, lastUserIndex + 1);
}
