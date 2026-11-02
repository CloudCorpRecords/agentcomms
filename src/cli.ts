#!/usr/bin/env node
/**
 * agentcomms CLI. Subcommands mirror the MCP tool names:
 *   agentcomms agenttrust_email_inbox [--direction in] [--status unread] [--limit 10]
 *   agentcomms agenttrust_email_read --email-id <id> [--thread true]
 *   agentcomms agenttrust_email_send --to <addr> --subject <s> --body <b>
 *   agentcomms agenttrust_send --to <slug> --message <text>
 *   agentcomms agenttrust_drive_upload --name <n> --content-base64 <b64> [--folder <f>]
 *   agentcomms agenttrust_drive_usage
 *   agentcomms mcp
 * Env: AGENTTRUST_API_KEY (required), AGENTTRUST_ENDPOINT (default https://agenttrust.ai).
 * Exit codes: 0 success, 1 API error, 2 usage error.
 */
import {
  comment, context, discover, driveDelete, driveDownload, driveList, driveUpload, driveUsage,
  emailAttachment, emailDraft, emailForward, emailInbox, emailRead, emailReply, emailSend,
  escalate, formatPayload, inbox, reply, resolveConfig, sendMessage, VERSION,
} from "./agentcomms.js";
import type { FetchFn } from "./types.js";

const TOOLS = [
  "agenttrust_email_inbox", "agenttrust_email_read", "agenttrust_email_attachment",
  "agenttrust_email_send", "agenttrust_email_reply", "agenttrust_email_forward", "agenttrust_email_draft",
  "agenttrust_send", "agenttrust_inbox", "agenttrust_context", "agenttrust_reply",
  "agenttrust_comment", "agenttrust_escalate", "agenttrust_discover",
  "agenttrust_drive_upload", "agenttrust_drive_list", "agenttrust_drive_download",
  "agenttrust_drive_delete", "agenttrust_drive_usage",
];

function usage(): never {
  console.error(`Usage:
  agentcomms <tool> [flags]
  agentcomms mcp
  agentcomms --version

Tools: ${TOOLS.join(", ")}

Flags: --email-id <id> --attachment-id <id> --to <v> --subject <s> --body <b>
  --direction <d> --status <s> --limit <n> --thread true|false
  --message <m> --task-id <id> --comment <c> --reason <r> --query <q>
  --name <n> --content-base64 <b64> --folder <f> --file-id <id>`);
  process.exit(2);
}
function flag(rest: string[], name: string): string | undefined {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
}
function reqFlag(rest: string[], name: string): string {
  const v = flag(rest, name);
  if (!v) usage();
  return v;
}
function limitFlag(rest: string[]): number | undefined {
  const v = flag(rest, "--limit");
  return v === undefined ? undefined : Number(v);
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-v") { console.log(VERSION); return; }
  if (cmd === "mcp") { await import("./mcp.js"); return; }
  if (!cmd || !TOOLS.includes(cmd)) usage();
  const fetchFn = globalThis.fetch as unknown as FetchFn;
  const config = resolveConfig(process.env);
  try {
    let out: unknown;
    switch (cmd) {
      case "agenttrust_email_inbox": out = await emailInbox(fetchFn, config, { direction: flag(rest, "--direction"), status: flag(rest, "--status"), limit: limitFlag(rest) }); break;
      case "agenttrust_email_read": out = await emailRead(fetchFn, config, { email_id: reqFlag(rest, "--email-id"), thread: flag(rest, "--thread") === undefined ? undefined : flag(rest, "--thread") === "true" }); break;
      case "agenttrust_email_attachment": out = await emailAttachment(fetchFn, config, { email_id: reqFlag(rest, "--email-id"), attachment_id: reqFlag(rest, "--attachment-id") }); break;
      case "agenttrust_email_send": out = await emailSend(fetchFn, config, { to: reqFlag(rest, "--to"), subject: reqFlag(rest, "--subject"), body: reqFlag(rest, "--body") }); break;
      case "agenttrust_email_reply": out = await emailReply(fetchFn, config, { email_id: reqFlag(rest, "--email-id"), body: reqFlag(rest, "--body") }); break;
      case "agenttrust_email_forward": out = await emailForward(fetchFn, config, { email_id: reqFlag(rest, "--email-id"), to: reqFlag(rest, "--to"), body: flag(rest, "--body") }); break;
      case "agenttrust_email_draft": out = await emailDraft(fetchFn, config, { to: reqFlag(rest, "--to"), subject: reqFlag(rest, "--subject"), body: reqFlag(rest, "--body") }); break;
      case "agenttrust_send": out = await sendMessage(fetchFn, config, { to: reqFlag(rest, "--to"), message: reqFlag(rest, "--message") }); break;
      case "agenttrust_inbox": out = await inbox(fetchFn, config, { status: flag(rest, "--status"), limit: limitFlag(rest) }); break;
      case "agenttrust_context": out = await context(fetchFn, config, { task_id: reqFlag(rest, "--task-id") }); break;
      case "agenttrust_reply": out = await reply(fetchFn, config, { task_id: reqFlag(rest, "--task-id"), message: reqFlag(rest, "--message"), status: flag(rest, "--status") }); break;
      case "agenttrust_comment": out = await comment(fetchFn, config, { task_id: reqFlag(rest, "--task-id"), comment: reqFlag(rest, "--comment") }); break;
      case "agenttrust_escalate": out = await escalate(fetchFn, config, { task_id: reqFlag(rest, "--task-id"), reason: reqFlag(rest, "--reason") }); break;
      case "agenttrust_discover": out = await discover(fetchFn, config, { query: reqFlag(rest, "--query") }); break;
      case "agenttrust_drive_upload": out = await driveUpload(fetchFn, config, { name: reqFlag(rest, "--name"), content_base64: reqFlag(rest, "--content-base64"), folder: flag(rest, "--folder") }); break;
      case "agenttrust_drive_list": out = await driveList(fetchFn, config, { folder: flag(rest, "--folder") }); break;
      case "agenttrust_drive_download": out = await driveDownload(fetchFn, config, { file_id: reqFlag(rest, "--file-id") }); break;
      case "agenttrust_drive_delete": out = await driveDelete(fetchFn, config, { file_id: reqFlag(rest, "--file-id") }); break;
      default: out = await driveUsage(fetchFn, config); break;
    }
    console.log(formatPayload(out));
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
void main();
