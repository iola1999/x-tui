"""Resident JSONL daemon for twitter-cli."""

from __future__ import annotations

import json
import sys
from typing import TYPE_CHECKING

from .auth import get_cookies
from .client import TwitterClient
from .config import load_config
from .exceptions import TwitterError
from .output import error_payload, success_payload
from .search import build_search_query
from .serialization import tweet_to_dict, tweets_to_data, user_profile_to_dict

if TYPE_CHECKING:
    from typing import Any, Callable, Dict, Optional, TextIO


class DaemonState:
    """Holds daemon-scoped state so requests can reuse one client."""

    def __init__(self, client_factory: Optional[Callable[[], TwitterClient]] = None) -> None:
        self._client_factory = client_factory or _default_client_factory
        self._client: Optional[TwitterClient] = None

    def get_client(self) -> TwitterClient:
        if self._client is None:
            self._client = self._client_factory()
        return self._client


def _default_client_factory() -> TwitterClient:
    config = load_config()
    cookies = get_cookies()
    rate_limit_config = config.get("rateLimit")
    return TwitterClient(
        cookies["auth_token"],
        cookies["ct0"],
        rate_limit_config,
        cookie_string=cookies.get("cookie_string"),
    )


def _next_cursor(value: Dict[str, Any]) -> Optional[str]:
    return value.get("nextCursor") or value.get("next_cursor") or value.get("cursor")


def _timeline_payload(tweets: list[Any], next_cursor: Optional[str] = None) -> Dict[str, Any]:
    payload = success_payload(tweets_to_data(tweets))
    if next_cursor:
        payload["pagination"] = {"nextCursor": next_cursor}
    return payload


def _write_payload(action: str, tweet_id: str, **details: Any) -> Dict[str, Any]:
    payload: Dict[str, Any] = {"success": True, "action": action, "id": tweet_id}
    payload.update(details)
    return success_payload(payload)


def handle_daemon_request(state: DaemonState, request: Dict[str, Any]) -> Dict[str, Any]:
    req_id = request.get("id")
    params = request.get("params") or {}
    op = request.get("op")

    try:
        client = state.get_client()

        if op == "whoami":
            return {"id": req_id, "ok": True, "result": success_payload({"user": user_profile_to_dict(client.fetch_me())})}

        if op == "feed":
            count = int(params.get("max") or load_config().get("fetch", {}).get("count", 50))
            tweets, next_cursor = client.fetch_home_timeline(
                count,
                include_promoted=False,
                cursor=params.get("cursor"),
                return_cursor=True,
            )
            return {"id": req_id, "ok": True, "result": _timeline_payload(tweets, next_cursor)}

        if op == "search":
            composed_query = build_search_query(
                str(params.get("query") or ""),
                from_user=params.get("from"),
                lang=params.get("lang"),
                since=params.get("since"),
                until=params.get("until"),
                has=[
                    item
                    for item, enabled in (
                        ("images", params.get("hasImages")),
                        ("links", params.get("hasLinks")),
                    )
                    if enabled
                ]
                or None,
                exclude=["retweets"] if params.get("excludeRetweets") else None,
            )
            tweets = client.fetch_search(
                composed_query,
                int(params.get("max") or load_config().get("fetch", {}).get("count", 50)),
                str(params.get("tab") or "Top"),
            )
            return {"id": req_id, "ok": True, "result": _timeline_payload(tweets, _next_cursor({}))}

        if op == "tweet_head":
            tweet = client.fetch_tweet_head(str(params["id"]))
            return {
                "id": req_id,
                "ok": True,
                "result": success_payload({"tweet": tweet_to_dict(tweet)}),
            }

        if op == "tweet_detail":
            tweets = client.fetch_tweet_detail(
                str(params["id"]),
                int(params.get("max") or load_config().get("fetch", {}).get("count", 50)),
                page_limit=params.get("pageLimit"),
            )
            return {"id": req_id, "ok": True, "result": success_payload(tweets_to_data(tweets))}

        if op == "bookmarks":
            tweets = client.fetch_bookmarks(int(params.get("max") or load_config().get("fetch", {}).get("count", 50)))
            return {"id": req_id, "ok": True, "result": _timeline_payload(tweets)}

        if op == "user_profile":
            profile = client.fetch_user(str(params["handle"]).lstrip("@"))
            return {"id": req_id, "ok": True, "result": success_payload({"user": user_profile_to_dict(profile)})}

        if op == "user_posts":
            handle = str(params["handle"]).lstrip("@")
            profile = client.fetch_user(handle)
            tweets = client.fetch_user_tweets(
                profile.id,
                int(params.get("max") or load_config().get("fetch", {}).get("count", 50)),
            )
            return {"id": req_id, "ok": True, "result": _timeline_payload(tweets)}

        if op == "like":
            tweet_id = str(params["id"])
            client.like_tweet(tweet_id)
            return {"id": req_id, "ok": True, "result": _write_payload("like", tweet_id)}
        if op == "unlike":
            tweet_id = str(params["id"])
            client.unlike_tweet(tweet_id)
            return {"id": req_id, "ok": True, "result": _write_payload("unlike", tweet_id)}
        if op == "retweet":
            tweet_id = str(params["id"])
            client.retweet(tweet_id)
            return {"id": req_id, "ok": True, "result": _write_payload("retweet", tweet_id)}
        if op == "unretweet":
            tweet_id = str(params["id"])
            client.unretweet(tweet_id)
            return {"id": req_id, "ok": True, "result": _write_payload("unretweet", tweet_id)}
        if op == "bookmark":
            tweet_id = str(params["id"])
            client.bookmark_tweet(tweet_id)
            return {"id": req_id, "ok": True, "result": _write_payload("bookmark", tweet_id)}
        if op == "unbookmark":
            tweet_id = str(params["id"])
            client.unbookmark_tweet(tweet_id)
            return {"id": req_id, "ok": True, "result": _write_payload("unbookmark", tweet_id)}
        if op == "follow":
            handle = str(params["handle"]).lstrip("@")
            user_id = client.resolve_user_id(handle)
            client.follow_user(user_id)
            return {"id": req_id, "ok": True, "result": _write_payload("follow", user_id)}
        if op == "unfollow":
            handle = str(params["handle"]).lstrip("@")
            user_id = client.resolve_user_id(handle)
            client.unfollow_user(user_id)
            return {"id": req_id, "ok": True, "result": _write_payload("unfollow", user_id)}
        if op == "post":
            tweet_id = client.create_tweet(
                str(params["text"]),
                reply_to_id=params.get("replyTo"),
                media_ids=list(params.get("images") or []) or None,
            )
            return {"id": req_id, "ok": True, "result": _write_payload("post", tweet_id)}
        if op == "reply":
            tweet_id = client.create_tweet(
                str(params["text"]),
                reply_to_id=str(params["id"]),
                media_ids=list(params.get("images") or []) or None,
            )
            return {"id": req_id, "ok": True, "result": _write_payload("reply", tweet_id, replyTo=str(params["id"]))}
        if op == "quote":
            tweet_id = client.quote_tweet(
                str(params["id"]),
                str(params["text"]),
                media_ids=list(params.get("images") or []) or None,
            )
            return {"id": req_id, "ok": True, "result": _write_payload("quote", tweet_id, quotedId=str(params["id"]))}

        raise RuntimeError("Unsupported daemon op: %s" % op)
    except (TwitterError, RuntimeError, KeyError, ValueError) as exc:
        return {
            "id": req_id,
            "ok": False,
            "error": error_payload("daemon_error", str(exc))["error"],
        }


def run_daemon_loop(infile: TextIO, outfile: TextIO, state: Optional[DaemonState] = None) -> None:
    state = state or DaemonState()
    for raw_line in infile:
        line = raw_line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
        except json.JSONDecodeError as exc:
            response = {"id": None, "ok": False, "error": error_payload("bad_request", str(exc))["error"]}
        else:
            response = handle_daemon_request(state, request)
        outfile.write(json.dumps(response, ensure_ascii=False))
        outfile.write("\n")
        outfile.flush()


def main() -> None:
    run_daemon_loop(sys.stdin, sys.stdout)
