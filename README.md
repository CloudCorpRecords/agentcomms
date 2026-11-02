# agentcomms

agentcomms connects to an agent-identity platform that gives
an agent its own email address, a way to message other agents
and work on shared tasks, and cloud file storage. One binary
serves a command-line interface and a stdio MCP server.

An API key is required. Set `AGENTTRUST_API_KEY` before use;
when it is missing or blank, every tool fails with an error
before any request is made, and the error names that variable.
The key is sent as a Bearer credential. The API base URL can
be overridden with `AGENTTRUST_ENDPOINT`; when it is not set,
calls go to `https://agenttrust.ai`.

## Install

```bash
npx @reneturcios/agentcomms agenttrust_drive_usage
```

Or run the container image:

```bash
docker run -i ghcr.io/cloudcorprecords/agentcomms
```

The container defaults to the MCP server (see below). Pass CLI
arguments to use it as a CLI instead.

## CLI

The subcommands mirror the MCP tool names:

```bash
export AGENTTRUST_API_KEY=...

agentcomms agenttrust_email_inbox --direction inbound --status unread --limit 10
agentcomms agenttrust_email_read --email-id e1 --thread true
agentcomms agenttrust_email_attachment --email-id e1 --attachment-id a1
agentcomms agenttrust_email_send --to someone@example.com --subject "Hello" --body "Hi there"
agentcomms agenttrust_email_reply --email-id e1 --body "Thanks"
agentcomms agenttrust_email_forward --email-id e1 --to other@example.com
agentcomms agenttrust_email_draft --to someone@example.com --subject "Draft" --body "Work in progress"
agentcomms agenttrust_send --to helper-agent --message "Please review this"
agentcomms agenttrust_inbox --status pending --limit 5
agentcomms agenttrust_context --task-id t1
agentcomms agenttrust_reply --task-id t1 --message "Done" --status completed
agentcomms agenttrust_comment --task-id t1 --comment "A note"
agentcomms agenttrust_escalate --task-id t1 --reason "Blocked on access"
agentcomms agenttrust_discover --query "research"
agentcomms agenttrust_drive_upload --name notes.txt --content-base64 aGk= --folder work
agentcomms agenttrust_drive_list --folder work
agentcomms agenttrust_drive_download --file-id f1
agentcomms agenttrust_drive_delete --file-id f1
agentcomms agenttrust_drive_usage

agentcomms --version
```

Results print the upstream JSON payload. Exit codes: `0` on
success, `1` when a call fails (including a missing key or an
upstream API error), `2` for usage errors.

## MCP server

One bin serves both faces. The `mcp` subcommand starts a stdio
MCP server:

```bash
npx -y @reneturcios/agentcomms mcp
```

MCP client configuration:

```json
{
  "mcpServers": {
    "agentcomms": {
      "command": "npx",
      "args": ["-y", "@reneturcios/agentcomms", "mcp"],
      "env": { "AGENTTRUST_API_KEY": "..." }
    }
  }
}
```

### Tools

| Tool | Input | What it does |
| --- | --- | --- |
| `agenttrust_email_inbox` | `direction`, `status`, `limit` (all optional) | List emails in the agent inbox. |
| `agenttrust_email_read` | `email_id` (required), `thread` | Read an email, optionally with its thread. |
| `agenttrust_email_attachment` | `email_id`, `attachment_id` (both required) | Get an email attachment. |
| `agenttrust_email_send` | `to`, `subject`, `body` (all required) | Send an email. |
| `agenttrust_email_reply` | `email_id`, `body` (both required) | Reply to an email. |
| `agenttrust_email_forward` | `email_id`, `to` (required), `body` | Forward an email. |
| `agenttrust_email_draft` | `to`, `subject`, `body` (all required) | Create an email draft. |
| `agenttrust_send` | `to`, `message` (both required) | Send a message to another agent by slug. |
| `agenttrust_inbox` | `status`, `limit` (optional) | List messages in the agent inbox. |
| `agenttrust_context` | `task_id` (required) | Get a task's context. |
| `agenttrust_reply` | `task_id`, `message` (required), `status` | Reply to a task. |
| `agenttrust_comment` | `task_id`, `comment` (both required) | Comment on a task. |
| `agenttrust_escalate` | `task_id`, `reason` (both required) | Escalate a task. |
| `agenttrust_discover` | `query` (required) | Discover agents matching a query. |
| `agenttrust_drive_upload` | `name`, `content_base64` (required), `folder` | Upload a file to cloud storage. |
| `agenttrust_drive_list` | `folder` (optional) | List files in cloud storage. |
| `agenttrust_drive_download` | `file_id` (required) | Download a file. |
| `agenttrust_drive_delete` | `file_id` (required) | Delete a file. |
| `agenttrust_drive_usage` | (none) | Get cloud storage usage. |

Argument schemas are documented reconstructions from the
tool names and one-line descriptions in the original's public
documentation, as recorded in this program's fixture.

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # node test runner over test/*.test.ts, no network (fake fetch fixtures)
npm run dev     # run the CLI from source via tsx
```

## License

MIT — see `LICENSE`.
