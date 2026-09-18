import type { Coin } from '../engine/types';

type Props = {
  coin: Coin | undefined;
  flipping: boolean;
  flip: () => void;
};

/** Heads: the captain's anchor. */
const Anchor = () => (
  <svg viewBox="0 0 48 48">
    <circle cx="24" cy="9" r="4" />
    <path d="M24 13v29" />
    <path d="M14 20h20" />
    <path d="M8 30c2 8 9 12 16 12s14-4 16-12" />
    <path d="M8 30l-3-3M8 30l4-1M40 30l3-3M40 30l-4-1" />
  </svg>
);

/** Tails: the enemy's periscope crosshair. */
const Crosshair = () => (
  <svg viewBox="0 0 48 48">
    <circle cx="24" cy="24" r="15" />
    <circle cx="24" cy="24" r="4" />
    <path d="M24 4v9M24 35v9M4 24h9M35 24h9" />
  </svg>
);

export const CoinFlip = ({ coin, flipping, flip }: Props) => {
  const flipped = coin !== undefined;
  const face = coin === 'tails' && !flipping ? 'tails' : 'heads';
  return (
    <section className="coinflip" aria-labelledby="coin-title">
      <h2 id="coin-title">Who fires first?</h2>
      <div className={`coin ${face}${flipping ? ' spinning' : ''}`} aria-hidden="true">
        {face === 'heads' ? <Anchor /> : <Crosshair />}
      </div>
      <button type="button" className="primary big" disabled={flipped} onClick={flip}>
        Flip coin
      </button>
      <p role="status" aria-live="polite">
        {flipping
          ? 'Flipping…'
          : coin === 'heads'
            ? 'Heads — you have the first salvo'
            : coin === 'tails'
              ? 'Tails — enemy opens fire'
              : 'Heads (anchor): you fire first. Tails (crosshair): the enemy fires first.'}
      </p>
    </section>
  );
};
