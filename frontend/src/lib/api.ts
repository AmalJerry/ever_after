import type {
  Creator,
  ExperienceContent,
  ExperienceRecord,
  MediaAsset,
} from "./types";
import { normalizeExperience } from "./presentation";

let csrfToken = "";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function errorMessage(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value))
    return value.map(errorMessage).filter(Boolean).join(" ");
  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([field, details]) => {
        const message = errorMessage(details);
        return field === "detail" || field === "non_field_errors"
          ? message
          : `${field}: ${message}`;
      })
      .join(" ");
  }
  return "Something went wrong. Please try again.";
}

async function request<Result>(
  path: string,
  method = "GET",
  data?: unknown,
  signal?: AbortSignal,
): Promise<Result> {
  if (method !== "GET" && !csrfToken) await api.session();
  let response: Response;
  try {
    response = await fetch(`/api/${path}`, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(data !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(method !== "GET" ? { "X-CSRFToken": csrfToken } : {}),
      },
      body: data === undefined ? undefined : JSON.stringify(data),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new ApiError(
      "We couldn't reach your private studio. Check the connection and try again. Your unsaved edits are still here.",
      0,
    );
  }
  if (response.status === 204) return undefined as Result;
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status >= 500)
      throw new ApiError(
        "The studio is temporarily unavailable. Please try again shortly.",
        response.status,
      );
    throw new ApiError(errorMessage(payload), response.status);
  }
  if (
    payload &&
    typeof payload === "object" &&
    "csrfToken" in payload &&
    typeof payload.csrfToken === "string"
  ) {
    csrfToken = payload.csrfToken;
  }
  return payload as Result;
}

export const api = {
  session: () =>
    request<{ user: Creator | null; csrfToken: string }>("session/"),
  register: (username: string, password: string) =>
    request<{ user: Creator; csrfToken: string }>("register/", "POST", {
      username,
      password,
    }),
  login: (username: string, password: string) =>
    request<{ user: Creator; csrfToken: string }>("login/", "POST", {
      username,
      password,
    }),
  async logout() {
    await request<void>("logout/", "POST", {});
    csrfToken = "";
  },
  list: async () =>
    (await request<ExperienceRecord[]>("experiences/")).map((record) => ({
      ...record,
      draft: normalizeExperience(record.draft),
    })),
  create: (draft: ExperienceContent) =>
    request<ExperienceRecord>("experiences/", "POST", { draft }),
  save: (id: string, draft: ExperienceContent) =>
    request<ExperienceRecord>(`experiences/${id}/`, "PATCH", { draft }),
  remove: (id: string) => request<void>(`experiences/${id}/`, "DELETE"),
  publish: (id: string, expiresInDays: number) =>
    request<ExperienceRecord>(`experiences/${id}/publish/`, "POST", {
      expiresInDays,
    }),
  unpublish: (id: string) =>
    request<ExperienceRecord>(`experiences/${id}/unpublish/`, "POST", {}),
  shared: async (token: string, signal?: AbortSignal) =>
    normalizeExperience(
      await request<ExperienceContent>(
        `shared/${encodeURIComponent(token)}/`,
        "GET",
        undefined,
        signal,
      ),
    ),
};

export async function uploadMedia(
  id: string,
  file: File,
  kind: MediaAsset["kind"],
  onProgress: (percentage: number) => void,
): Promise<MediaAsset> {
  if (!csrfToken) await api.session();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/experiences/${id}/media/`);
    xhr.setRequestHeader("X-CSRFToken", csrfToken);
    xhr.timeout = 120000;
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300)
        resolve(xhr.response as MediaAsset);
      else reject(new ApiError(errorMessage(xhr.response), xhr.status));
    };
    xhr.onerror = () =>
      reject(
        new ApiError(
          "Upload interrupted. Check your connection and try again.",
          0,
        ),
      );
    xhr.ontimeout = () =>
      reject(new ApiError("That upload took too long. Try a smaller file.", 0));
    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);
    xhr.send(form);
  });
}
