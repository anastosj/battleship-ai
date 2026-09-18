import { Board } from './ui/Board';
import { CoinFlip } from './ui/CoinFlip';
import { FleetPanel } from './ui/FleetPanel';
import { GameOverModal } from './ui/GameOverModal';
import { PlacementScreen } from './ui/PlacementScreen';
import { useGame } from './ui/useGame';

/** `seed` pins the AI fleet, randomize draws, and the coin flip (tests only). */
export const App = ({ seed }: { seed?: number } = {}) => {
  const g = useGame(seed);
  const { game, flipping } = g;
  const humanTurn = game.phase === 'playing' && !flipping && game.turn === 'human';

  return (
    <main>
      <header>
        <h1>Battleship vs. AI</h1>
        {game.phase !== 'placement' && (
          <button type="button" onClick={g.reset}>
            New game
          </button>
        )}
      </header>

      {game.phase === 'placement' && (
        <PlacementScreen
          game={game}
          selected={g.selected}
          orientation={g.orientation}
          select={g.select}
          rotate={g.rotate}
          placeAt={g.placeAt}
          pickup={g.pickup}
          randomize={g.randomize}
          confirm={g.confirm}
        />
      )}

      {(game.phase === 'coinflip' || flipping) && (
        <CoinFlip coin={game.coin} flipping={flipping} flip={g.flip} />
      )}

      {(game.phase === 'playing' || game.phase === 'gameover') && !flipping && (
        <>
          <p className="status" role="status" aria-live="polite">
            {`${g.lastHuman} ${g.lastAi}`.trim()}
            {game.phase === 'playing' && (
              <span className="turn">
                {' '}
                {humanTurn ? 'Your turn — fire!' : 'Enemy is thinking…'}
              </span>
            )}
          </p>

          <div className="boards">
            <div className="side">
              <Board
                title="Your fleet"
                board={game.human}
                showShips
                mode="fire"
                interactive={false}
              />
              <FleetPanel title="Your ships" board={game.human} />
            </div>
            <div className="side">
              <Board
                title="Enemy waters"
                board={game.ai}
                showShips={game.phase === 'gameover'}
                mode="fire"
                interactive={humanTurn}
                onCellClick={g.fireAt}
              />
              <FleetPanel title="Enemy ships" board={game.ai} />
            </div>
          </div>
        </>
      )}

      {game.phase === 'gameover' && <GameOverModal game={game} playAgain={g.reset} />}
    </main>
  );
};
