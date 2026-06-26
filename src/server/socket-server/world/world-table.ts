import { RoomOccupant } from "./world-room";
import { RoomState, WorldPenguin } from "./world-penguin";

export abstract class WorldTable {
  private seats: Array<RoomOccupant | null> = [null, null];
  private joined: Array<boolean> = [false, false];
  private spectators = new Set<RoomOccupant>();
  private _blockPayout = new Set<WorldPenguin>();
  static TABLE_SPECTATOR_SEAT = 99;
  private started = false;
  private ended = false;
  protected turn = 0;

  constructor(private id: number) {

  }

  static MANCALA_TABLE_IDS = new Set([100, 101, 102, 103, 104]);
  static FIND_FOUR_TABLE_IDS = new Set([200, 201, 202, 203, 204, 205, 206, 207]);

  public getCount() {
    return this.seats.filter(p => p !== null).length;
  }

  public getId() {
    return this.id;
  }

  getSeatIndex(penguin: RoomOccupant): number | undefined {
    if (this.spectators.has(penguin)) {
      return WorldTable.TABLE_SPECTATOR_SEAT;
    }

    const seatIndex = this.seats.findIndex((seat) => seat?.id === penguin.id);
    return seatIndex === -1 ? undefined : seatIndex;
  }

  assignSeatIndex(penguin: RoomOccupant): number {
    const existingSeat = this.getSeatIndex(penguin);
    if (existingSeat !== undefined) {
      return existingSeat;
    }
    const openSeat = this.seats.findIndex((seat) => seat === null);
    if (openSeat === -1) {
      this.spectators.add(penguin);
      return WorldTable.TABLE_SPECTATOR_SEAT;
    }
    this.seats[openSeat] = penguin;
    return openSeat;
  }

  abstract createBoard(): void;

  abstract serializeBoard(): string;

  reset() {
    this.createBoard();
    this.started = false;
    this.ended = false;
    this.turn = 0;
    this.spectators = new Set<RoomOccupant>();
  }

  public getSeats() {
    return [...this.seats];
  }

  resetRound() {
    this.reset();
    this.seats = [null, null];
    this.joined = [false, false];
  }

  public hasPlayer(penguin: RoomOccupant) {
    return this.getSeatIndex(penguin) !== undefined;
  }

  public removePlayer(penguin: RoomOccupant) {
    const seat = this.getSeatIndex(penguin);
    if (seat !== undefined) {
      this.seats[seat] = null;
    }
  }

  public removeSpectator(penguin: RoomOccupant) {
    return this.spectators.delete(penguin);
  }

  public unblockPayout(penguin: WorldPenguin): boolean {
    return this._blockPayout.delete(penguin);
  }

  public blockSpectators(): void {
    this.spectators.forEach(s => {
      if (s instanceof WorldPenguin) this._blockPayout.add(s);
    });
  }

  public getNames(): string[] {
    return this.seats.map(p => p?.name ?? '');
  }

  public setJoined(seat: number) {
    this.joined[seat] = true;
  }

  public get penguins(): RoomOccupant[] {
    return [...this.seats.filter((value): value is RoomOccupant => {
      return value !== null;
    }), ...this.spectators]
  }

  public get realPlayers(): WorldPenguin[] {
    return this.penguins.filter((p): p is WorldPenguin => p instanceof WorldPenguin);
  }

  public hasStarted() {
    return this.started;
  }

  public hasJoined(seat: number) {
    return this.joined[seat];
  }

  public hasEveryoneJoined() {
    return this.joined.every(joined => joined);
  }

  public setStarted() {
    this.started = true;
    this.turn = 0;
  }

  public getTurn() {
    return this.turn;
  }

  public hasEnded() {
    return this.ended;
  }

  abstract getMoveLength(): number;

  abstract sendMove(moves: number[]): [Array<string | number> | null, Array<string | number> | null];

  abstract getAutomaticTurnChange(): boolean;

  public changeTurn() {
    this.turn = (this.turn + 1) % 2;
  }

  protected endGame() {
    this.ended = true;
  }

  protected awardCoins(scores: [number, number]) {
    this.seats.forEach((player, index) => {
      if (player !== null && (index == 0 || index == 1) && player instanceof WorldPenguin) {
        const score = scores[index];
        if (score > 0) {
          player.currency.add(score);
        }
      }
    });
  }
}