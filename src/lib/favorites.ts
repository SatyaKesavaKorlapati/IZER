const KEY = "ja11-preset-favorites";

export function readFavoriteIds(): Set<string> {
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

export function writeFavoriteIds(ids: Set<string>): void {
  localStorage.setItem(KEY, JSON.stringify([...ids]));
}

export function toggleFavorite(id: string): Set<string> {
  const ids = readFavoriteIds();
  if (ids.has(id)) ids.delete(id);
  else ids.add(id);
  writeFavoriteIds(ids);
  return ids;
}

export function removeFavorite(id: string): Set<string> {
  const ids = readFavoriteIds();
  ids.delete(id);
  writeFavoriteIds(ids);
  return ids;
}
