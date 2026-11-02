# agentcomms — Build Report

MCP Rebuild 1000. Clean-room rebuild of agenttrust/mcp-server
(MCP Registry rank 199, 1 star), built from the public README
spec captured in
`harness/fixtures/agenttrust-mcp-server-tools-original.json`.
That fixture is docs-derived: the tools are the full documented
set of 19 and the argument schemas are documented
reconstructions from the tool names and one-line descriptions —
no original server was probed. Parity proves the rebuild
matches this program's defined spec, labelled docs-derived.
Local build only — nothing pushed or published.

Identity: repo `agentcomms`, npm `@reneturcios/agentcomms`,
MCP name `io.github.CloudCorpRecords/agentcomms`, version `0.1.0`.

## Files created (19/19 per TEMPLATE.md checklist)

- `package.json` — bin `agentcomms: dist/cli.js`, `mcpName` set,
  scripts build=`tsc` / dev=`tsx src/cli.ts` / test=`tsx --test test/*.test.ts`
- `server.json` — description "Agent email, agent-to-agent
  messaging, and cloud file storage for AI agents."
  = **76 chars** (≤100 ✓); npm entry carries `version: 0.1.0`;
  OCI entry `ghcr.io/cloudcorprecords/agentcomms:0.1.0` carries
  **no** `version` field (verified programmatically)
- `Dockerfile` — node:20-alpine two-stage, ENTRYPOINT
  `node /app/dist/cli.js`, CMD `mcp`, label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/agentcomms"`
- `tsconfig.json` (identical to the fleet template), `.gitignore`,
  `LICENSE` (MIT, Copyright (c) 2026 Rene Turcios), `README.md`
  (fresh text), `CHANGELOG.md` (single 0.1.0 entry, 2026-10-27)
- `src/index.ts`, `src/cli.ts` (subcommands mirror the tool
  names, plus `mcp` and `--version`; exit 2 usage / 1 API error),
  `src/mcp.ts`, `src/types.ts`, `src/agentcomms.ts` (core logic,
  `VERSION = "0.1.0"`)
- `test/agentcomms.test.ts`
- `.github/workflows/{ci,publish,publish-container,registry-publish}.yml`
  (from the fleet template; image name and smoke-test server name
  changed to agentcomms)

## Tools implemented (19)

Email (7): `agenttrust_email_inbox`, `agenttrust_email_read`,
`agenttrust_email_attachment`, `agenttrust_email_send`,
`agenttrust_email_reply`, `agenttrust_email_forward`,
`agenttrust_email_draft`.
Messaging (7): `agenttrust_send`, `agenttrust_inbox`,
`agenttrust_context`, `agenttrust_reply`, `agenttrust_comment`,
`agenttrust_escalate`, `agenttrust_discover`.
Drive (5): `agenttrust_drive_upload`, `agenttrust_drive_list`,
`agenttrust_drive_download`, `agenttrust_drive_delete`,
`agenttrust_drive_usage` — the full documented set as enumerated
in the task spec, as recorded in the fixture `_source`.

## Implementation notes

- `src/mcp.ts` uses the SDK's low-level `Server` with explicit
  inputSchema literals, per the standing fleet rule. Zod still
  validates every `tools/call`.
- Schemas are documented reconstructions (labelled): email inbox
  takes optional `direction`, `status`, and integer `limit`;
  email read takes `email_id` plus optional boolean `thread`;
  messaging inbox takes optional `status` and integer `limit`;
  reply tools carry their documented required fields plus the
  optional `status` on `agenttrust_reply` and optional `body`
  on `agenttrust_email_forward`; drive usage takes no arguments.
- Endpoints under the base URL (env `AGENTTRUST_ENDPOINT`,
  default `https://agenttrust.ai`, trailing slashes stripped)
  follow the map in the `src/agentcomms.ts` header: `/email/*`,
  `/messages` and `/messages/inbox`, `/tasks/{id}/*`,
  `/agents/discover`, and `/drive/*`. Path and method choices
  are reconstructions, labelled as such.
- Auth: `AGENTTRUST_API_KEY` is required. A missing or blank key
  raises an error naming `AGENTTRUST_API_KEY` **before any
  request is made** (a spy test proves the fetch is never
  called). The key is sent as `Authorization: Bearer <key>`.
- HTTP failures surface the status plus the upstream `message`
  or `error` string when present.
- All HTTP flows through an injectable `FetchFn` (types.ts). The
  test suite uses a fake fetch returning hand-written fixtures;
  no live call is made in tests.

## Verification (foreground, exact outputs)

### 1. Build
```
$ ./node_modules/.bin/tsc ; echo exit=$?
tsc exit=0
```
`dist/` produced, including `dist/cli.js`.

### 2. Tests
```
$ ./node_modules/.bin/tsx --test test/*.test.ts
ℹ tests 23
ℹ pass 23
ℹ fail 0
```
Covers: base-URL default/custom/trailing-slash handling and
config resolution; the missing-key-before-request spy test
(fetch never called) and the Bearer header; email inbox query
params, read/thread, attachment path, send POST body in exactly
one call, reply/forward/draft paths and bodies, and blank-field
rejection; messaging send/inbox/context/reply/comment/escalate/
discover paths, methods, and bodies; drive upload/list/download/
delete/usage paths and methods; custom base URL; HTTP 401
surfacing the upstream message; network failure wrapping.

### 3. CLI / MCP smoke
`--version` → `0.1.0` (exit 0); unknown command exits 2 with
Usage. MCP `initialize` over stdio → `serverInfo:
{"name":"agentcomms","version":"0.1.0"}`; `tools/list` returned
19 tools; a stdio `tools/call` for `agenttrust_drive_usage`
with no key in the environment returned an `isError` result
naming `AGENTTRUST_API_KEY` — the missing-key gate, exercised
end to end with no live call made and none claimed.

### 4. Parity (harness, from ~/workspace/mcp-rebuild-100/harness/)
```
$ python3 parity.py --original fixtures/agenttrust-mcp-server-tools-original.json \
    --rebuild "stdio:node .../builds/agentcomms/dist/cli.js mcp" \
    --out /tmp/agentcomms-parity
verdict=PASS parity_pct=100.0 original_tools=19 rebuild_tools=19 missing=[] extra=[] schema_diffs=[]
(exit 0)
```
(parity.json: identical_tools 19/19.) Original side is tools-file
mode, so `fixture_results` records `SKIPPED-TOOLS-FILE-MODE` —
expected harness semantics, not an error. The passing run wrote
to /tmp and its parity.json/parity.md were copied into
`parity-out/` and verified non-empty.

## Lockfile status

`package-lock.json` was generated clean via Route 3: a temp copy
holding only `package.json` (no `node_modules`), offline
`npm install --package-lock-only --ignore-scripts`, verified
after generation — parses as JSON, top-level `name` is
`@reneturcios/agentcomms`, version `0.1.0`, `lockfileVersion` 3,
128 package entries — then only the lockfile was copied back.
Local `node_modules` is a sibling copy (sociallens) used only
for the local build/test; it is not part of the lockfile
generation.

## Gaps / honest notes

- Docs-derived spec: the argument schemas, endpoint paths and
  methods, and the base URL default (`https://agenttrust.ai`
  from `AGENTTRUST_ENDPOINT`) are documented reconstructions
  from the tool names and one-line descriptions, per the task
  spec — no original agenttrust server was probed, so parity
  proves the rebuild matches this program's defined spec, not
  a hand-probed original.
- No live call was made: every endpoint is fake-fetch tested
  only, so live payload/response-shape drift against
  agenttrust.ai is unverified until the publish wave.
- Container build not exercised locally; the publish-container
  workflow smoke-tests the image at publish time.
