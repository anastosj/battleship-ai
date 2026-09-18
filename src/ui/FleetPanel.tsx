import { isSunk, shotCount } from '../engine/board';
import { SHIP_KINDS, SHIP_NAMES, SHIP_SIZES, type Board } from '../engine/types';

type Props = { title: string; board: Board };

/** Afloat/sunk per ship for one side. Sunk status is public information in Battleship. */
export const FleetPanel = ({ title, board }: Props) => (
  <section className="fleet" aria-label={title}>
    <h3>{title}</h3>
    <ul>
      {SHIP_KINDS.map((kind) => {
        const ship = board.ships.find((s) => s.kind === kind);
        const sunk = ship !== undefined && isSunk(board, ship);
        return (
          <li key={kind} className={sunk ? 'sunk' : 'afloat'}>
            <span aria-hidden="true">{sunk ? '✕' : '●'}</span> {SHIP_NAMES[kind]} (
            {SHIP_SIZES[kind]}) — {sunk ? 'sunk' : 'afloat'}
          </li>
        );
      })}
    </ul>
    <p className="shots">Shots taken against this fleet: {shotCount(board)}</p>
  </section>
);
