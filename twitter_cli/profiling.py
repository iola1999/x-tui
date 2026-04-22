"""Lightweight opt-in profiling for twitter-cli command runs."""

from __future__ import annotations

import json
import os
import sys
import time
from contextlib import contextmanager
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from typing import Any, Dict, Iterator, List, Optional

_TRUTHY = {"1", "true", "yes", "on"}


def _env_flag_enabled(name: str) -> bool:
    value = os.environ.get(name, "").strip().lower()
    return value in _TRUTHY


def _guess_command(argv: List[str]) -> Optional[str]:
    for token in argv:
        if not token.startswith("-"):
            return token
    return None


class NullProfiler:
    """No-op profiler used when profiling is disabled."""

    enabled = False

    def mark(self, name: str, **fields: Any) -> None:
        del name, fields

    @contextmanager
    def span(self, name: str, **fields: Any) -> Iterator[None]:
        del name, fields
        yield

    def set_field(self, key: str, value: Any) -> None:
        del key, value

    def finish(self, status: str = "ok", **fields: Any) -> None:
        del status, fields


class CommandProfiler:
    """Collect timing events for a single CLI invocation."""

    def __init__(
        self,
        *,
        enabled: bool,
        argv: List[str],
        output_path: Optional[str] = None,
        command: Optional[str] = None,
    ) -> None:
        self.enabled = enabled
        self.argv = list(argv)
        self.output_path = output_path
        self.command = command or _guess_command(self.argv)
        self._started_at = time.perf_counter()
        self._events: List[Dict[str, Any]] = []
        self._fields: Dict[str, Any] = {}
        self._finished = False

    def _elapsed_ms(self) -> float:
        return round((time.perf_counter() - self._started_at) * 1000, 3)

    def mark(self, name: str, **fields: Any) -> None:
        if not self.enabled or self._finished:
            return
        event: Dict[str, Any] = {"type": "mark", "name": name, "at_ms": self._elapsed_ms()}
        event.update(fields)
        self._events.append(event)

    @contextmanager
    def span(self, name: str, **fields: Any) -> Iterator[None]:
        if not self.enabled or self._finished:
            yield
            return

        start = time.perf_counter()
        error_name: Optional[str] = None
        try:
            yield
        except Exception as exc:  # pragma: no cover - exercised in callers
            error_name = type(exc).__name__
            raise
        finally:
            event: Dict[str, Any] = {
                "type": "span",
                "name": name,
                "start_ms": round((start - self._started_at) * 1000, 3),
                "duration_ms": round((time.perf_counter() - start) * 1000, 3),
            }
            if error_name:
                event["error"] = error_name
            event.update(fields)
            self._events.append(event)

    def set_field(self, key: str, value: Any) -> None:
        if not self.enabled or self._finished:
            return
        self._fields[key] = value

    def finish(self, status: str = "ok", **fields: Any) -> None:
        if not self.enabled or self._finished:
            return

        self._finished = True
        payload: Dict[str, Any] = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "pid": os.getpid(),
            "argv": self.argv,
            "command": self.command,
            "status": status,
            "total_ms": self._elapsed_ms(),
            "events": self._events,
        }
        payload.update(self._fields)
        payload.update(fields)

        if self.output_path:
            path = Path(self.output_path)
            path.parent.mkdir(parents=True, exist_ok=True)
            with path.open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(payload, ensure_ascii=True))
                handle.write("\n")
            return

        sys.stderr.write("[twitter-cli profile] %s\n" % json.dumps(payload, ensure_ascii=True))


_ACTIVE_PROFILER: CommandProfiler | NullProfiler = NullProfiler()


def profiling_enabled() -> bool:
    return _env_flag_enabled("TWITTER_CLI_PROFILE") or bool(
        os.environ.get("TWITTER_CLI_PROFILE_FILE", "").strip()
    )


def start_command_profiler(argv: List[str], *, module_import_ms: Optional[float] = None) -> None:
    global _ACTIVE_PROFILER

    if not profiling_enabled():
        _ACTIVE_PROFILER = NullProfiler()
        return

    _ACTIVE_PROFILER = CommandProfiler(
        enabled=True,
        argv=argv,
        output_path=os.environ.get("TWITTER_CLI_PROFILE_FILE", "").strip() or None,
    )
    if module_import_ms is not None:
        _ACTIVE_PROFILER.set_field("module_import_ms", round(module_import_ms, 3))


def get_profiler() -> CommandProfiler | NullProfiler:
    return _ACTIVE_PROFILER


def finish_active_profiler(status: str = "ok", **fields: Any) -> None:
    _ACTIVE_PROFILER.finish(status=status, **fields)
