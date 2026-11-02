/**
 * agentcomms MCP server.
 *
 * Uses the low-level Server API with explicit JSON-schema literals
 * for tools/list (exact parity with the defined spec); zod still
 * validates every tools/call argument set.
 * Config from env at call time: AGENTTRUST_API_KEY (required),
 * AGENTTRUST_ENDPOINT (optional, default https://agenttrust.ai).
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  comment, context, discover, driveDelete, driveDownload, driveList, driveUpload, driveUsage,
  emailAttachment, emailDraft, emailForward, emailInbox, emailRead, emailReply, emailSend,
  escalate, formatPayload, inbox, reply, resolveConfig, sendMessage, VERSION,
} from "./agentcomms.js";
import type { FetchFn } from "./types.js";

const NoArgs = z.object({});
const EmailInboxArgs = z.object({ direction: z.string().optional(), status: z.string().optional(), limit: z.number().int().optional() });
const EmailReadArgs = z.object({ email_id: z.string(), thread: z.boolean().optional() });
const EmailAttachmentArgs = z.object({ email_id: z.string(), attachment_id: z.string() });
const EmailSendArgs = z.object({ to: z.string(), subject: z.string(), body: z.string() });
const EmailReplyArgs = z.object({ email_id: z.string(), body: z.string() });
const EmailForwardArgs = z.object({ email_id: z.string(), to: z.string(), body: z.string().optional() });
const SendArgs = z.object({ to: z.string(), message: z.string() });
const InboxArgs = z.object({ status: z.string().optional(), limit: z.number().int().optional() });
const TaskIdArgs = z.object({ task_id: z.string() });
const ReplyArgs = z.object({ task_id: z.string(), message: z.string(), status: z.string().optional() });
const CommentArgs = z.object({ task_id: z.string(), comment: z.string() });
const EscalateArgs = z.object({ task_id: z.string(), reason: z.string() });
const DiscoverArgs = z.object({ query: z.string() });
const DriveUploadArgs = z.object({ name: z.string(), content_base64: z.string(), folder: z.string().optional() });
const DriveListArgs = z.object({ folder: z.string().optional() });
const FileIdArgs = z.object({ file_id: z.string() });

const TOOLS = [
  { name: "agenttrust_email_inbox", description: "List emails in the agent inbox, optionally filtered by direction and status, with an optional limit.", inputSchema: { type: "object" as const, properties: { direction: { type: "string", description: "Direction filter, such as inbound or outbound." }, status: { type: "string", description: "Status filter for the listed emails." }, limit: { type: "integer", description: "Maximum number of emails to return." } } } },
  { name: "agenttrust_email_read", description: "Read an email by id, optionally including its thread.", inputSchema: { type: "object" as const, properties: { email_id: { type: "string", description: "Email id to read." }, thread: { type: "boolean", description: "When true, include the email thread." } }, required: ["email_id"] } },
  { name: "agenttrust_email_attachment", description: "Get an attachment of an email by email id and attachment id.", inputSchema: { type: "object" as const, properties: { email_id: { type: "string", description: "Email id the attachment belongs to." }, attachment_id: { type: "string", description: "Attachment id to fetch." } }, required: ["email_id", "attachment_id"] } },
  { name: "agenttrust_email_send", description: "Send an email to a recipient with a subject and body.", inputSchema: { type: "object" as const, properties: { to: { type: "string", description: "Recipient email address." }, subject: { type: "string", description: "Email subject line." }, body: { type: "string", description: "Email body text." } }, required: ["to", "subject", "body"] } },
  { name: "agenttrust_email_reply", description: "Reply to an email by id with a body.", inputSchema: { type: "object" as const, properties: { email_id: { type: "string", description: "Email id to reply to." }, body: { type: "string", description: "Reply body text." } }, required: ["email_id", "body"] } },
  { name: "agenttrust_email_forward", description: "Forward an email by id to a recipient, with an optional body.", inputSchema: { type: "object" as const, properties: { email_id: { type: "string", description: "Email id to forward." }, to: { type: "string", description: "Recipient email address." }, body: { type: "string", description: "Optional note added to the forwarded email." } }, required: ["email_id", "to"] } },
  { name: "agenttrust_email_draft", description: "Create an email draft with a recipient, subject, and body.", inputSchema: { type: "object" as const, properties: { to: { type: "string", description: "Recipient email address." }, subject: { type: "string", description: "Draft subject line." }, body: { type: "string", description: "Draft body text." } }, required: ["to", "subject", "body"] } },
  { name: "agenttrust_send", description: "Send a message to another agent by agent slug.", inputSchema: { type: "object" as const, properties: { to: { type: "string", description: "Recipient agent slug." }, message: { type: "string", description: "Message text to send." } }, required: ["to", "message"] } },
  { name: "agenttrust_inbox", description: "List messages in the agent inbox, optionally filtered by status, with an optional limit.", inputSchema: { type: "object" as const, properties: { status: { type: "string", description: "Status filter for the listed messages." }, limit: { type: "integer", description: "Maximum number of messages to return." } } } },
  { name: "agenttrust_context", description: "Get the context for a task by task id.", inputSchema: { type: "object" as const, properties: { task_id: { type: "string", description: "Task id to get the context for." } }, required: ["task_id"] } },
  { name: "agenttrust_reply", description: "Reply to a task by task id with a message and an optional status.", inputSchema: { type: "object" as const, properties: { task_id: { type: "string", description: "Task id to reply to." }, message: { type: "string", description: "Reply message text." }, status: { type: "string", description: "Optional status to set with the reply." } }, required: ["task_id", "message"] } },
  { name: "agenttrust_comment", description: "Add a comment to a task by task id.", inputSchema: { type: "object" as const, properties: { task_id: { type: "string", description: "Task id to comment on." }, comment: { type: "string", description: "Comment text." } }, required: ["task_id", "comment"] } },
  { name: "agenttrust_escalate", description: "Escalate a task by task id with a reason.", inputSchema: { type: "object" as const, properties: { task_id: { type: "string", description: "Task id to escalate." }, reason: { type: "string", description: "Escalation reason." } }, required: ["task_id", "reason"] } },
  { name: "agenttrust_discover", description: "Discover agents matching a query.", inputSchema: { type: "object" as const, properties: { query: { type: "string", description: "Agent discovery query." } }, required: ["query"] } },
  { name: "agenttrust_drive_upload", description: "Upload a file to cloud storage with a name and base64 content, optionally in a folder.", inputSchema: { type: "object" as const, properties: { name: { type: "string", description: "File name to store the upload under." }, content_base64: { type: "string", description: "File contents, base64-encoded." }, folder: { type: "string", description: "Optional folder to store the file in." } }, required: ["name", "content_base64"] } },
  { name: "agenttrust_drive_list", description: "List files in cloud storage, optionally in a folder.", inputSchema: { type: "object" as const, properties: { folder: { type: "string", description: "Optional folder to list files from." } } } },
  { name: "agenttrust_drive_download", description: "Download a file from cloud storage by file id.", inputSchema: { type: "object" as const, properties: { file_id: { type: "string", description: "File id to download." } }, required: ["file_id"] } },
  { name: "agenttrust_drive_delete", description: "Delete a file from cloud storage by file id.", inputSchema: { type: "object" as const, properties: { file_id: { type: "string", description: "File id to delete." } }, required: ["file_id"] } },
  { name: "agenttrust_drive_usage", description: "Get cloud storage usage.", inputSchema: { type: "object" as const, properties: {} } },
];

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] };
}
function errorResult(err: unknown) {
  return { content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }], isError: true };
}

const server = new Server({ name: "agentcomms", version: VERSION }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const fetchFn = globalThis.fetch as unknown as FetchFn;
  const config = resolveConfig(process.env);
  try {
    let out: unknown;
    switch (name) {
      case "agenttrust_email_inbox": out = await emailInbox(fetchFn, config, EmailInboxArgs.parse(args ?? {})); break;
      case "agenttrust_email_read": out = await emailRead(fetchFn, config, EmailReadArgs.parse(args ?? {})); break;
      case "agenttrust_email_attachment": out = await emailAttachment(fetchFn, config, EmailAttachmentArgs.parse(args ?? {})); break;
      case "agenttrust_email_send": out = await emailSend(fetchFn, config, EmailSendArgs.parse(args ?? {})); break;
      case "agenttrust_email_reply": out = await emailReply(fetchFn, config, EmailReplyArgs.parse(args ?? {})); break;
      case "agenttrust_email_forward": out = await emailForward(fetchFn, config, EmailForwardArgs.parse(args ?? {})); break;
      case "agenttrust_email_draft": out = await emailDraft(fetchFn, config, EmailSendArgs.parse(args ?? {})); break;
      case "agenttrust_send": out = await sendMessage(fetchFn, config, SendArgs.parse(args ?? {})); break;
      case "agenttrust_inbox": out = await inbox(fetchFn, config, InboxArgs.parse(args ?? {})); break;
      case "agenttrust_context": out = await context(fetchFn, config, TaskIdArgs.parse(args ?? {})); break;
      case "agenttrust_reply": out = await reply(fetchFn, config, ReplyArgs.parse(args ?? {})); break;
      case "agenttrust_comment": out = await comment(fetchFn, config, CommentArgs.parse(args ?? {})); break;
      case "agenttrust_escalate": out = await escalate(fetchFn, config, EscalateArgs.parse(args ?? {})); break;
      case "agenttrust_discover": out = await discover(fetchFn, config, DiscoverArgs.parse(args ?? {})); break;
      case "agenttrust_drive_upload": out = await driveUpload(fetchFn, config, DriveUploadArgs.parse(args ?? {})); break;
      case "agenttrust_drive_list": out = await driveList(fetchFn, config, DriveListArgs.parse(args ?? {})); break;
      case "agenttrust_drive_download": out = await driveDownload(fetchFn, config, FileIdArgs.parse(args ?? {})); break;
      case "agenttrust_drive_delete": out = await driveDelete(fetchFn, config, FileIdArgs.parse(args ?? {})); break;
      case "agenttrust_drive_usage": NoArgs.parse(args ?? {}); out = await driveUsage(fetchFn, config); break;
      default: throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    return textResult(formatPayload(out));
  } catch (err) {
    if (err instanceof McpError) throw err;
    return errorResult(err);
  }
});

async function main(): Promise<void> { await server.connect(new StdioServerTransport()); }
void main();
