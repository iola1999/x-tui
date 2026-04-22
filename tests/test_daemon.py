from __future__ import annotations

import io
import json

from twitter_cli.daemon import DaemonState, handle_daemon_request, run_daemon_loop
from twitter_cli.models import UserProfile


def test_handle_daemon_request_reuses_client(tweet_factory) -> None:
    factory_calls = []

    class FakeClient:
        def fetch_tweet_head(self, tweet_id: str):
            assert tweet_id == "42"
            return tweet_factory("42")

        def fetch_tweet_detail(self, tweet_id: str, count: int, page_limit=None):
            assert tweet_id == "42"
            assert count == 20
            assert page_limit == 1
            return [tweet_factory("42"), tweet_factory("43")]

    def factory():
        factory_calls.append(True)
        return FakeClient()

    state = DaemonState(factory)

    head = handle_daemon_request(
        state,
        {"id": "1", "op": "tweet_head", "params": {"id": "42"}},
    )
    detail = handle_daemon_request(
        state,
        {"id": "2", "op": "tweet_detail", "params": {"id": "42", "max": 20, "pageLimit": 1}},
    )

    assert head["ok"] is True
    assert head["result"]["data"]["tweet"]["id"] == "42"
    assert detail["ok"] is True
    assert detail["result"]["data"][0]["id"] == "42"
    assert factory_calls == [True]


def test_run_daemon_loop_writes_jsonl_response() -> None:
    class FakeClient:
        def fetch_me(self):
            return UserProfile(id="1", name="Alice", screen_name="alice")

    state = DaemonState(lambda: FakeClient())
    infile = io.StringIO(json.dumps({"id": "7", "op": "whoami", "params": {}}) + "\n")
    outfile = io.StringIO()

    run_daemon_loop(infile, outfile, state)

    lines = outfile.getvalue().strip().splitlines()
    assert len(lines) == 1
    payload = json.loads(lines[0])
    assert payload["id"] == "7"
    assert payload["ok"] is True
    assert payload["result"]["data"]["user"]["screenName"] == "alice"
