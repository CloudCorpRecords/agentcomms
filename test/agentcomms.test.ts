import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  comment, context, discover, driveDelete, driveDownload, driveList, driveUpload, driveUsage,
  emailAttachment, emailDraft, emailForward, emailInbox, emailRead, emailReply, emailSend,
  escalate, inbox, reply, resolveBaseUrl, resolveConfig, sendMessage,
} from "../src/agentcomms.js";
import type { AgentcommsConfig, FetchFn, HttpResponse } from "../src/types.js";

function jsonResponse(body: unknown, status = 200, statusText = "OK"): HttpResponse {
  return {
    ok: status >= 200 && status < 300, status, statusText,
    headers: { get: () => "application/json" },
    text: async () => JSON.stringify(body),
    json: async () => body,
  };
}
interface Captured { url?: string; method?: string; headers?: Record<string, string>; body?: string; calls: number; }
function fakeFetch(body: unknown = {}): { fetchFn: FetchFn; captured: Captured } {
  const captured: Captured = { calls: 0 };
  const fetchFn: FetchFn = async (url, init) => {
    captured.calls += 1; captured.url = url; captured.method = init?.method; captured.headers = init?.headers; captured.body = init?.body;
    return jsonResponse(body);
  };
  return { fetchFn, captured };
}
const BASE = "https://agenttrust.ai";
const CFG: AgentcommsConfig = { baseUrl: BASE, apiKey: "test-key" };

describe("config resolution", () => {
  it("defaults base URL, strips trailing slashes, resolves env", () => {
    assert.equal(resolveBaseUrl(undefined), BASE);
    assert.equal(resolveBaseUrl("  "), BASE);
    assert.equal(resolveBaseUrl("https://example.test/api/"), "https://example.test/api");
    const cfg = resolveConfig({ AGENTTRUST_API_KEY: " k ", AGENTTRUST_ENDPOINT: "https://x.test/" });
    assert.equal(cfg.apiKey, "k"); assert.equal(cfg.baseUrl, "https://x.test");
  });
});

describe("missing key gate", () => {
  it("errors BEFORE any request when key missing (spy)", async () => {
    let called = false;
    const spy: FetchFn = async () => { called = true; return jsonResponse({}); };
    const noKey: AgentcommsConfig = { baseUrl: BASE, apiKey: "" };
    await assert.rejects(() => driveUsage(spy, noKey), /AGENTTRUST_API_KEY is required/);
    await assert.rejects(() => emailSend(spy, noKey, { to: "a@b.c", subject: "s", body: "b" }), /AGENTTRUST_API_KEY is required/);
    assert.equal(called, false);
  });
  it("sends Bearer header", async () => {
    const { fetchFn, captured } = fakeFetch({ ok: true });
    await driveUsage(fetchFn, CFG);
    assert.equal(captured.headers?.Authorization, "Bearer test-key");
  });
});

describe("email", () => {
  it("email_inbox hits /email/inbox with direction/status/limit", async () => {
    const { fetchFn, captured } = fakeFetch([]);
    await emailInbox(fetchFn, CFG, { direction: "inbound", status: "unread", limit: 5 });
    assert.equal(captured.method, "GET");
    const u = new URL(captured.url ?? "");
    assert.equal(u.pathname, "/email/inbox");
    assert.equal(u.searchParams.get("direction"), "inbound");
    assert.equal(u.searchParams.get("status"), "unread");
    assert.equal(u.searchParams.get("limit"), "5");
  });
  it("email_inbox without filters has no query", async () => {
    const { fetchFn, captured } = fakeFetch([]);
    await emailInbox(fetchFn, CFG, {});
    assert.equal(captured.url, `${BASE}/email/inbox`);
  });
  it("email_read hits /email/{id} with thread flag", async () => {
    const { fetchFn, captured } = fakeFetch({ id: "e1" });
    await emailRead(fetchFn, CFG, { email_id: "e1", thread: true });
    const u = new URL(captured.url ?? "");
    assert.equal(u.pathname, "/email/e1"); assert.equal(u.searchParams.get("thread"), "true");
  });
  it("email_attachment hits nested path", async () => {
    const { fetchFn, captured } = fakeFetch({});
    await emailAttachment(fetchFn, CFG, { email_id: "e1", attachment_id: "a1" });
    assert.equal(captured.url, `${BASE}/email/e1/attachments/a1`);
  });
  it("email_send POSTs to/subject/body and returns payload in one call", async () => {
    const payload = { id: "e9", status: "sent" };
    const { fetchFn, captured } = fakeFetch(payload);
    const out = await emailSend(fetchFn, CFG, { to: "x@y.z", subject: "hi", body: "hello" });
    assert.deepEqual(out, payload); assert.equal(captured.calls, 1);
    assert.equal(captured.method, "POST"); assert.equal(captured.url, `${BASE}/email/send`);
    assert.deepEqual(JSON.parse(captured.body ?? "{}"), { to: "x@y.z", subject: "hi", body: "hello" });
  });
  it("email_reply and email_forward POST to their paths", async () => {
    const a = fakeFetch({}); await emailReply(a.fetchFn, CFG, { email_id: "e1", body: "thanks" });
    assert.equal(a.captured.url, `${BASE}/email/e1/reply`);
    assert.deepEqual(JSON.parse(a.captured.body ?? "{}"), { body: "thanks" });
    const b = fakeFetch({}); await emailForward(b.fetchFn, CFG, { email_id: "e1", to: "z@y.x" });
    assert.equal(b.captured.url, `${BASE}/email/e1/forward`);
    assert.deepEqual(JSON.parse(b.captured.body ?? "{}"), { to: "z@y.x" });
    const c = fakeFetch({}); await emailForward(c.fetchFn, CFG, { email_id: "e1", to: "z@y.x", body: "fyi" });
    assert.deepEqual(JSON.parse(c.captured.body ?? "{}"), { to: "z@y.x", body: "fyi" });
  });
  it("email_draft POSTs to /email/drafts", async () => {
    const { fetchFn, captured } = fakeFetch({ id: "d1" });
    await emailDraft(fetchFn, CFG, { to: "x@y.z", subject: "draft", body: "wip" });
    assert.equal(captured.method, "POST"); assert.equal(captured.url, `${BASE}/email/drafts`);
  });
  it("blank required fields rejected before request", async () => {
    const { fetchFn, captured } = fakeFetch({});
    await assert.rejects(() => emailSend(fetchFn, CFG, { to: " ", subject: "s", body: "b" }), /to/);
    await assert.rejects(() => emailRead(fetchFn, CFG, { email_id: "" }), /email_id/);
    assert.equal(captured.calls, 0);
  });
});

describe("messaging", () => {
  it("send POSTs to/message", async () => {
    const { fetchFn, captured } = fakeFetch({ task_id: "t1" });
    await sendMessage(fetchFn, CFG, { to: "helper-agent", message: "do it" });
    assert.equal(captured.method, "POST"); assert.equal(captured.url, `${BASE}/messages`);
    assert.deepEqual(JSON.parse(captured.body ?? "{}"), { to: "helper-agent", message: "do it" });
  });
  it("inbox hits /messages/inbox with status/limit", async () => {
    const { fetchFn, captured } = fakeFetch([]);
    await inbox(fetchFn, CFG, { status: "pending", limit: 3 });
    const u = new URL(captured.url ?? "");
    assert.equal(u.pathname, "/messages/inbox");
    assert.equal(u.searchParams.get("status"), "pending"); assert.equal(u.searchParams.get("limit"), "3");
  });
  it("context hits /tasks/{id}/context", async () => {
    const { fetchFn, captured } = fakeFetch({});
    await context(fetchFn, CFG, { task_id: "t1" });
    assert.equal(captured.url, `${BASE}/tasks/t1/context`);
  });
  it("reply POSTs message and optional status", async () => {
    const { fetchFn, captured } = fakeFetch({});
    await reply(fetchFn, CFG, { task_id: "t1", message: "done", status: "completed" });
    assert.equal(captured.url, `${BASE}/tasks/t1/reply`);
    assert.deepEqual(JSON.parse(captured.body ?? "{}"), { message: "done", status: "completed" });
  });
  it("comment and escalate POST bodies", async () => {
    const a = fakeFetch({}); await comment(a.fetchFn, CFG, { task_id: "t1", comment: "note" });
    assert.equal(a.captured.url, `${BASE}/tasks/t1/comments`);
    assert.deepEqual(JSON.parse(a.captured.body ?? "{}"), { comment: "note" });
    const b = fakeFetch({}); await escalate(b.fetchFn, CFG, { task_id: "t1", reason: "blocked" });
    assert.equal(b.captured.url, `${BASE}/tasks/t1/escalate`);
    assert.deepEqual(JSON.parse(b.captured.body ?? "{}"), { reason: "blocked" });
  });
  it("discover GETs with query param", async () => {
    const { fetchFn, captured } = fakeFetch([]);
    await discover(fetchFn, CFG, { query: "research" });
    const u = new URL(captured.url ?? "");
    assert.equal(u.pathname, "/agents/discover"); assert.equal(u.searchParams.get("query"), "research");
  });
});

describe("drive", () => {
  it("drive_upload POSTs name/content/folder", async () => {
    const { fetchFn, captured } = fakeFetch({ file_id: "f1" });
    await driveUpload(fetchFn, CFG, { name: "a.txt", content_base64: "aGk=", folder: "work" });
    assert.equal(captured.method, "POST"); assert.equal(captured.url, `${BASE}/drive/files`);
    assert.deepEqual(JSON.parse(captured.body ?? "{}"), { name: "a.txt", content_base64: "aGk=", folder: "work" });
  });
  it("drive_list with and without folder", async () => {
    const a = fakeFetch([]); await driveList(a.fetchFn, CFG, { folder: "work" });
    assert.equal(new URL(a.captured.url ?? "").searchParams.get("folder"), "work");
    const b = fakeFetch([]); await driveList(b.fetchFn, CFG, {});
    assert.equal(b.captured.url, `${BASE}/drive/files`);
  });
  it("drive_download, delete, usage paths/methods", async () => {
    const a = fakeFetch({}); await driveDownload(a.fetchFn, CFG, { file_id: "f1" });
    assert.equal(a.captured.url, `${BASE}/drive/files/f1/download`);
    const b = fakeFetch({}); await driveDelete(b.fetchFn, CFG, { file_id: "f1" });
    assert.equal(b.captured.method, "DELETE"); assert.equal(b.captured.url, `${BASE}/drive/files/f1`);
    const c = fakeFetch({ used: 10 }); const out = await driveUsage(c.fetchFn, CFG);
    assert.equal(c.captured.url, `${BASE}/drive/usage`); assert.deepEqual(out, { used: 10 });
  });
  it("custom base URL honoured", async () => {
    const { fetchFn, captured } = fakeFetch({});
    await driveUsage(fetchFn, { baseUrl: "https://example.test/api/", apiKey: "t" });
    assert.equal(captured.url, "https://example.test/api/drive/usage");
  });
});

describe("errors", () => {
  it("HTTP 401 surfaces status and upstream message", async () => {
    const failing: FetchFn = async () => jsonResponse({ message: "bad key" }, 401, "Unauthorized");
    await assert.rejects(() => driveUsage(failing, CFG), /HTTP 401.*bad key/);
  });
  it("network failure wrapped", async () => {
    const failing: FetchFn = async () => { throw new Error("socket hang up"); };
    await assert.rejects(() => driveUsage(failing, CFG), /AgentTrust API request failed: socket hang up/);
  });
});
