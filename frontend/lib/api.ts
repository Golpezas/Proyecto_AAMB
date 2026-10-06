const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function api(path: string, opts: { method?: string; body?: unknown } = {}) {
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    method: opts.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? `HTTP ${res.status}`);
  return res.json();
}