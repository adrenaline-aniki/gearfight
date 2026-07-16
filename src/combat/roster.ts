// GEAR FIGHT — playable roster registry.
//
// The single source of truth for "who can you pick". Each entry knows how to
// build its CharacterDef, its display name, and (optionally) which puppet-rig art
// + rig style to render it with. Characters without rig art fall back to the
// gear-mech drawing, so a fighter can be playable BEFORE its sprite exists
// (Ganrock ships this way until its idle drawing lands).

import { makeDefaultCharacter, makeWizel, makeGanrock, type CharacterDef } from './characterDef';
import type { RigStyle } from '../graphics/PuppetRig';

export interface RosterEntry {
  id: string;
  name: string;
  make: () => CharacterDef;
  /** rig-art key under sprites/skin/<rig>/rig/ ; omit = no rig (mech fallback). */
  rig?: string;
  rigStyle?: RigStyle;
  /** one-line identity blurb for the select screen. */
  blurb: string;
}

export const ROSTER: RosterEntry[] = [
  {
    id: 'hajime', name: 'ハジメ', make: () => makeDefaultCharacter('hajime', 'ハジメ'),
    rig: 'hajime', blurb: 'バランス型。全部そこそこ、素直な相棒。',
  },
  {
    id: 'wizel', name: 'ウィズル', make: makeWizel,
    rig: 'wizel', rigStyle: { bladeArm: true }, blurb: '速度型。GL1-2で連打ラッシュ、軽いが手数。',
  },
  {
    id: 'ganrock', name: 'ガンロック', make: makeGanrock,
    blurb: 'パワー型。GL4-5で一撃必殺、重いが熱暴走に注意。',
  },
];

export function rosterEntry(id: string): RosterEntry {
  return ROSTER.find((r) => r.id === id) ?? ROSTER[0];
}

/** The rig id to render a given def with (by matching the def's id to a roster
 * entry that has rig art); undefined = draw the mech fallback. */
export function rigIdForDef(def: CharacterDef): string | undefined {
  return ROSTER.find((r) => r.id === def.id)?.rig;
}
export function rigStyleFor(rig: string): RigStyle {
  return ROSTER.find((r) => r.rig === rig)?.rigStyle ?? {};
}
