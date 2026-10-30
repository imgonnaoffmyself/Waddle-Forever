import { WaddleGame } from "./waddle-game";

export class SledRace extends WaddleGame {
  public roomId: number = 999;
  public raceStartTime: number = 0;
  public countdownStarted: boolean = false;

  public startCountdown(): void {
    if (!this.countdownStarted) {
      this.countdownStarted = true;
      // Countdown animation ("Ready... Set... Go!") takes 48 frames at 24 fps = 2000ms
      this.raceStartTime = Date.now() + 2000;
    }
  }

  public getGameTime(): number {
    if (!this.countdownStarted || Date.now() < this.raceStartTime) {
      return 0;
    }
    return Math.max(0, Math.round(Date.now() - this.raceStartTime));
  }

  public isRacing(): boolean {
    return this.countdownStarted && Date.now() >= this.raceStartTime;
  }
}
