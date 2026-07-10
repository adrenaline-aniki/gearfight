import { DEFAULT_LOADOUT, type PartLoadout } from '../config/parts';

const KEY = 'gearfight_save';

interface SaveData {
  assistMode: boolean;
  tutorialComplete: boolean;
  classroomRanking: { name: string; wins: number }[];
  loadout: PartLoadout;
}

const defaults: SaveData = {
  assistMode: true,
  tutorialComplete: false,
  classroomRanking: [],
  loadout: DEFAULT_LOADOUT,
};

export const SaveManager = {
  load(): SaveData {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults };
    } catch {
      return { ...defaults };
    }
  },

  save(data: Partial<SaveData>) {
    const current = SaveManager.load();
    localStorage.setItem(KEY, JSON.stringify({ ...current, ...data }));
  },

  addClassroomWin(name: string) {
    const data = SaveManager.load();
    const entry = data.classroomRanking.find((r) => r.name === name);
    if (entry) entry.wins += 1;
    else data.classroomRanking.push({ name, wins: 1 });
    data.classroomRanking.sort((a, b) => b.wins - a.wins);
    SaveManager.save({ classroomRanking: data.classroomRanking.slice(0, 20) });
  },
};
