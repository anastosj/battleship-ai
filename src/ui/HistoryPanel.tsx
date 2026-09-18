import { DIFFICULTY_NAMES } from '../ai';
import type { MatchRecord, SideStats } from '../history/matches';

type Props = { matches: readonly MatchRecord[]; clear: () => void };

const accuracy = (s: SideStats): string =>
  s.shots === 0 ? '—' : `${Math.round((100 * s.hits) / s.shots)}%`;

const when = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

export const HistoryPanel = ({ matches, clear }: Props) => {
  if (matches.length === 0) return null;
  const wins = matches.filter((m) => m.winner === 'human').length;
  return (
    <section className="history" aria-labelledby="history-title">
      <div className="history-head">
        <h2 id="history-title">Previous matches</h2>
        <span className="history-summary">
          {wins}–{matches.length - wins} vs. the AI
        </span>
        <button type="button" onClick={clear}>
          Clear history
        </button>
      </div>
      <div className="history-scroll">
        <table className="stats history-table">
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Opponent</th>
              <th scope="col">Result</th>
              <th scope="col">Your shots</th>
              <th scope="col">Your hits</th>
              <th scope="col">Accuracy</th>
              <th scope="col">Enemy hits</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => (
              <tr key={m.id} className={m.winner === 'human' ? 'won' : 'lost'}>
                <td>{when(m.playedAt)}</td>
                <td>{DIFFICULTY_NAMES[m.difficulty]}</td>
                <td>{m.winner === 'human' ? 'Won' : 'Lost'}</td>
                <td>{m.you.shots}</td>
                <td>
                  {m.you.hits} / {m.you.fleetCells}
                </td>
                <td>{accuracy(m.you)}</td>
                <td>
                  {m.enemy.hits} / {m.enemy.fleetCells}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
