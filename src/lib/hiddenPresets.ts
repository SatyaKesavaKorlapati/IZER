const KEY = "ja11-hidden-preset-ids";

export function readHiddenPresetIds(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return new Set();
    return new Set(data.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

export function writeHiddenPresetIds(ids: Set<string>): void {
  localStorage.setItem(KEY, JSON.stringify([...ids]));
}

export function hidePresetFromLibrary(id: string): Set<string> {
  const ids = readHiddenPresetIds();
  ids.add(id);
  writeHiddenPresetIds(ids);
  return ids;
}
