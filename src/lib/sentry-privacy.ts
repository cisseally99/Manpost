import type { ErrorEvent } from "@sentry/core";

const sensitiveValuePattern =
  /((?:authorization|cookie|set-cookie|password|passwd|token|secret|api[_-]?key)\s*[:=]\s*)([^\s,;]+)/gi;

function redactSensitiveValues(value: string): string {
  return value.replace(sensitiveValuePattern, "$1[Filtered]");
}

/** Keep diagnostic stack traces while removing request/user data and likely secrets. */
export function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  const safeEvent: ErrorEvent = {
    ...event,
    request: undefined,
    user: undefined,
    extra: undefined,
    contexts: undefined,
    breadcrumbs: undefined,
  };

  if (safeEvent.message) {
    safeEvent.message = redactSensitiveValues(safeEvent.message);
  }

  if (safeEvent.logentry?.message) {
    safeEvent.logentry.message = redactSensitiveValues(
      safeEvent.logentry.message,
    );
  }

  for (const exception of safeEvent.exception?.values ?? []) {
    if (exception.value) {
      exception.value = redactSensitiveValues(exception.value);
    }
  }

  return safeEvent;
}
