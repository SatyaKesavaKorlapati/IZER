const KEY = "ja11-preset-display-names";

export function readPresetAliases(): Map<string, string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Map();
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object") return new Map();
    return new Map(
      Object.entries(data as Record<string, string>).filter(
        (entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string",
      ),
    );
  } catch {
    return new Map();
  }
}

export function writePresetAliases(map: Map<string, string>): void {
  const obj: Record<string, string> = {};
  for (const [id, name] of map) obj[id] = name;
  localStorage.setItem(KEY, JSON.stringify(obj));
}

export function setPresetAlias(id: string, name: string): Map<string, string> {
  const aliases = readPresetAliases();
  aliases.set(id, name.trim());
  writePresetAliases(aliases);
  return aliases;
}

export function clearPresetAlias(id: string): Map<string, string> {
  const aliases = readPresetAliases();
  aliases.delete(id);
  writePresetAliases(aliases);
  return aliases;
}
