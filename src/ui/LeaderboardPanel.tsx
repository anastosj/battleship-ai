import { DIFFICULTY_NAMES } from '../ai';
import { MAX_ENTRIES, type LeaderboardEntry } from '../history/leaderboard';

type Props = { entries: readonly LeaderboardEntry[]; clear: () => void };

const when = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { dateStyle: 'medium' });
};

export const LeaderboardPanel = ({ entries, clear }: Props) => {
  if (entries.length === 0) return null;
  return (
    <section className="history leaderboard" aria-labelledby="leaderboard-title">
      <div className="history-head">
        <h2 id="leaderboard-title">Hall of Captains</h2>
        <span className="history-summary">Top {MAX_ENTRIES} victories by fewest shots</span>
        <button type="button" onClick={clear}>
          Clear leaderboard
        </button>
      </div>
      <div className="history-scroll">
        <table
          className="stats history-table leaderboard-table"
          aria-labelledby="leaderboard-title"
        >
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Name</th>
              <th scope="col">Shots</th>
              <th scope="col">Opponent</th>
              <th scope="col">When</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={e.id}>
                <td>{i + 1}</td>
                <td>{e.name}</td>
                <td>{e.shots}</td>
                <td>{DIFFICULTY_NAMES[e.difficulty]}</td>
                <td>{when(e.playedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
