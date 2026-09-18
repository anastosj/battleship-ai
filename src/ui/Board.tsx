import { markAt, shipAt } from '../engine/board';
import { cellLabel } from './cellLabel';
import { BOARD_SIZE, type Board as BoardState, type Coord } from '../engine/types';

type Props = {
  title: string;
  board: BoardState;
  showShips: boolean;
  interactive: boolean;
  onFire?: (at: Coord) => void;
};

export const Board = ({ title, board, showShips, interactive, onFire }: Props) => {
  const rows = Array.from({ length: BOARD_SIZE }, (_, row) => row);
  return (
    <section className="board">
      <h2>{title}</h2>
      <div className="grid" role="grid" aria-label={title}>
        {rows.map((row) =>
          rows.map((col) => {
            const c = { row, col };
            const mark = markAt(board, c);
            const ship = showShips ? shipAt(board, c) : undefined;
            const state = mark ?? (ship ? 'ship' : 'water');
            const glyph = mark === 'hit' ? '✕' : mark === 'miss' ? '•' : '';
            return (
              <button
                key={`${row}-${col}`}
                type="button"
                className={`cell ${state}`}
                aria-label={`${cellLabel(c)}, ${state}`}
                disabled={!interactive || mark !== undefined}
                onClick={() => onFire?.(c)}
              >
                {glyph}
              </button>
            );
          }),
        )}
      </div>
    </section>
  );
};
