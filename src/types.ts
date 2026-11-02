/**
 * agentcomms types.
 *
 * Shapes are documented reconstructions from the public tool
 * descriptions: email tools address messages by email_id, task
 * tools by task_id, and drive tools by file_id. HTTP access is
 * described by a minimal response surface so tests can inject a
 * fake fetch and never touch the network.
 */

export interface AgentcommsConfig {
  baseUrl: string;
  apiKey: string;
}

export interface EmailInboxOptions {
  direction?: string;
  status?: string;
  limit?: number;
}

export interface EmailReadOptions {
  email_id: string;
  thread?: boolean;
}

export interface EmailAttachmentOptions {
  email_id: string;
  attachment_id: string;
}

export interface EmailSendOptions {
  to: string;
  subject: string;
  body: string;
}

export interface EmailReplyOptions {
  email_id: string;
  body: string;
}

export interface EmailForwardOptions {
  email_id: string;
  to: string;
  body?: string;
}

export interface SendOptions {
  to: string;
  message: string;
}

export interface InboxOptions {
  status?: string;
  limit?: number;
}

export interface TaskIdOptions {
  task_id: string;
}

export interface ReplyOptions {
  task_id: string;
  message: string;
  status?: string;
}

export interface CommentOptions {
  task_id: string;
  comment: string;
}

export interface EscalateOptions {
  task_id: string;
  reason: string;
}

export interface DiscoverOptions {
  query: string;
}

export interface DriveUploadOptions {
  name: string;
  content_base64: string;
  folder?: string;
}

export interface DriveListOptions {
  folder?: string;
}

export interface FileIdOptions {
  file_id: string;
}

/** Minimal HTTP response surface so tests can inject fixtures. */
export interface HttpResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
  json(): Promise<unknown>;
}

export type FetchFn = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    redirect?: string;
  },
) => Promise<HttpResponse>;
