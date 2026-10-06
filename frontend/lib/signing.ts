export function canonicalMessage(action: string, parts: string[], timestamp: number): string {
  return ["PIN", action, ...parts.map((p) => p.toLowerCase()), String(timestamp)].join(":");
}