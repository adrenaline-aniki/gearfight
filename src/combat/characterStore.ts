// GEAR FIGHT — persistence for authored characters (the "maker" save system).
//
// CharacterDefs are plain JSON, so saving is just localStorage. This keeps a
// single "working" character the editor and training/test share, plus helpers to
// export/import a def as text so a creation can leave the browser.

import type { CharacterDef } from './characterDef';
import { makeDefaultCharacter } from './characterDef';

const WORKING_KEY = 'gf_maker_working_char';

/** The character currently being edited / tested. Falls back to the default. */
export function loadCharacter(): CharacterDef {
  try {
    const raw = localStorage.getItem(WORKING_KEY);
    if (raw) return migrate(JSON.parse(raw) as CharacterDef);
  } catch {
    /* corrupt or unavailable storage -> default */
  }
  return makeDefaultCharacter('proto', 'プロト');
}

export function saveCharacter(def: CharacterDef): void {
  try {
    localStorage.setItem(WORKING_KEY, JSON.stringify(def));
  } catch {
    /* storage full/unavailable - non-fatal for an editor session */
  }
}

export function exportCharacter(def: CharacterDef): string {
  return JSON.stringify(def, null, 2);
}

export function importCharacter(text: string): CharacterDef | null {
  try {
    const def = JSON.parse(text) as CharacterDef;
    if (!def || typeof def !== 'object' || !def.moves || !def.gears) return null;
    return migrate(def);
  } catch {
    return null;
  }
}

// Fill in any fields a hand-edited/older def might be missing, so the engine
// never reads undefined. Merges over a fresh default.
function migrate(def: CharacterDef): CharacterDef {
  const base = makeDefaultCharacter(def.id ?? 'proto', def.name ?? 'プロト');
  return {
    ...base,
    ...def,
    standHurtbox: def.standHurtbox ?? base.standHurtbox,
    crouchHurtbox: def.crouchHurtbox ?? base.crouchHurtbox,
    pushbox: def.pushbox ?? base.pushbox,
    crouchPushbox: def.crouchPushbox ?? base.crouchPushbox,
    gears: def.gears ?? base.gears,
    moves: def.moves ?? base.moves,
  };
}
