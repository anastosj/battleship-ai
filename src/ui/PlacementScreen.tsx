import { useEffect, useState } from 'react';
import { canPlace, removeShip, shipAt, shipCells } from '../engine/board';
import { fleetComplete } from '../engine/game';
import { DIFFICULTY_NAMES } from '../ai';
import {
  DIFFICULTIES,
  SHIP_KINDS,
  SHIP_NAMES,
  SHIP_SIZES,
  type Coord,
  type Difficulty,
  type GameState,
  type Orientation,
  type Ship,
  type ShipKind,
} from '../engine/types';
import { Board, type Preview } from './Board';

type Props = {
  game: GameState;
  selected: ShipKind | undefined;
  orientation: Orientation;
  select: (kind: ShipKind) => void;
  rotate: () => void;
  placeAt: (at: Coord) => void;
  pickup: (kind: ShipKind) => void;
  randomize: () => void;
  confirm: () => void;
  setDifficulty: (difficulty: Difficulty) => void;
};

const DIFFICULTY_CALLSIGNS: Record<Difficulty, string> = {
  easy: 'Cadet',
  hard: 'Commander',
  expert: 'Bayes at the Helm',
};

const DIFFICULTY_HINTS: Record<Difficulty, string> = {
  easy: 'Fires at random, then pokes around a hit.',
  hard: 'Parity hunt, line targeting, never forgets a hit.',
  expert: 'Counts every fleet that fits the evidence; fires where the most overlap.',
};

export const PlacementScreen = ({
  game,
  selected,
  orientation,
  select,
  rotate,
  placeAt,
  pickup,
  randomize,
  confirm,
  setDifficulty,
}: Props) => {
  const [hover, setHover] = useState<Coord | undefined>();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey && !e.altKey) rotate();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rotate]);

  const board = game.human;
  const placedKinds = new Set(board.ships.map((s) => s.kind));

  let preview: Preview | undefined;
  const hoverOccupant = hover ? shipAt(board, hover) : undefined;
  if (hover && selected !== undefined && (!hoverOccupant || hoverOccupant.kind === selected)) {
    const ship: Ship = { kind: selected, bow: hover, orientation };
    preview = { cells: shipCells(ship), legal: canPlace(removeShip(board, selected), ship) };
  }

  const onCellClick = (at: Coord) => {
    const occupant = shipAt(board, at);
    if (occupant && occupant.kind !== selected) {
      pickup(occupant.kind);
      return;
    }
    if (selected !== undefined) placeAt(at);
  };

  return (
    <section className="placement">
      <div className="tray" aria-label="Ships to place">
        <h2>Your ships</h2>
        <ul className="ship-list">
          {SHIP_KINDS.map((kind) => {
            const placed = placedKinds.has(kind);
            return (
              <li key={kind}>
                <button
                  type="button"
                  className={`ship-pick${kind === selected ? ' selected' : ''}${placed ? ' placed' : ''}`}
                  aria-pressed={kind === selected}
                  onClick={() => select(kind)}
                >
                  <span>
                    {SHIP_NAMES[kind]} ({SHIP_SIZES[kind]})
                  </span>
                  <span className="pips" aria-hidden="true">
                    {'■'.repeat(SHIP_SIZES[kind])}
                  </span>
                  <span className="ship-state">{placed ? 'placed' : 'to place'}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <fieldset className="difficulty">
          <legend>Opponent</legend>
          {DIFFICULTIES.map((d) => (
            <label key={d}>
              <input
                type="radio"
                name="difficulty"
                value={d}
                checked={game.difficulty === d}
                onChange={() => setDifficulty(d)}
              />
              <span>
                <strong>{DIFFICULTY_NAMES[d]}</strong> — “{DIFFICULTY_CALLSIGNS[d]}”
                <span className="hint">{DIFFICULTY_HINTS[d]}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="controls">
          <button type="button" onClick={rotate} aria-describedby="orientation">
            Rotate (R)
          </button>
          <span id="orientation" className="orientation" aria-live="polite">
            {orientation === 'h' ? 'Horizontal' : 'Vertical'}
          </span>
          <button type="button" onClick={randomize}>
            Randomize fleet
          </button>
          <button
            type="button"
            className={`primary${fleetComplete(board) ? ' attention' : ''}`}
            disabled={!fleetComplete(board)}
            onClick={confirm}
          >
            Continue to coin flip
          </button>
        </div>
        <p className="hint">
          {selected === undefined
            ? 'Fleet in position, Captain. Click a ship on the board to move it, or continue.'
            : `Placing ${SHIP_NAMES[selected]}: click or focus a cell and press Enter for its bow. Click a placed ship to pick it up.`}
        </p>
      </div>
      <Board
        title="Your fleet"
        board={board}
        showShips
        mode="place"
        interactive
        onCellClick={onCellClick}
        onCellHover={setHover}
        preview={preview}
      />
    </section>
  );
};
