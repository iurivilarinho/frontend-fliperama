import { getSetting, setSetting } from "./settings";
import {
  DEFAULT_INGAME_MAPPING,
  DEFAULT_MAPPING,
  type ControlMapping,
  type InGameMapping,
} from "../gamepad";

const CONTROLS_KEY = "controls_mapping";
const INGAME_KEY = "ingame_mapping";

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

export async function loadInGameMapping(): Promise<InGameMapping> {
  try {
    const raw = await getSetting(INGAME_KEY);
    if (!raw) return { ...DEFAULT_INGAME_MAPPING };
    const parsed = JSON.parse(raw) as Partial<InGameMapping>;
    return { ...DEFAULT_INGAME_MAPPING, ...parsed };
  } catch {
    return { ...DEFAULT_INGAME_MAPPING };
  }
}

export async function saveInGameMapping(mapping: InGameMapping): Promise<void> {
  await setSetting(INGAME_KEY, JSON.stringify(mapping));
}
