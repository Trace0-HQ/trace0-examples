import json
import logging
import sys
from datetime import datetime, timezone

from opentelemetry import trace


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        # time.strftime (used by the base formatTime) doesn't support %f for microseconds,
        # so build the ISO8601 timestamp via datetime instead.
        timestamp = datetime.fromtimestamp(record.created, tz=timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
        payload = {
            'timestamp': timestamp,
            'level': record.levelname,
            'message': record.getMessage(),
            'logger': record.name,
        }
        if hasattr(record, 'trace_id'):
            payload['trace_id'] = record.trace_id
        if hasattr(record, 'span_id'):
            payload['span_id'] = record.span_id
        if record.exc_info:
            payload['exception'] = self.formatException(record.exc_info)
        return json.dumps(payload)


class TraceContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        ctx = trace.get_current_span().get_span_context()
        if ctx.is_valid:
            record.trace_id = format(ctx.trace_id, '032x')
            record.span_id = format(ctx.span_id, '016x')
        return True


def configure_logging(level: int = logging.INFO) -> None:
    # The Lambda Python runtime preconfigures a root handler that writes plain-text log lines.
    # Replace it rather than adding to it, otherwise every log line would be emitted twice
    # (once plain-text from the runtime's handler and once as JSON from our own handler).
    root_logger = logging.getLogger()
    for existing_handler in root_logger.handlers[:]:
        root_logger.removeHandler(existing_handler)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    handler.addFilter(TraceContextFilter())

    root_logger.addHandler(handler)
    root_logger.setLevel(level)
