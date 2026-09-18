import { useEffect, useRef } from 'react';
import { shotCount } from '../engine/board';
import type { GameState } from '../engine/types';

type Props = { game: GameState; playAgain: () => void };

export const GameOverModal = ({ game, playAgain }: Props) => {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => button.current?.focus(), []);

  const won = game.winner === 'human';
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="gameover-title">
        <h2 id="gameover-title">{won ? 'You win!' : 'You lose'}</h2>
        <p>
          {won
            ? `All enemy ships sunk in ${shotCount(game.ai)} shots.`
            : `The enemy sank your fleet in ${shotCount(game.human)} shots.`}
        </p>
        <p>
          Your shots: {shotCount(game.ai)} · Enemy shots: {shotCount(game.human)}
        </p>
        <button ref={button} type="button" className="primary" onClick={playAgain}>
          Play again
        </button>
      </div>
    </div>
  );
};
