/**
 * agentcomms core: an agent-identity platform giving agents an
 * email address, agent-to-agent messaging, and cloud file storage,
 * over a Bearer-authenticated REST API.
 *
 * Auth: AGENTTRUST_API_KEY is required; a missing or blank key is
 * an error raised BEFORE any request is made. The base URL comes
 * from AGENTTRUST_ENDPOINT and defaults to https://agenttrust.ai.
 *
 * Endpoint map (documented reconstruction):
 *   agenttrust_email_inbox      GET    /email/inbox?direction=&status=&limit=
 *   agenttrust_email_read       GET    /email/{email_id}?thread=
 *   agenttrust_email_attachment GET    /email/{email_id}/attachments/{attachment_id}
 *   agenttrust_email_send       POST   /email/send
 *   agenttrust_email_reply      POST   /email/{email_id}/reply
 *   agenttrust_email_forward    POST   /email/{email_id}/forward
 *   agenttrust_email_draft      POST   /email/drafts
 *   agenttrust_send             POST   /messages
 *   agenttrust_inbox            GET    /messages/inbox?status=&limit=
 *   agenttrust_context          GET    /tasks/{task_id}/context
 *   agenttrust_reply            POST   /tasks/{task_id}/reply
 *   agenttrust_comment          POST   /tasks/{task_id}/comments
 *   agenttrust_escalate         POST   /tasks/{task_id}/escalate
 *   agenttrust_discover         GET    /agents/discover?query=
 *   agenttrust_drive_upload     POST   /drive/files
 *   agenttrust_drive_list       GET    /drive/files?folder=
 *   agenttrust_drive_download   GET    /drive/files/{file_id}/download
 *   agenttrust_drive_delete     DELETE /drive/files/{file_id}
 *   agenttrust_drive_usage      GET    /drive/usage
 *
 * All HTTP goes through an injected FetchFn so everything is
 * testable offline with a fake fetch.
 */
import type {
  AgentcommsConfig,
  CommentOptions,
  DiscoverOptions,
  DriveListOptions,
  DriveUploadOptions,
  EmailAttachmentOptions,
  EmailForwardOptions,
  EmailInboxOptions,
  EmailReadOptions,
  EmailReplyOptions,
  EmailSendOptions,
  EscalateOptions,
  FetchFn,
  FileIdOptions,
  InboxOptions,
  ReplyOptions,
  SendOptions,
  TaskIdOptions,
} from "./types.js";

export const VERSION = "0.1.0";
export const DEFAULT_BASE_URL = "https://agenttrust.ai";
export const ENDPOINT_ENV = "AGENTTRUST_ENDPOINT";
export const API_KEY_ENV = "AGENTTRUST_API_KEY";

export function resolveBaseUrl(value?: string): string {
  const v = typeof value === "string" ? value.trim() : "";
  return (v ? v : DEFAULT_BASE_URL).replace(/\/+$/, "");
}

export function resolveConfig(env: {
  [ENDPOINT_ENV]?: string;
  [API_KEY_ENV]?: string;
}): AgentcommsConfig {
  return {
    baseUrl: resolveBaseUrl(env[ENDPOINT_ENV]),
    apiKey: typeof env[API_KEY_ENV] === "string" ? env[API_KEY_ENV].trim() : "",
  };
}

function requireNonEmpty(value: unknown, field: string): string {
  const v = typeof value === "string" ? value.trim() : "";
  if (!v) throw new Error(`${field} must be a non-empty string`);
  return v;
}

function optionalParam(value: unknown): string | undefined {
  const v = typeof value === "string" ? value.trim() : "";
  return v ? v : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function callApi(
  fetchFn: FetchFn,
  config: AgentcommsConfig,
  method: string,
  path: string,
  opts: { query?: Record<string, string>; body?: Record<string, unknown> } = {},
): Promise<unknown> {
  if (!config || typeof config.apiKey !== "string" || !config.apiKey.trim()) {
    throw new Error(`${API_KEY_ENV} is required: set an AgentTrust API key before making requests`);
  }
  let url = `${resolveBaseUrl(config.baseUrl)}${path}`;
  if (opts.query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.query)) params.set(k, v);
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${config.apiKey.trim()}`,
  };
  const init: { method: string; headers: Record<string, string>; body?: string } = { method, headers };
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(opts.body);
  }
  let response;
  try {
    response = await fetchFn(url, init);
  } catch (err) {
    throw new Error(`AgentTrust API request failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!response.ok) {
    let detail = "";
    try {
      const payload: unknown = await response.json();
      if (isRecord(payload)) {
        if (typeof payload.message === "string" && payload.message) detail = `: ${payload.message}`;
        else if (typeof payload.error === "string" && payload.error) detail = `: ${payload.error}`;
      }
    } catch { /* non-JSON error body still reports status */ }
    throw new Error(`AgentTrust API request failed: HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}${detail}`);
  }
  try {
    return await response.json();
  } catch {
    throw new Error("AgentTrust API returned a response that was not valid JSON");
  }
}

function enc(value: string): string { return encodeURIComponent(value); }

// --- Email -------------------------------------------------------------

export async function emailInbox(fetchFn: FetchFn, config: AgentcommsConfig, options: EmailInboxOptions = {}): Promise<unknown> {
  const query: Record<string, string> = {};
  const d = optionalParam(options.direction); if (d) query.direction = d;
  const s = optionalParam(options.status); if (s) query.status = s;
  if (typeof options.limit === "number") query.limit = String(options.limit);
  return callApi(fetchFn, config, "GET", "/email/inbox", { query: Object.keys(query).length ? query : undefined });
}

export async function emailRead(fetchFn: FetchFn, config: AgentcommsConfig, options: EmailReadOptions): Promise<unknown> {
  const query = typeof options.thread === "boolean" ? { thread: String(options.thread) } : undefined;
  return callApi(fetchFn, config, "GET", `/email/${enc(requireNonEmpty(options.email_id, "email_id"))}`, { query });
}

export async function emailAttachment(fetchFn: FetchFn, config: AgentcommsConfig, options: EmailAttachmentOptions): Promise<unknown> {
  return callApi(fetchFn, config, "GET", `/email/${enc(requireNonEmpty(options.email_id, "email_id"))}/attachments/${enc(requireNonEmpty(options.attachment_id, "attachment_id"))}`);
}

export async function emailSend(fetchFn: FetchFn, config: AgentcommsConfig, options: EmailSendOptions): Promise<unknown> {
  const body = { to: requireNonEmpty(options.to, "to"), subject: requireNonEmpty(options.subject, "subject"), body: requireNonEmpty(options.body, "body") };
  return callApi(fetchFn, config, "POST", "/email/send", { body });
}

export async function emailReply(fetchFn: FetchFn, config: AgentcommsConfig, options: EmailReplyOptions): Promise<unknown> {
  const body = { body: requireNonEmpty(options.body, "body") };
  return callApi(fetchFn, config, "POST", `/email/${enc(requireNonEmpty(options.email_id, "email_id"))}/reply`, { body });
}

export async function emailForward(fetchFn: FetchFn, config: AgentcommsConfig, options: EmailForwardOptions): Promise<unknown> {
  const body: Record<string, unknown> = { to: requireNonEmpty(options.to, "to") };
  const b = optionalParam(options.body); if (b) body.body = b;
  return callApi(fetchFn, config, "POST", `/email/${enc(requireNonEmpty(options.email_id, "email_id"))}/forward`, { body });
}

export async function emailDraft(fetchFn: FetchFn, config: AgentcommsConfig, options: EmailSendOptions): Promise<unknown> {
  const body = { to: requireNonEmpty(options.to, "to"), subject: requireNonEmpty(options.subject, "subject"), body: requireNonEmpty(options.body, "body") };
  return callApi(fetchFn, config, "POST", "/email/drafts", { body });
}

// --- Messaging ---------------------------------------------------------

export async function sendMessage(fetchFn: FetchFn, config: AgentcommsConfig, options: SendOptions): Promise<unknown> {
  const body = { to: requireNonEmpty(options.to, "to"), message: requireNonEmpty(options.message, "message") };
  return callApi(fetchFn, config, "POST", "/messages", { body });
}

export async function inbox(fetchFn: FetchFn, config: AgentcommsConfig, options: InboxOptions = {}): Promise<unknown> {
  const query: Record<string, string> = {};
  const s = optionalParam(options.status); if (s) query.status = s;
  if (typeof options.limit === "number") query.limit = String(options.limit);
  return callApi(fetchFn, config, "GET", "/messages/inbox", { query: Object.keys(query).length ? query : undefined });
}

export async function context(fetchFn: FetchFn, config: AgentcommsConfig, options: TaskIdOptions): Promise<unknown> {
  return callApi(fetchFn, config, "GET", `/tasks/${enc(requireNonEmpty(options.task_id, "task_id"))}/context`);
}

export async function reply(fetchFn: FetchFn, config: AgentcommsConfig, options: ReplyOptions): Promise<unknown> {
  const body: Record<string, unknown> = { message: requireNonEmpty(options.message, "message") };
  const s = optionalParam(options.status); if (s) body.status = s;
  return callApi(fetchFn, config, "POST", `/tasks/${enc(requireNonEmpty(options.task_id, "task_id"))}/reply`, { body });
}

export async function comment(fetchFn: FetchFn, config: AgentcommsConfig, options: CommentOptions): Promise<unknown> {
  const body = { comment: requireNonEmpty(options.comment, "comment") };
  return callApi(fetchFn, config, "POST", `/tasks/${enc(requireNonEmpty(options.task_id, "task_id"))}/comments`, { body });
}

export async function escalate(fetchFn: FetchFn, config: AgentcommsConfig, options: EscalateOptions): Promise<unknown> {
  const body = { reason: requireNonEmpty(options.reason, "reason") };
  return callApi(fetchFn, config, "POST", `/tasks/${enc(requireNonEmpty(options.task_id, "task_id"))}/escalate`, { body });
}

export async function discover(fetchFn: FetchFn, config: AgentcommsConfig, options: DiscoverOptions): Promise<unknown> {
  return callApi(fetchFn, config, "GET", "/agents/discover", { query: { query: requireNonEmpty(options.query, "query") } });
}

// --- Drive -------------------------------------------------------------

export async function driveUpload(fetchFn: FetchFn, config: AgentcommsConfig, options: DriveUploadOptions): Promise<unknown> {
  const body: Record<string, unknown> = { name: requireNonEmpty(options.name, "name"), content_base64: requireNonEmpty(options.content_base64, "content_base64") };
  const f = optionalParam(options.folder); if (f) body.folder = f;
  return callApi(fetchFn, config, "POST", "/drive/files", { body });
}

export async function driveList(fetchFn: FetchFn, config: AgentcommsConfig, options: DriveListOptions = {}): Promise<unknown> {
  const f = optionalParam(options.folder);
  return callApi(fetchFn, config, "GET", "/drive/files", { query: f ? { folder: f } : undefined });
}

export async function driveDownload(fetchFn: FetchFn, config: AgentcommsConfig, options: FileIdOptions): Promise<unknown> {
  return callApi(fetchFn, config, "GET", `/drive/files/${enc(requireNonEmpty(options.file_id, "file_id"))}/download`);
}

export async function driveDelete(fetchFn: FetchFn, config: AgentcommsConfig, options: FileIdOptions): Promise<unknown> {
  return callApi(fetchFn, config, "DELETE", `/drive/files/${enc(requireNonEmpty(options.file_id, "file_id"))}`);
}

export async function driveUsage(fetchFn: FetchFn, config: AgentcommsConfig): Promise<unknown> {
  return callApi(fetchFn, config, "GET", "/drive/usage");
}

export function formatPayload(payload: unknown): string {
  return typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
}
