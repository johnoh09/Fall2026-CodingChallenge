export async function api<T>(
  path: string,
  options: RequestInit = {},
  shareToken?: string,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-Frameboard': '1',
      ...(shareToken ? { 'X-Share-Token': shareToken } : {}),
      ...options.headers,
    },
  });
  if (response.status === 204) return undefined as T;
  const data = await response
    .json()
    .catch(() => ({ error: 'The server did not respond. Make sure both servers are running.' }));
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}
export const json = (method: string, data?: unknown): RequestInit => ({
  method,
  ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
});
export const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong.';
