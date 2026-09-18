import { shotCount } from './engine/board';
import { Board } from './ui/Board';
import { useGame } from './ui/useGame';

export const App = () => {
  const { game, lastHuman, lastAi, fireAt, reset } = useGame();
  const humanTurn = game.phase === 'playing' && game.turn === 'human';

  return (
    <main>
      <header>
        <h1>Battleship vs. AI</h1>
        <button type="button" onClick={reset}>
          New game
        </button>
      </header>

      <p className="status" role="status" aria-live="polite">
        {game.phase === 'gameover'
          ? game.winner === 'human'
            ? `You win! All enemy ships sunk in ${shotCount(game.ai)} shots.`
            : `You lose — the enemy sank your fleet in ${shotCount(game.human)} shots.`
          : `${lastHuman} ${lastAi}`.trim()}
        {game.phase === 'playing' && (
          <span className="turn"> {humanTurn ? 'Your turn.' : 'Enemy is thinking…'}</span>
        )}
      </p>

      <div className="boards">
        <Board title="Your fleet" board={game.human} showShips interactive={false} />
        <Board
          title="Enemy waters"
          board={game.ai}
          showShips={game.phase === 'gameover'}
          interactive={humanTurn}
          onFire={fireAt}
        />
      </div>
    </main>
  );
};
