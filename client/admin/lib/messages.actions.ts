"use server";

import { requireTeam } from "@/lib/auth/get-user";
import { adminFetch, type ApiResult } from "./menu/api";
import {
  REPLY_MAX,
  type BulkAction,
  type MessageCounts,
  type MessageDetail,
  type MessageFilters,
  type MessageFolder,
  type MessagesPage,
} from "./messages";

const OBJECT_ID = /^[0-9a-f]{24}$/i;
const VIEWS = ["inbox", "unread", "starred", "archived", "spam"];
const FOLDERS: MessageFolder[] = ["inbox", "archived", "spam"];
const ACTIONS: BulkAction[] = [
  "read",
  "unread",
  "star",
  "unstar",
  "archive",
  "inbox",
  "spam",
  "delete",
];
const notFound = {
  ok: false as const,
  status: 404,
  message: "This message no longer exists.",
};

export async function fetchMessages(
  filters: MessageFilters,
): Promise<ApiResult<MessagesPage>> {
  await requireTeam("content:manage");
  const query = new URLSearchParams();
  if (VIEWS.includes(filters.view)) query.set("view", filters.view);
  if (filters.q?.trim()) query.set("q", filters.q.trim().slice(0, 80));
  if (filters.subject?.trim())
    query.set("subject", filters.subject.trim().slice(0, 80));
  if (filters.page && filters.page > 1)
    query.set("page", String(Math.min(1000, Math.floor(filters.page))));
  return adminFetch<MessagesPage>("/admin/messages", { query });
}

export async function fetchMessage(
  id: string,
): Promise<ApiResult<MessageDetail>> {
  await requireTeam("content:manage");
  if (!OBJECT_ID.test(id)) return notFound;
  return adminFetch<MessageDetail>(`/admin/messages/${id}`);
}

export async function updateMessage(
  id: string,
  change: { starred?: boolean; read?: boolean; folder?: MessageFolder },
): Promise<ApiResult<MessageDetail>> {
  await requireTeam("content:manage");
  if (!OBJECT_ID.test(id)) return notFound;
  const body = {
    ...(typeof change.starred === "boolean" && { starred: change.starred }),
    ...(typeof change.read === "boolean" && { read: change.read }),
    ...(change.folder &&
      FOLDERS.includes(change.folder) && { folder: change.folder }),
  };
  return adminFetch<MessageDetail>(`/admin/messages/${id}`, {
    method: "PATCH",
    body,
  });
}

export async function bulkMessages(
  ids: string[],
  action: BulkAction,
): Promise<ApiResult<{ changed: number; counts: MessageCounts }>> {
  await requireTeam("content:manage");
  const clean = [...new Set(ids)]
    .filter((id) => OBJECT_ID.test(id))
    .slice(0, 100);
  if (clean.length === 0 || !ACTIONS.includes(action))
    return { ok: false, status: 400, message: "Nothing selected." };
  return adminFetch(`/admin/messages/bulk`, {
    method: "POST",
    body: { ids: clean, action },
  });
}

export async function replyToMessage(
  id: string,
  body: string,
): Promise<ApiResult<MessageDetail>> {
  await requireTeam("content:manage");
  if (!OBJECT_ID.test(id)) return notFound;
  const text = String(body ?? "").trim();
  if (text.length < 2)
    return { ok: false, status: 400, message: "Write your reply first." };
  return adminFetch<MessageDetail>(`/admin/messages/${id}/reply`, {
    method: "POST",
    body: { body: text.slice(0, REPLY_MAX) },
  });
}

export async function saveMessageNote(
  id: string,
  note: string,
): Promise<ApiResult<MessageDetail>> {
  await requireTeam("content:manage");
  if (!OBJECT_ID.test(id)) return notFound;
  return adminFetch<MessageDetail>(`/admin/messages/${id}/note`, {
    method: "PATCH",
    body: { note: String(note ?? "").slice(0, 1000) },
  });
}

export async function deleteMessage(
  id: string,
): Promise<ApiResult<{ deleted: true }>> {
  await requireTeam("content:manage");
  if (!OBJECT_ID.test(id)) return notFound;
  return adminFetch<{ deleted: true }>(`/admin/messages/${id}`, {
    method: "DELETE",
  });
}
