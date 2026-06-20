// Safe fetch JSON helper for client components.
// Reads response.text(), tries JSON.parse, and throws a clear error if the
// response is HTML/non-JSON (which happens when the server returns an error page).

export async function fetchJson<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("camate.adminToken");
    if (token) {
      headers.set("x-admin-token", token);
    }
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });
  const text = await res.text();

  if (!text) {
    throw new Error(`Empty response from ${url} (HTTP ${res.status})`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    // Response is not JSON — likely an HTML error page.
    // Extract a useful error message if possible.
    const titleMatch = text.match(/<title>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : "Non-JSON response";
    throw new Error(`Expected JSON from ${url} but got: ${title} (HTTP ${res.status})`);
  }
}
