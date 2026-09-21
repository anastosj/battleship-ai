import { useEffect, useRef, useState } from 'react';
import { DIFFICULTY_NAMES, normalizedDensity } from './ai';
import { toAIView } from './engine/game';
import { Board } from './ui/Board';
import { CoinFlip } from './ui/CoinFlip';
import { FleetPanel } from './ui/FleetPanel';
import { GameOverModal } from './ui/GameOverModal';
import { HistoryPanel } from './ui/HistoryPanel';
import { LeaderboardPanel } from './ui/LeaderboardPanel';
import { PlacementScreen } from './ui/PlacementScreen';
import { useGame } from './ui/useGame';
import { useLeaderboard } from './ui/useLeaderboard';
import { useMatchHistory } from './ui/useMatchHistory';

/** `seed` pins the AI fleet, randomize draws, and the coin flip (tests only). */
export const App = ({ seed }: { seed?: number } = {}) => {
  const g = useGame(seed);
  const { game, flipping, coinBusy } = g;
  const history = useMatchHistory(game);
  const leaderboard = useLeaderboard(game);
  const humanTurn = game.phase === 'playing' && !coinBusy && game.turn === 'human';
  const report = `${g.lastHuman} ${g.lastAi}`.trim();
  const [showThreat, setShowThreat] = useState(false);
  const threat =
    showThreat && (game.phase === 'playing' || game.phase === 'gameover')
      ? normalizedDensity(toAIView(game))
      : undefined;
  /** The phone status box scrolls; a new report must start at its top. */
  const status = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (status.current) status.current.scrollTop = 0;
  }, [report, humanTurn]);

  return (
    <main>
      <header>
        <h1>Battleship: Captain Devin</h1>
        {game.phase !== 'placement' && (
          <div className="header-right">
            <span className="badge" aria-label={`Opponent: ${DIFFICULTY_NAMES[game.difficulty]}`}>
              {DIFFICULTY_NAMES[game.difficulty]}
            </span>
            <button type="button" onClick={g.reset}>
              New game
            </button>
          </div>
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
          setDifficulty={g.setDifficulty}
        />
      )}
      {game.phase === 'placement' && (
        <>
          <LeaderboardPanel entries={leaderboard.entries} clear={leaderboard.clear} />
          <HistoryPanel matches={history.matches} clear={history.clear} />
        </>
      )}

      {(game.phase === 'coinflip' || coinBusy) && (
        <CoinFlip coin={game.coin} flipping={flipping} flip={g.flip} />
      )}

      {(game.phase === 'playing' || game.phase === 'gameover') && !coinBusy && (
        <>
          <p className="status" role="status" aria-live="polite" ref={status}>
            {report}
            {game.phase === 'playing' && (
              <span className="turn">
                {' '}
                {humanTurn ? 'Your turn, Captain — fire!' : 'Enemy is thinking…'}
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
                heat={threat}
              />
              <label className="threat-toggle">
                <input
                  type="checkbox"
                  checked={showThreat}
                  onChange={(e) => setShowThreat(e.target.checked)}
                />
                <span>
                  Show AI threat map
                  <span className="hint">
                    Brighter = more ways a surviving ship could still lie there, given the
                    enemy&rsquo;s shots so far. &ldquo;No Pacing the Frontier&rdquo; fires at the
                    brightest cell.
                  </span>
                </span>
              </label>
              <FleetPanel title="Your ships" board={game.human} />
            </div>
            <div className="side enemy">
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

      {game.phase === 'gameover' && (
        <GameOverModal game={game} playAgain={g.reset} leaderboard={leaderboard} />
      )}
    </main>
  );
};
