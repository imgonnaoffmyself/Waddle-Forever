import { WorldRoom } from "@server/socket-server/world/world-room";
import { WorldPenguin } from "@server/socket-server/world/world-penguin";
import { Bot } from "@server/socket-server/world/bot";
import { XtMessenger } from "@server/socket-server/xt-messenger";
import { evaluateMessage, ModerationEvaluation } from "./localmod";
import { formatBanExpiry } from "./filter";
import { randomInt } from "@common/utils";
import { PenguinRepository } from "@server/database/database";
import { isBot } from "@server/socket-server/world/bots";

export interface PlayerReport {
  id: string;
  reporterId: number;
  targetId: number;
  roomId: number;
  category: string;
  snippet?: string;
  timestamp: number;
}

export class ModerationManager {
  private _reports: PlayerReport[] = [];
  private _lastInterventionTime = new Map<number, number>();
  private _reportCooldowns = new Map<string, number>();

  constructor(
    private _msg: XtMessenger,
    private _db?: PenguinRepository,
    private _ensureModeratorInRoom?: (room: WorldRoom) => Bot | undefined
  ) {}

  public setModeratorGetter(fn: (room: WorldRoom) => Bot | undefined): void {
    this._ensureModeratorInRoom = fn;
  }

  public get reports(): PlayerReport[] {
    return [...this._reports];
  }

  /**
   * Files a report against a player (from a command or player report)
   * and triggers swift moderator investigation.
   */
  public fileReport(
    reporterId: number,
    targetId: number,
    roomId: number,
    category: string,
    snippet?: string,
    targetPenguin?: WorldPenguin,
    room?: WorldRoom
  ): void {
    const reportKey = `${reporterId}:${targetId}:${roomId}`;
    const now = Date.now();
    const lastReport = this._reportCooldowns.get(reportKey) ?? 0;
    if (now - lastReport < 10_000) return; // Cooldown between duplicate reports

    this._reportCooldowns.set(reportKey, now);

    const report: PlayerReport = {
      id: `${now}-${Math.random().toString(36).substring(2, 7)}`,
      reporterId,
      targetId,
      roomId,
      category,
      snippet,
      timestamp: now
    };

    this._reports.push(report);
    if (this._reports.length > 100) this._reports.shift();

    // Trigger swift moderator intervention in the reported room
    if (targetPenguin && room) {
      setTimeout(() => {
        this.dispatchModerator(room, targetPenguin, category);
      }, randomInt(600, 1200));
    }
  }

  /**
   * Evaluates player chat in real time.
   * If flagged:
   * - An undercover moderator bot (or developer) already in the room reacts swiftly.
   * - Bystander bots in the room react with shock/disgust.
   */
  public async handlePlayerChat(
    room: WorldRoom,
    player: WorldPenguin,
    message: string,
    botsInRoom: Bot[]
  ): Promise<void> {
    if (isBot(player)) return;

    const evalResult = await evaluateMessage(message);
    if (!evalResult.flagged) return;

    const lower = message.toLowerCase();

    // 1. Check if a Dev NPC is in the room and specifically addressed
    let interveningBot: Bot | undefined = botsInRoom.find(
      b => b.isDev && lower.includes(b.penguin.name.toLowerCase())
    );

    // 2. Otherwise find any moderator bot already in this room (which includes dev bots)
    if (!interveningBot) {
      interveningBot = botsInRoom.find(b => b.isModerator);
    }

    // 3. If none in room yet, guarantee one immediately
    if (!interveningBot && this._ensureModeratorInRoom) {
      interveningBot = this._ensureModeratorInRoom(room);
    }

    // 4. Swift silent moderator intervention (within 350-700ms)
    if (interveningBot) {
      const mod = interveningBot;
      const modDelay = randomInt(350, 700);
      setTimeout(() => {
        this.handleModeratorIntervention(mod, room, player, evalResult, message);
      }, modDelay);
    }
  }

  /**
   * Executes a live moderator bot intervention on a player in the room.
   */
  public handleModeratorIntervention(
    modBot: Bot,
    room: WorldRoom,
    target: WorldPenguin,
    evalResult: ModerationEvaluation,
    originalMessage?: string
  ): void {
    const now = Date.now();
    const lastAction = this._lastInterventionTime.get(target.id) ?? 0;
    if (now - lastAction < 3000) return; // Prevent overlapping interventions

    this._lastInterventionTime.set(target.id, now);

    const strikes = target.moderation.addStrike();

    // Determine punishment escalation (silent actions to prevent exposing moderator bots)
    if (evalResult.flagged || evalResult.recommendedAction === 'ban' || strikes >= 4) {
      // 24h Ban
      const banExpiry = Date.now() + 24 * 60 * 60 * 1000;
      target.moderation.ban(banExpiry, `Moderator ban: ${evalResult.reason}`);
      this.persistBan(target, banExpiry, `Moderator ban: ${evalResult.reason}`);

      // Swift disconnect within 650ms
      setTimeout(() => {
        this._msg.send(target, 'e', 600, formatBanExpiry(banExpiry));
        const client = this._msg.getClient(target);
        if (client) client.end();
      }, 650);

    } else if (evalResult.recommendedAction === 'kick' || strikes >= 3) {
      // Kick from server (silent)
      setTimeout(() => {
        this._msg.send(target, 'e', 610);
        const client = this._msg.getClient(target);
        if (client) client.end();
      }, 650);

    } else if (evalResult.recommendedAction === 'mute' || strikes >= 2) {
      // 5-minute mute (silent)
      const muteDurationMs = 5 * 60 * 1000;
      target.moderation.mute(now + muteDurationMs);

    } else {
      // Strike 1 / Verbal warning (silent record)
      target.moderation.addWarning(evalResult.reason);
    }
  }

  /**
   * Dispatches or assigns a moderator bot to investigate a reported room.
   */
  public async dispatchModerator(
    room: WorldRoom,
    target: WorldPenguin,
    reason: string
  ): Promise<void> {
    const modBot = this._ensureModeratorInRoom ? this._ensureModeratorInRoom(room) : undefined;
    if (!modBot) return;

    // Check if target player is still in the room
    const targetRoom = room.players.find(p => p.id === target.id);
    if (targetRoom) {
      const evalResult: ModerationEvaluation = {
        flagged: true,
        category: 'harassment',
        severity: 0.65,
        recommendedAction: 'warn',
        reason: `Report investigation: ${reason}`,
        scores: { predatory: 0, toxicity: 0.5, harassment: 0.65, nsfw: 0, spam: 0, none: 0 }
      };
      this.handleModeratorIntervention(modBot, room, target, evalResult);
    }
  }

  private async persistBan(penguin: WorldPenguin, until: number, reason: string): Promise<void> {
    if (!this._db) return;
    try {
      const existing = await this._db.get(penguin.id);
      if (existing) {
        existing.banned_until = until;
        existing.ban_reason = reason;
        await this._db.update(penguin.id, existing);
      }
    } catch {
      // Fallback
    }
  }
}
