import { MilitaryUnit, TacticalGraphic } from '../../types';

export interface Command {
  name: string;
  execute(): void;
  undo(): void;
}

/**
 * C-MIL-05: Command Pattern & Undo/Redo Manager
 */
export class CommandManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxHistory: number = 50;
  private onStateChange?: () => void;

  constructor(onStateChange?: () => void) {
    this.onStateChange = onStateChange;
  }

  public execute(command: Command): void {
    command.execute();
    this.undoStack.push(command);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = []; // Clear redo on new action
    this.notify();
  }

  public undo(): boolean {
    if (this.undoStack.length === 0) return false;
    const cmd = this.undoStack.pop()!;
    cmd.undo();
    this.redoStack.push(cmd);
    this.notify();
    return true;
  }

  public redo(): boolean {
    if (this.redoStack.length === 0) return false;
    const cmd = this.redoStack.pop()!;
    cmd.execute();
    this.undoStack.push(cmd);
    this.notify();
    return true;
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }

  private notify(): void {
    if (this.onStateChange) {
      this.onStateChange();
    }
  }
}

/**
 * Command: Add Unit
 */
export class AddUnitCommand implements Command {
  public name = 'Add Unit';
  constructor(private units: MilitaryUnit[], private unit: MilitaryUnit) {}

  public execute(): void {
    this.units.push(this.unit);
  }

  public undo(): void {
    const idx = this.units.findIndex((u) => u.id === this.unit.id);
    if (idx !== -1) {
      this.units.splice(idx, 1);
    }
  }
}

/**
 * Command: Move Unit
 */
export class MoveUnitCommand implements Command {
  public name = 'Move Unit';
  constructor(
    private unit: MilitaryUnit,
    private oldPos: [number, number],
    private newPos: [number, number]
  ) {}

  public execute(): void {
    this.unit.x = this.newPos[0];
    this.unit.y = this.newPos[1];
  }

  public undo(): void {
    this.unit.x = this.oldPos[0];
    this.unit.y = this.oldPos[1];
  }
}

/**
 * Command: Delete Units
 */
export class DeleteUnitsCommand implements Command {
  public name = 'Delete Units';
  private deleted: { unit: MilitaryUnit; index: number }[] = [];

  constructor(private units: MilitaryUnit[], private targets: MilitaryUnit[]) {}

  public execute(): void {
    this.deleted = [];
    for (const t of this.targets) {
      const idx = this.units.findIndex((u) => u.id === t.id);
      if (idx !== -1) {
        this.deleted.push({ unit: t, index: idx });
        this.units.splice(idx, 1);
      }
    }
  }

  public undo(): void {
    for (const item of this.deleted) {
      this.units.splice(item.index, 0, item.unit);
    }
  }
}

/**
 * Command: Add Tactical Graphic
 */
export class AddGraphicCommand implements Command {
  public name = 'Add Graphic';
  constructor(private graphics: TacticalGraphic[], private graphic: TacticalGraphic) {}

  public execute(): void {
    this.graphics.push(this.graphic);
  }

  public undo(): void {
    const idx = this.graphics.findIndex((g) => g.id === this.graphic.id);
    if (idx !== -1) {
      this.graphics.splice(idx, 1);
    }
  }
}
