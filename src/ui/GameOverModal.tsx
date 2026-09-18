import { useEffect, useRef, useState, type FormEvent } from 'react';
import { fleetCellCount, hitCount, shotCount } from '../engine/board';
import type { GameState } from '../engine/types';
import { MAX_NAME_LENGTH, normalizeName } from '../history/leaderboard';

export type LeaderboardPrompt = {
  qualifying: boolean;
  saved: boolean;
  rank: number | undefined;
  lastName: string;
  submit: (name: string) => boolean;
};

type Props = { game: GameState; playAgain: () => void; leaderboard: LeaderboardPrompt };

const pct = (hits: number, shots: number): string =>
  shots === 0 ? '—' : `${Math.round((100 * hits) / shots)}%`;

const FOCUSABLE = 'input:not([disabled]), button:not([disabled])';

export const GameOverModal = ({ game, playAgain, leaderboard }: Props) => {
  const modal = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(leaderboard.lastName);

  useEffect(() => {
    const el = modal.current;
    if (!el) return;
    const focusables = () => [...el.querySelectorAll<HTMLElement>(FOCUSABLE)];
    focusables()[0]?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (!el.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', trap);
    return () => window.removeEventListener('keydown', trap);
  }, []);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    leaderboard.submit(name);
  };

  const won = game.winner === 'human';
  const yourShots = shotCount(game.ai);
  const enemyShots = shotCount(game.human);
  const yourHits = hitCount(game.ai);
  const enemyHits = hitCount(game.human);
  return (
    <div className="modal-backdrop">
      <div
        ref={modal}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gameover-title"
      >
        <h2 id="gameover-title" className={won ? 'won' : 'lost'}>
          {won ? 'Victory, Captain — You win!' : 'Fleet lost — You lose'}
        </h2>
        <p>
          {won
            ? `All enemy ships sunk in ${shotCount(game.ai)} shots.`
            : `The enemy sank your fleet in ${shotCount(game.human)} shots. The frontier waits for no one.`}
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

        {leaderboard.qualifying && (
          <form className="leaderboard-prompt" onSubmit={onSubmit}>
            <p className="leaderboard-callout">
              {yourShots} shots earns a place in the Hall of Captains!
            </p>
            <label>
              Captain's name
              <input
                type="text"
                value={name}
                maxLength={MAX_NAME_LENGTH}
                autoComplete="nickname"
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <button type="submit" disabled={normalizeName(name) === ''}>
              Enter the Hall
            </button>
          </form>
        )}
        {leaderboard.saved && (
          <p className="leaderboard-callout" role="status">
            {leaderboard.rank === undefined
              ? 'Saved to the Hall of Captains.'
              : `Saved — you're #${leaderboard.rank} in the Hall of Captains.`}
          </p>
        )}

        <button type="button" className="primary" onClick={playAgain}>
          Play again
        </button>
      </div>
    </div>
  );
};
