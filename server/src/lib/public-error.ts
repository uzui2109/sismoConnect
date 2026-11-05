const INTERNAL_ERROR_NAMES = new Set(['TypeError', 'RangeError', 'ReferenceError', 'SyntaxError']);

export function publicErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && !INTERNAL_ERROR_NAMES.has(error.name)) {
    const code = (error as { code?: unknown }).code;
    if (code === undefined || code === null) {
      return error.message;
    }
  }
  console.error('[server] internal error:', error);
  return fallback;
}
