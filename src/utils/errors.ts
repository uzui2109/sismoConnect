export function describeError(error: unknown): unknown {
  if (error instanceof Error) {
    const details: Record<string, unknown> = {
      name: error.name,
      message: error.message,
    };
    if (error.stack) details.stack = error.stack;
    const candidate = error as Error & { code?: unknown; cause?: unknown };
    if (candidate.code !== undefined) details.code = candidate.code;
    if (candidate.cause !== undefined) details.cause = describeError(candidate.cause);
    return details;
  }
  if (typeof error === 'object' && error !== null) {
    try {
      return JSON.parse(JSON.stringify(error));
    } catch {
      return String(error);
    }
  }
  return error;
}
