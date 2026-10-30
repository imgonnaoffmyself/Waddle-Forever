import fs from 'fs';
import { SETTINGS_PATH } from '../common/paths';
import { isLower, isVersionValid, processVersion, Version } from './routes/versions';
import { HTTP_PORT } from '../common/constants';
import { LOGIN_DELTA, SNOW_DELTA, WORLD_DELTA } from './servers';
import { EventListener, MultiplayerSettings } from '@common/utils';

const COIN_MULTIPLIER_CHANGE_DATE = '2005-11-16';

function defaultCoinMultiplier(version: Version): number {
  return isLower(version, COIN_MULTIPLIER_CHANGE_DATE) ? 0.5 : 1;
}

export type BooleanSettingKey = 
  'fps30' | 
  'thin_ice_igt' |
  'clothing' |
  'modern_my_puffle' |
  'remove_idle' |
  'jpa_level_selector' |
  'swap_dance_arrow' |
  'always_member' |
  'minified_website' |
  'no_rainbow_quest_wait' |
  'medieval_sound_fix' |
  'inventory_accuracy' |
  'no_create_via_login' |
  'faq_warning';

export type Settings = {
  version: Version
  /** Whether or not the user has answered if they want to install a package or not */
  answered_packages: string
  ignored_version: string
  coin_multiplier: number
  multiplayer: MultiplayerSettings
  targetIP: string
  targetPort: number
} & Record<BooleanSettingKey, boolean>;

type PartialSettings = Partial<Settings>

export class SettingsManager {
  settings: Settings;

  /** IP used by the server */
  targetIP: string;

  /** HTTP port used by the server, undefined if default */
  private _targetPort: number | undefined;

  private updateListener = new EventListener();

  set targetPort(port: number | undefined) {
    this._targetPort = port;
    if (this.settings) {
      this.settings.targetPort = this.targetPort;
    }
  }

  get targetPort(): number {
    return this._targetPort ?? HTTP_PORT;
  }

  constructor () {
    let settingsJson: any = {};

    if (fs.existsSync(SETTINGS_PATH)) {
      settingsJson = JSON.parse(fs.readFileSync(SETTINGS_PATH, { encoding: 'utf-8' }));
    }

    const version = this.readVersion(settingsJson);
    const storedMultiplier = settingsJson['coin_multiplier'];
    const coinMultiplier =
      typeof storedMultiplier === 'number' && storedMultiplier !== 2
        ? storedMultiplier
        : defaultCoinMultiplier(version);

    const multiplayer = this.readMultiplayer(settingsJson);
    const storedTargetIP = this.readString(settingsJson, 'targetIP');
    const storedTargetPort = this.readNumber(settingsJson, 'targetPort', HTTP_PORT);

    if (multiplayer.type === 'host' && multiplayer.ip) {
      this.targetIP = multiplayer.ip;
      this.targetPort = multiplayer.port ?? HTTP_PORT;
    } else if (storedTargetIP) {
      this.targetIP = storedTargetIP;
      this.targetPort = storedTargetPort;
    } else {
      this.targetIP = '127.0.0.1';
      this.targetPort = HTTP_PORT;
    }

    this.settings = {
      fps30: this.readBoolean(settingsJson, 'fps30', false),
      thin_ice_igt: this.readBoolean(settingsJson, 'thin_ice_igt', false),
      clothing: this.readBoolean(settingsJson, 'clothing', false),
      modern_my_puffle: this.readBoolean(settingsJson, 'modern_my_puffle', false),
      remove_idle: this.readBoolean(settingsJson, 'remove_idle', false),
      jpa_level_selector: this.readBoolean(settingsJson, 'jpa_level_selector', false),
      swap_dance_arrow: this.readBoolean(settingsJson, 'swap_dance_arrow', false),
      version,
      always_member: this.readBoolean(settingsJson, 'always_member', true),
      minified_website: this.readBoolean(settingsJson, 'minified_website', false),
      no_rainbow_quest_wait: this.readBoolean(settingsJson, 'no_rainbow_quest_wait', false),
      no_create_via_login: this.readBoolean(settingsJson, 'no_create_via_login', false),
      answered_packages: this.readString(settingsJson, 'answered_packages'),
      ignored_version: this.readString(settingsJson, 'ignored_version'),
      coin_multiplier: coinMultiplier,
      medieval_sound_fix: this.readBoolean(settingsJson, 'medieval_sound_fix', true),
      inventory_accuracy: this.readBoolean(settingsJson, 'inventory_accuracy', true),
      faq_warning: this.readBoolean(settingsJson, 'faq_warning', false),
      multiplayer,
      targetIP: this.targetIP,
      targetPort: this.targetPort
    };

    this.updateSettings({});
  }

  readMultiplayer(object: any): MultiplayerSettings {
    const val = object['multiplayer'];
    if (val && typeof val === 'object') {
      const type = val.type;
      if (type === 'local' || type === 'guest' || type === 'host') {
        return {
          type,
          ip: typeof val.ip === 'string' ? val.ip : undefined,
          port: typeof val.port === 'number' && !isNaN(val.port) ? val.port : undefined
        } as MultiplayerSettings;
      }
    }
    return { type: 'local' };
  }

  readString(object: any, property: string): string {
    const value = object[property];
    if (typeof value === 'string') {
      return value;
    } else {
      return '';
    }
  }

  readVersion(object: any): Version {
    const value = object['version'];
    if (value === undefined || !isVersionValid(value)) {
      return '2010-10-25';
    } else {
      return value;
    }
  }

  readBoolean(object: any, property: string, default_value: boolean): boolean {
    const value = object[property];
    if (typeof value === 'boolean') {
      return value;
    } else {
      return default_value;
    }
  }

  readNumber(object: any, property: string, default_value: number): number {
    const value = object[property];
    if (typeof value === 'number') {
      return value;
    } else {
      return default_value;
    }
  }

  updateSettings(partial: PartialSettings): void {
    const previousVersion = this.settings.version;
    const previousMultiplier = this.settings.coin_multiplier;
    const next = { ...this.settings, ...partial};

    if (partial.version !== undefined && partial.coin_multiplier === undefined) {
      const previousDefault = defaultCoinMultiplier(previousVersion);
      const nextDefault = defaultCoinMultiplier(next.version);
      if (previousMultiplier === previousDefault || previousMultiplier === 2) {
        next.coin_multiplier = nextDefault;
      }
    }

    if (partial.targetIP !== undefined) {
      this.targetIP = partial.targetIP;
      next.targetIP = partial.targetIP;
    }
    if (partial.targetPort !== undefined) {
      this.targetPort = partial.targetPort;
      next.targetPort = partial.targetPort;
    }
    if (partial.multiplayer !== undefined) {
      next.multiplayer = partial.multiplayer;
    }

    this.settings = next;
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(this.settings));

    this.updateListener.fire();
  }

  public addListener(callback: () => void) {
    this.updateListener.addListener(callback);
  }

  get loginPort() {
    return this.targetPort + LOGIN_DELTA;
  }

  get worldPort() {
    return this.targetPort + WORLD_DELTA;
  }

  get snowPort() {
    return this.targetPort + SNOW_DELTA;
  }

  getVirtualDate(offset: number): Date {
    const [year, month, day] = processVersion(this.settings.version);
    // simulating PST time for the current day
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const second = now.getSeconds();

    // date generates this time thinking in the same timezone as the user
    // an arbitrary offset may be applied depending on how each client behaves
    return new Date(year, month - 1, day, hour + offset, minute, second);
  }
}

const settingsManager = new SettingsManager();

export default settingsManager;
