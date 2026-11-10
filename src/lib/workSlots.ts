import { normalizeEq, type EqModel } from "../eq/types";

export type SlotMode = "static" | "live";
export type SlotId = "1" | "2" | "3" | "4";

export type WorkSlot = {
  id: SlotId;
  mode: SlotMode;
  eq: EqModel;
};

const KEY = "ja11-work-slots-v1";
export const SLOT_IDS: SlotId[] = ["1", "2", "3", "4"];

export function blankSlots(seed: EqModel): WorkSlot[] {
  return SLOT_IDS.map((id) => ({
    id,
    mode: "static",
    eq: normalizeEq(seed),
  }));
}

export function readWorkSlots(seed: EqModel): { active: SlotId; slots: WorkSlot[] } {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { active: "1", slots: blankSlots(seed) };
    const data = JSON.parse(raw) as { active?: string; slots?: WorkSlot[] };
    const slots = SLOT_IDS.map((id) => {
      const found = data.slots?.find((slot) => slot.id === id);
      if (!found?.eq) return { id, mode: "static" as const, eq: normalizeEq(seed) };
      const mode: SlotMode = found.mode === "live" ? "live" : "static";
      return {
        id,
        mode,
        eq: normalizeEq(found.eq),
      };
    });
    const active = SLOT_IDS.includes(data.active as SlotId) ? (data.active as SlotId) : "1";
    return { active, slots };
  } catch {
    return { active: "1", slots: blankSlots(seed) };
  }
}

export function writeWorkSlots(active: SlotId, slots: WorkSlot[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ active, slots }));
  } catch {
    /* storage blocked */
  }
}
