import type { MouseEvent, PointerEvent } from 'react';
import { isSunk, markAt, shipAt } from '../engine/board';
import { cellLabel } from './cellLabel';
import { BOARD_SIZE, coordKey, type Board as BoardState, type Coord } from '../engine/types';

export type Preview = { cells: readonly Coord[]; legal: boolean };

/** Every non-water state has a glyph so it is never conveyed by colour alone (F7). */
const GLYPH = { water: '', ship: '▮', miss: '•', hit: '✕', sunk: '☒' } as const;

type Props = {
  title: string;
  board: BoardState;
  showShips: boolean;
  /** 'fire': untargeted cells are clickable. 'place': every cell is clickable. */
  mode: 'fire' | 'place';
  interactive: boolean;
  onCellClick?: (at: Coord) => void;
  onCellHover?: (at: Coord | undefined) => void;
  preview?: Preview;
};

export const Board = ({
  title,
  board,
  showShips,
  mode,
  interactive,
  onCellClick,
  onCellHover,
  preview,
}: Props) => {
  const rows = Array.from({ length: BOARD_SIZE }, (_, row) => row);
  const previewKeys = new Set(preview?.cells.map(coordKey));
  /** Touch has no hover: a finger that tapped a cell would otherwise leave the preview stuck under it. */
  const pointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.dataset.touch = e.pointerType === 'mouse' ? '' : '1';
  };
  const pointerCancel = (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.dataset.touch = '';
  };
  const click = (c: Coord, e: MouseEvent<HTMLButtonElement>) => {
    const touch = e.currentTarget.dataset.touch === '1';
    e.currentTarget.dataset.touch = '';
    onCellClick?.(c);
    if (touch) onCellHover?.(undefined);
  };
  return (
    <section className="board">
      <h2>{title}</h2>
      <div
        className="grid"
        role="grid"
        aria-label={title}
        onMouseLeave={onCellHover ? () => onCellHover(undefined) : undefined}
      >
        {rows.map((row) =>
          rows.map((col) => {
            const c = { row, col };
            const mark = markAt(board, c);
            const hitShip = mark === 'hit' ? shipAt(board, c) : undefined;
            const sunk = hitShip !== undefined && isSunk(board, hitShip);
            const ship = showShips ? shipAt(board, c) : undefined;
            const state = sunk ? 'sunk' : (mark ?? (ship ? 'ship' : 'water'));
            const glyph = GLYPH[state];
            const previewClass = previewKeys.has(coordKey(c))
              ? preview?.legal
                ? ' preview-ok'
                : ' preview-bad'
              : '';
            const disabled = !interactive || (mode === 'fire' && mark !== undefined);
            return (
              <button
                key={`${row}-${col}`}
                type="button"
                className={`cell ${state}${previewClass}`}
                aria-label={`${cellLabel(c)}, ${state}`}
                disabled={disabled}
                onPointerDown={pointerDown}
                onPointerCancel={pointerCancel}
                onClick={(e) => click(c, e)}
                onMouseEnter={onCellHover ? () => onCellHover(c) : undefined}
                onFocus={onCellHover ? () => onCellHover(c) : undefined}
              >
                <span aria-hidden="true">{glyph}</span>
              </button>
            );
          }),
        )}
      </div>
    </section>
  );
};
