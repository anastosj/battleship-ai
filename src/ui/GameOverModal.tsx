import { useEffect, useRef } from 'react';
import { fleetCellCount, hitCount, shotCount } from '../engine/board';
import type { GameState } from '../engine/types';

type Props = { game: GameState; playAgain: () => void };

const pct = (hits: number, shots: number): string =>
  shots === 0 ? '—' : `${Math.round((100 * hits) / shots)}%`;

export const GameOverModal = ({ game, playAgain }: Props) => {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    button.current?.focus();
    const keep = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        button.current?.focus();
      }
    };
    window.addEventListener('keydown', keep);
    return () => window.removeEventListener('keydown', keep);
  }, []);

  const won = game.winner === 'human';
  const yourShots = shotCount(game.ai);
  const enemyShots = shotCount(game.human);
  const yourHits = hitCount(game.ai);
  const enemyHits = hitCount(game.human);
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="gameover-title">
        <h2 id="gameover-title">{won ? 'You win!' : 'You lose'}</h2>
        <p>
          {won
            ? `All enemy ships sunk in ${shotCount(game.ai)} shots.`
            : `The enemy sank your fleet in ${shotCount(game.human)} shots.`}
        </p>
        <table className="stats">
          <thead>
            <tr>
              <th scope="col"></th>
              <th scope="col">You</th>
              <th scope="col">Enemy</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Shots</th>
              <td>{yourShots}</td>
              <td>{enemyShots}</td>
            </tr>
            <tr>
              <th scope="row">Hits</th>
              <td>
                {yourHits} / {fleetCellCount(game.ai)}
              </td>
              <td>
                {enemyHits} / {fleetCellCount(game.human)}
              </td>
            </tr>
            <tr>
              <th scope="row">Accuracy</th>
              <td>{pct(yourHits, yourShots)}</td>
              <td>{pct(enemyHits, enemyShots)}</td>
            </tr>
          </tbody>
        </table>
        <button ref={button} type="button" className="primary" onClick={playAgain}>
          Play again
        </button>
      </div>
    </div>
  );
};
