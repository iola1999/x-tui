from __future__ import annotations

import json

from click.testing import CliRunner

from twitter_cli.cli import cli
from twitter_cli.profiling import CommandProfiler


def test_command_profiler_writes_jsonl_record(tmp_path) -> None:
    profile_path = tmp_path / "profile.jsonl"
    profiler = CommandProfiler(
        enabled=True,
        argv=["search", "openai", "--json"],
        output_path=str(profile_path),
    )

    profiler.mark("phase.ready", step="setup")
    with profiler.span("phase.work", kind="unit-test"):
        pass
    profiler.finish(status="ok")

    lines = profile_path.read_text(encoding="utf-8").strip().splitlines()
    assert len(lines) == 1

    payload = json.loads(lines[0])
    assert payload["status"] == "ok"
    assert payload["argv"] == ["search", "openai", "--json"]
    assert any(event["name"] == "phase.ready" for event in payload["events"])
    assert any(event["name"] == "phase.work" for event in payload["events"])


def test_cli_profile_env_writes_command_record(tmp_path, monkeypatch) -> None:
    profile_path = tmp_path / "cli-profile.jsonl"

    class FakeClient:
        def fetch_user(self, screen_name: str):
            from twitter_cli.models import UserProfile

            return UserProfile(id="1", name="Alice", screen_name=screen_name)

    monkeypatch.setenv("TWITTER_CLI_PROFILE", "1")
    monkeypatch.setenv("TWITTER_CLI_PROFILE_FILE", str(profile_path))
    monkeypatch.setattr("twitter_cli.cli._get_client", lambda config=None, quiet=False: FakeClient())

    runner = CliRunner()
    result = runner.invoke(cli, ["user", "alice", "--json"])

    assert result.exit_code == 0
    lines = profile_path.read_text(encoding="utf-8").strip().splitlines()
    assert len(lines) == 1

    payload = json.loads(lines[0])
    assert payload["command"] == "user"
    assert payload["status"] == "ok"
    assert "module_import_ms" in payload
