import { Settings } from '../entities/Settings';

export interface ISettingsRepository {
  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<boolean>;
}
