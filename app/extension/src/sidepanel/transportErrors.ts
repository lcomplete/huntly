import type { ChatErrorCode } from "./types";

export class HuntlyChatRequestError extends Error {
  readonly code: ChatErrorCode;
  readonly details?: string;
  readonly retryable: boolean;
  readonly canCompact: boolean;

  constructor(options: {
    code: ChatErrorCode;
    details?: string;
    retryable?: boolean;
    canCompact?: boolean;
    cause?: unknown;
  }) {
    super(options.details || "Chat request failed.");
    this.name = "HuntlyChatRequestError";
    this.code = options.code;
    this.details = options.details;
    this.retryable = options.retryable ?? true;
    this.canCompact = options.canCompact ?? false;

    if (options.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

function toErrorText(error: unknown): string {
  if (error instanceof Error) {
    return error.message || error.name || "Unknown error";
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function isContextOverflowError(error: unknown): boolean {
  const text = toErrorText(error).toLowerCase();
  return [
    "context length",
    "context window",
    "maximum context",
    "prompt is too long",
    "input is too long",
    "too many tokens",
    "max tokens",
    "exceeds the context",
    "maximum number of input tokens",
    "requested tokens",
  ].some((fragment) => text.includes(fragment));
}

function inferErrorCode(error: unknown): ChatErrorCode {
  const text = toErrorText(error).toLowerCase();

  if (isContextOverflowError(error)) {
    return "context-overflow";
  }

  if (
    text.includes("unauthorized") ||
    text.includes("forbidden") ||
    text.includes("invalid api key") ||
    text.includes("authentication") ||
    text.includes("permission")
  ) {
    return "auth";
  }

  if (
    text.includes("quota") ||
    text.includes("rate limit") ||
    text.includes("insufficient credits") ||
    text.includes("billing")
  ) {
    return "quota";
  }

  if (text.includes("timeout") || text.includes("timed out")) {
    return "timeout";
  }

  if (
    text.includes("network") ||
    text.includes("fetch") ||
    text.includes("connection") ||
    text.includes("disconnect")
  ) {
    return "network";
  }

  return "unknown";
}

export function normalizeTransportError(
  error: unknown,
  options?: {
    canCompact?: boolean;
  }
): HuntlyChatRequestError {
  if (error instanceof HuntlyChatRequestError) {
    if (options?.canCompact === undefined) {
      return error;
    }

    return new HuntlyChatRequestError({
      code: error.code,
      details: error.details,
      retryable: error.retryable,
      canCompact: options.canCompact,
      cause: error,
    });
  }

  const code = inferErrorCode(error);
  const retryable = code !== "auth";

  return new HuntlyChatRequestError({
    code,
    details: toErrorText(error),
    retryable,
    canCompact: Boolean(options?.canCompact),
    cause: error,
  });
}
