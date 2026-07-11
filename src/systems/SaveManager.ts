import { DEFAULT_LOADOUT, type PartLoadout } from '../config/parts';

const KEY = 'gearfight_save';

interface SaveData {
  assistMode: boolean;
  tutorialComplete: boolean;
  loadout: PartLoadout;
}

const defaults: SaveData = {
  assistMode: true,
  tutorialComplete: false,
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
};
