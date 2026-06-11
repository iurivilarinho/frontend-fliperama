import { getSetting, setSetting } from "./settings";
import { DEFAULT_MAPPING, type ControlMapping } from "../gamepad";

const CONTROLS_KEY = "controls_mapping";

export async function loadControlMapping(): Promise<ControlMapping> {
  try {
    const raw = await getSetting(CONTROLS_KEY);
    if (!raw) return { ...DEFAULT_MAPPING };
    const parsed = JSON.parse(raw) as Partial<ControlMapping>;
    return { ...DEFAULT_MAPPING, ...parsed };
  } catch {
    return { ...DEFAULT_MAPPING };
  }
}

export async function saveControlMapping(mapping: ControlMapping): Promise<void> {
  await setSetting(CONTROLS_KEY, JSON.stringify(mapping));
}
