import type { Coin } from '../engine/types';

type Props = {
  coin: Coin | undefined;
  flipping: boolean;
  flip: () => void;
};

export const CoinFlip = ({ coin, flipping, flip }: Props) => {
  const flipped = coin !== undefined;
  return (
    <section className="coinflip" aria-labelledby="coin-title">
      <h2 id="coin-title">Who fires first?</h2>
      <div className={`coin${flipping ? ' spinning' : ''}`} aria-hidden="true">
        {flipping || !coin ? '?' : coin === 'heads' ? 'H' : 'T'}
      </div>
      <button type="button" className="primary big" disabled={flipped} onClick={flip}>
        Flip coin
      </button>
      <p role="status" aria-live="polite">
        {flipping
          ? 'Flipping…'
          : coin === 'heads'
            ? 'Heads — you fire first'
            : coin === 'tails'
              ? 'Tails — enemy fires first'
              : 'Heads: you fire first. Tails: the enemy fires first.'}
      </p>
    </section>
  );
};
