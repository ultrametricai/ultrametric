#!/usr/bin/env python3
"""Spike helper: live-probe Mercury API surfaces and print URL -> status."""
import json
import subprocess
import sys

URLS = [
    "https://docs.mercury.com",
    "https://docs.mercury.com/reference",
    "https://docs.mercury.com/changelog",
    "https://docs.mercury.com/openapi.json",
    "https://docs.mercury.com/swagger.json",
    "https://docs.mercury.com/llms.txt",
    "https://mercury.com/api",
    "https://mercury.com/developers",
    "https://developers.mercury.com",
    "https://api.mercury.com/api/v1/accounts",
    "https://backend.mercury.com/api/v1/accounts",
    "https://mcp.mercury.com/mcp",
    "https://mcp.mercury.com/.well-known/oauth-protected-resource",
    "https://mcp.mercury.com/.well-known/oauth-authorization-server",
    "https://docs.mercury.com/docs/what-is-mercury-mcp.md",
    "https://docs.mercury.com/docs/connecting-mercury-mcp.md",
    "https://docs.mercury.com/docs/supported-tools-on-mercury-mcp.md",
    "https://docs.mercury.com/reference/sandbox",
    "https://docs.mercury.com/docs/sandbox",
    "https://docs.mercury.com/docs/sandbox.md",
    "https://cli.mercury.com/install.sh",
    "https://github.com/MercuryTechnologies/mercury-cli",
]


def probe(url):
    try:
        out = subprocess.run(
            ["curl", "-s", "-o", "/dev/null", "-w",
             "%{http_code} %{url_effective} %{redirect_url}",
             "-L", "--max-time", "25", url],
            capture_output=True, text=True, timeout=40)
        return out.stdout.strip()
    except Exception as e:  # noqa: BLE001
        return f"ERR {e}"


def main():
    urls = sys.argv[1:] or URLS
    results = {}
    for u in urls:
        r = probe(u)
        results[u] = r
        print(f"{r}    <- {u}", flush=True)
    return results


if __name__ == "__main__":
    main()
