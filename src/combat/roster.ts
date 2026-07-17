// GEAR FIGHT — playable roster registry.
//
// The single source of truth for "who can you pick". Each entry knows how to
// build its CharacterDef, its display name, and (optionally) which puppet-rig art
// + rig style to render it with. Characters without rig art fall back to the
// gear-mech drawing, so a fighter can be playable BEFORE its sprite exists
// (Ganrock ships this way until its idle drawing lands).

import {
  makeDefaultCharacter, makeWizel, makeGanrock,
  makeAegis, makeDrift, makeTheorion, makeOmeganova, makeSophislegion,
  type CharacterDef,
} from './characterDef';
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
    rig: 'ganrock', blurb: 'パワー型。GL4-5で一撃必殺、重いが熱暴走に注意。',
  },
  {
    id: 'aegis', name: 'アイギス', make: makeAegis,
    rig: 'aegis', blurb: '防御型。最も硬く重い。盾で守り、シールドタックルで割る。',
  },
  {
    id: 'drift', name: 'ドリフト', make: makeDrift,
    rig: 'drift', blurb: '機動トリックスター。オイルトラップで空間を縛り、動き回って崩す。',
  },
  {
    id: 'theorion', name: 'テオリオン', make: makeTheorion,
    rig: 'theorion', blurb: '技巧ゾナー。三日月ウェーブと長い間合いで差し合う。',
  },
  {
    id: 'omeganova', name: 'オメガノヴァ', make: makeOmeganova,
    rig: 'omeganova', blurb: '最終ボス。全能力が高い高火力の壁。',
  },
  {
    id: 'sophislegion', name: 'ソフィス・レギオン', make: makeSophislegion,
    rig: 'sophislegion', blurb: '隠しボス。氷のフロストランスで固めて崩す技巧派。',
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
