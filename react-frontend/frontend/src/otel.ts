import { startBrowserSdk } from '@opentelemetry/browser-sdk';
import {
  createDefaultSessionIdGenerator,
  createLocalStorageSessionStore,
  createSessionLogRecordProcessor,
  createSessionManager,
  createSessionSpanProcessor,
} from '@opentelemetry/browser-sdk/session';
import { browserDetector } from '@opentelemetry/browser-sdk/browser-detector';
import { detectResources } from '@opentelemetry/resources';
import { FetchInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/fetch';
import { XhrInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/xhr';
import { UserActionInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/user-action';
import { WebVitalsInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/web-vitals';
import { ErrorsInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/errors';
import type { Span } from '@opentelemetry/api';
import type { SdkLogRecord } from '@opentelemetry/sdk-logs';
import { getCurrentRoute } from './route-state';

// Replace with an Trace0 ingest API key, from Environment Settings in the Trace0
// dashboard.
const TRACE0_HEADERS = {
  'X-API-KEY': 'YOUR_TRACE0_INGEST_API_KEY',
};

// Holds the current user. Call setUserId() from your login/logout code so
// spans and logs can be filtered and grouped by user in Trace0.
let currentUserId: string | null = null;
export function setUserId(id: string | null): void {
  currentUserId = id;
}

// Tags every span with the current user id, if one is set.
class UserSpanProcessor {
  onStart(span: Span): void {
    if (currentUserId) {
      span.setAttribute('user.id', currentUserId);
    }
  }
  onEnd(): void {}
  forceFlush(): Promise<void> {
    return Promise.resolve();
  }
  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

// Tags every log record (clicks, Web Vitals) with the current user id too.
class UserLogRecordProcessor {
  onEmit(logRecord: SdkLogRecord): void {
    if (currentUserId) {
      logRecord.setAttribute('user.id', currentUserId);
    }
  }
  forceFlush(): Promise<void> {
    return Promise.resolve();
  }
  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

// Tags every log record with app-specific attributes we compute ourselves.
// This is currently just the route template (e.g. "/users/:id"), read from
// route-state.ts rather than location.pathname since the app calculates and
// sets that itself (see App.tsx). Add more attributes here as needed.
class CustomAttributesProcessor {
  onEmit(logRecord: SdkLogRecord): void {
    const route = getCurrentRoute();
    if (route) {
      logRecord.setAttribute('app.route.id', route);
    }
  }
  forceFlush(): Promise<void> {
    return Promise.resolve();
  }
  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

// For testing: simulate a logged-in user with a fresh id on every page load,
// so you can see the user.id attribute on spans/logs in Trace0. In a real
// app, call setUserId() from your actual login/logout flow instead.
setUserId(`user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

// Exclude our own OTLP export calls, otherwise every exported batch would
// create a new fetch span that itself needs exporting, forever.
const IGNORE_OWN_EXPORTS = [/trace0hq\.com\/api\/v1\/(traces|logs)$/];

const sessionManager = createSessionManager({
  sessionIdGenerator: createDefaultSessionIdGenerator(),
  sessionStore: createLocalStorageSessionStore(),
  maxDuration: 4 * 60 * 60, // 4 hours
  inactivityTimeout: 30 * 60, // 30 minutes
});

// Restore or start the session before any instrumentation runs, so the very
// first span/log already carries the right session.id.
await sessionManager.start();

// Detects user agent, language, and (where the UA Client Hints API is
// available) platform/brands/mobile status, merged into every span/log's
// resource. Some of those attributes resolve asynchronously, so wait for
// them before starting the SDK.
const browserResource = detectResources({ detectors: [browserDetector] });
await browserResource.waitForAsyncAttributes?.();

startBrowserSdk({
  serviceName: 'react-frontend',
  resourceAttributes: { ...browserResource.attributes },

  traces: {
    exportConfig: {
      url: 'https://app.trace0hq.com/api/v1/traces',
      headers: TRACE0_HEADERS,
    },
    // Session processor must come before the export processor, which the
    // SDK appends after whatever's listed here — otherwise session.id
    // wouldn't be set yet when a span is handed off for export.
    processors: [createSessionSpanProcessor(sessionManager), new UserSpanProcessor()],
  },

  logs: {
    exportConfig: {
      url: 'https://app.trace0hq.com/api/v1/logs',
      headers: TRACE0_HEADERS,
    },
    processors: [
      createSessionLogRecordProcessor(sessionManager),
      new UserLogRecordProcessor(),
      new CustomAttributesProcessor(),
    ],
  },

  instrumentations: [
    // Creates the span the backend's trace links to via the traceparent header.
    new FetchInstrumentation({ ignoreUrls: IGNORE_OWN_EXPORTS }),
    new XhrInstrumentation({ ignoreUrls: IGNORE_OWN_EXPORTS }),

    // This emits a browser.user_action.click log event per click.
    new UserActionInstrumentation(),

    new WebVitalsInstrumentation(),

    // Emits an exception log event for uncaught errors and unhandled promise
    // rejections. The "Simulate Error" button throws uncaught on purpose so
    // this picks it up.
    new ErrorsInstrumentation(),
  ],
});
