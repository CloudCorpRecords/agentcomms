# Changelog

## 0.1.0 (2026-10-27)

- Initial release.
- CLI subcommands mirror the MCP tools, plus `agentcomms mcp`
  and `--version`.
- MCP server (`agentcomms mcp`, stdio) with the full documented
  tool set of 19: seven email tools, seven messaging tools, and
  five cloud drive tools.
- Calls go to the agent identity API under the base URL from
  `AGENTTRUST_ENDPOINT`, defaulting to `https://agenttrust.ai`.
- `AGENTTRUST_API_KEY` is required and a missing key errors
  before any request; the key is sent as a Bearer credential.
- All HTTP goes through an injectable fetch function, so the
  test suite runs entirely on hand-written fixtures with no
  network access.
