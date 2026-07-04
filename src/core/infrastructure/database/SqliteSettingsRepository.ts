import Database from 'better-sqlite3';
import { ISettingsRepository } from '../../domain/repositories/ISettingsRepository';
import { Settings } from '../../domain/entities/Settings';

export class SqliteSettingsRepository implements ISettingsRepository {
  constructor(private db: Database.Database) {}

  async getSettings(): Promise<Settings> {
    try {
      const row: any = this.db.prepare("SELECT value FROM settings WHERE key = 'app_settings'").get();
      if (!row) {
        // Return default settings
        return new Settings();
      }
      return Settings.fromJson(row.value);
    } catch {
      return new Settings();
    }
  }

  async saveSettings(settings: Settings): Promise<boolean> {
    try {
      const json = settings.toJson();
      const res = this.db.prepare(`
        INSERT INTO settings (key, value)
        VALUES ('app_settings', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(json);
      return res.changes > 0;
    } catch (error) {
      console.error('Failed to save settings to SQLite:', error);
      return false;
    }
  }
}
