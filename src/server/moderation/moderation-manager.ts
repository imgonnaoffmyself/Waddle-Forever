import { WorldRoom } from "@server/socket-server/world/world-room";
import { WorldPenguin } from "@server/socket-server/world/world-penguin";
import { Bot } from "@server/socket-server/world/bot";
import { XtMessenger } from "@server/socket-server/xt-messenger";
import { evaluateMessage, ModerationEvaluation } from "./localmod";
import {
  MODERATOR_DISPATCH_ARRIVAL_LINES,
  MODERATOR_WARNING_LINES,
  MODERATOR_MUTE_LINES,
  MODERATOR_KICK_LINES,
  MODERATOR_BAN_LINES
} from "@server/socket-server/world/moderator-bot";
import { choose, randomInt } from "@common/utils";
import { PenguinRepository } from "@server/database/database";
import { PersonalityTrait } from "@server/npc/npc-types";
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
    private _getModeratorBot?: () => Bot | undefined
  ) {}

  public setModeratorBotGetter(fn: () => Bot | undefined): void {
    this._getModeratorBot = fn;
  }

  public get reports(): PlayerReport[] {
    return [...this._reports];
  }

  /**
   * Files a report against a player (from a bot or a real player)
   * and dispatches a moderator bot to the scene.
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
    if (now - lastReport < 15_000) return; // Cooldown between duplicate reports

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

    // Trigger live moderator dispatch
    if (targetPenguin && room) {
      setTimeout(() => {
        this.dispatchModerator(room, targetPenguin, category);
      }, randomInt(1800, 3500));
    }
  }

  /**
   * Evaluates player chat in real time.
   * If flagged:
   * - If a moderator bot is already in the room, they intervene live!
   * - Otherwise, regular bots in the room react with shock/reporting lines and submit a report,
   *   which dispatches a moderator bot to the room.
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

    // Check if a live moderator bot is already in this room
    const modBotInRoom = botsInRoom.find(b => b.isModerator);
    if (modBotInRoom) {
      // Live intervention right in front of everyone!
      setTimeout(() => {
        this.handleModeratorIntervention(modBotInRoom, room, player, evalResult);
      }, randomInt(800, 1600));
      return;
    }

    // Regular bots in the room notice the bad behavior
    const regularBots = botsInRoom.filter(b => !b.isDev && !b.isModerator);
    if (regularBots.length === 0) return;

    const reportingBot = choose(regularBots);

    const reactionLines: Record<PersonalityTrait, string[]> = {
      grumpy: [
        'im reporting you. that is not okay.',
        'get reported.',
        'enjoy the ban.',
        'that is completely against the rules.'
      ],
      shy: [
        'that was really mean...',
        'i\'m reporting you..',
        'please don\'t say things like that..',
        'reporting that..'
      ],
      excitable: [
        'HEY THAT IS NOT COOL!!',
        'IM REPORTING YOU RIGHT NOW!!!',
        'MODS ARE GONNA SEE THAT!!',
        'YOU CANT SAY THAT HERE!!'
      ],
      friendly: [
        'please be nice to everyone!',
        'that\'s not very friendly, reporting that.',
        'let\'s follow the rules please.',
        'i had to report that, please be kind.'
      ],
      curious: [
        'why would you say that? reporting it.',
        'the moderators definitely won\'t like that.',
        'reported. rules are there for a reason.'
      ]
    };

    const lines = reactionLines[reportingBot.personalityTrait] ?? reactionLines.friendly;
    const reaction = choose(lines);

    setTimeout(() => {
      const curRoom = reportingBot.world.getPenguinRoom(reportingBot.penguin);
      if (curRoom?.id === room.id) {
        reportingBot.sendMessage(reaction);
      }
    }, randomInt(700, 1600));

    // File report which dispatches a live moderator bot
    this.fileReport(
      reportingBot.penguin.id,
      player.id,
      room.id,
      evalResult.category,
      message,
      player,
      room
    );
  }

  /**
   * Executes a live moderator bot intervention on a player in the room.
   */
  public handleModeratorIntervention(
    modBot: Bot,
    room: WorldRoom,
    target: WorldPenguin,
    evalResult: ModerationEvaluation
  ): void {
    const now = Date.now();
    const lastAction = this._lastInterventionTime.get(target.id) ?? 0;
    if (now - lastAction < 5000) return; // Prevent overlapping interventions

    this._lastInterventionTime.set(target.id, now);

    // Walk towards the offending player
    const targetState = room.getState(target);
    if (targetState) {
      const offsetX = targetState.x > 400 ? -45 : 45;
      modBot.walk(targetState.x + offsetX, targetState.y);
    }

    const strikes = target.moderation.addStrike();

    // Determine punishment escalation
    if (evalResult.recommendedAction === 'ban' || strikes >= 4) {
      // 24h Ban
      const banExpiry = Date.now() + 24 * 60 * 60 * 1000;
      target.moderation.ban(banExpiry, `Moderator ban: ${evalResult.reason}`);
      this.persistBan(target, banExpiry, `Moderator ban: ${evalResult.reason}`);

      const banLine = choose(MODERATOR_BAN_LINES);
      modBot.sendMessage(banLine);

      setTimeout(() => {
        this._msg.send(target, 'e', 600, 24);
        const client = this._msg.getClient(target);
        if (client) client.end();
      }, 1800);

    } else if (evalResult.recommendedAction === 'kick' || strikes >= 3) {
      // Kick from server
      const kickLine = choose(MODERATOR_KICK_LINES);
      modBot.sendMessage(kickLine);

      setTimeout(() => {
        this._msg.send(target, 'e', 610);
        const client = this._msg.getClient(target);
        if (client) client.end();
      }, 1800);

    } else if (evalResult.recommendedAction === 'mute' || strikes >= 2) {
      // 5-minute mute
      const muteDurationMs = 5 * 60 * 1000;
      target.moderation.mute(now + muteDurationMs);

      const muteLine = choose(MODERATOR_MUTE_LINES);
      modBot.sendMessage(muteLine);

    } else {
      // Strike 1 / Verbal warning
      target.moderation.addWarning(evalResult.reason);
      const warnLine = choose(MODERATOR_WARNING_LINES);
      modBot.sendMessage(warnLine);
    }
  }

  /**
   * Dispatches an available moderator bot to investigate a reported room.
   */
  public async dispatchModerator(
    room: WorldRoom,
    target: WorldPenguin,
    reason: string
  ): Promise<void> {
    if (!this._getModeratorBot) return;
    const modBot = this._getModeratorBot();
    if (!modBot) return;

    const currentModRoom = modBot.world.getPenguinRoom(modBot.penguin);
    if (currentModRoom?.id !== room.id) {
      // Moderator bot enters the reported room
      await modBot.enter(room.id);
      await new Promise(r => setTimeout(r, 1200));

      // Announce arrival
      const arrivalMsg = choose(MODERATOR_DISPATCH_ARRIVAL_LINES);
      modBot.sendMessage(arrivalMsg);
      await new Promise(r => setTimeout(r, 1500));
    }

    // Check if target player is still in the room
    const targetRoom = room.players.find(p => p.id === target.id);
    if (targetRoom) {
      const evalResult: ModerationEvaluation = {
        flagged: true,
        category: 'harassment',
        severity: 0.55,
        recommendedAction: 'warn',
        reason: `Report investigation: ${reason}`,
        scores: { toxicity: 0.5, harassment: 0.5, inappropriate: 0, spam: 0, none: 0 }
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
