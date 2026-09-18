import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { randomFleet } from '../src/engine/fleet';
import { confirmFleet, flipCoin, setHumanFleet, startGame } from '../src/engine/game';
import { makeRng } from '../src/engine/rng';
import { shipCells as engineShipCells } from '../src/engine/board';
import { cellLabel } from '../src/ui/cellLabel';
import { AI_DELAY_MS, COIN_FLIP_MS, uiRng } from '../src/ui/useGame';
import { ErrorBoundary } from '../src/ui/ErrorBoundary';

const grid = (name: string) => screen.getByRole('grid', { name });
const shipCells = (g: HTMLElement) => g.querySelectorAll('.cell.ship').length;
const shipKeys = (g: HTMLElement) =>
  [...g.querySelectorAll('.cell.ship')].map((el) => el.getAttribute('aria-label')).join('|');
const marks = (g: HTMLElement) => g.querySelectorAll('.cell.miss, .cell.hit, .cell.sunk').length;

/** Seed whose "Randomize → Continue → Flip" path lands on the requested side (same RNG stream as the app). */
const seedFor = (coin: 'heads' | 'tails'): number => {
  for (let seed = 1; seed < 1000; seed++) {
    const rng = uiRng(seed);
    randomFleet(rng);
    const game = flipCoin(
      confirmFleet(setHumanFleet(startGame(seed), randomFleet(makeRng(0)))),
      rng,
    );
    if (game.coin === coin) return seed;
  }
  throw new Error('unreachable');
};

/** Randomize → Continue → Flip, then advance past the reveal so play has begun. */
const startWith = (coin: 'heads' | 'tails') => {
  render(<App seed={seedFor(coin)} />);
  fireEvent.click(screen.getByRole('button', { name: 'Randomize fleet' }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue to coin flip' }));
  fireEvent.click(screen.getByRole('button', { name: 'Flip coin' }));
  act(() => {
    vi.advanceTimersByTime(COIN_FLIP_MS + 10);
  });
  expect(screen.getByRole('status').textContent).toMatch(coin === 'heads' ? /^Heads/ : /^Tails/);
};

describe('placement', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts in placement with an empty board and Continue disabled', () => {
    render(<App />);
    expect(shipCells(grid('Your fleet'))).toBe(0);
    expect(screen.getByRole('button', { name: 'Continue to coin flip' })).toBeDisabled();
    expect(screen.queryByRole('grid', { name: 'Enemy waters' })).toBeNull();
  });

  it('places ships by clicking, auto-advances the selection, and rotates with R', () => {
    render(<App />);
    const own = grid('Your fleet');
    fireEvent.click(within(own).getByRole('button', { name: 'A1, water' }));
    expect(shipCells(own)).toBe(5); // carrier, horizontal A1–E1
    expect(screen.getByRole('button', { name: /^Battleship/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.keyDown(window, { key: 'r' });
    expect(screen.getByRole('button', { name: 'Rotate (R)' })).toHaveAccessibleDescription(
      'Vertical',
    );
    fireEvent.click(within(own).getByRole('button', { name: 'A2, water' }));
    expect(shipCells(own)).toBe(9); // battleship vertical A2–A5
    expect(within(own).getByRole('button', { name: 'A5, ship' })).toBeInTheDocument();
    expect(within(own).getByRole('button', { name: 'A5, ship' }).textContent).toBe('▮');
  });

  it('rejects an illegal placement and shows a red preview for it', () => {
    render(<App />);
    const own = grid('Your fleet');
    const j1 = within(own).getByRole('button', { name: 'J1, water' });
    fireEvent.mouseEnter(j1);
    expect(j1.className).toContain('preview-bad');
    fireEvent.click(j1);
    expect(shipCells(own)).toBe(0);

    const a1 = within(own).getByRole('button', { name: 'A1, water' });
    fireEvent.mouseEnter(a1);
    expect(a1.className).toContain('preview-ok');
    expect(within(own).getByRole('button', { name: 'E1, water' }).className).toContain(
      'preview-ok',
    );
  });

  it('picks a placed ship back up when clicked', () => {
    render(<App />);
    const own = grid('Your fleet');
    fireEvent.click(within(own).getByRole('button', { name: 'A1, water' }));
    fireEvent.click(within(own).getByRole('button', { name: 'A3, water' })); // battleship
    expect(shipCells(own)).toBe(9);
    fireEvent.click(within(own).getByRole('button', { name: 'C1, ship' })); // pick up carrier
    expect(shipCells(own)).toBe(4);
    expect(screen.getByRole('button', { name: /^Carrier/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('Randomize fills the fleet and every press produces a different one', () => {
    render(<App />);
    const own = grid('Your fleet');
    const randomize = screen.getByRole('button', { name: 'Randomize fleet' });
    fireEvent.click(randomize);
    expect(shipCells(own)).toBe(17);
    expect(screen.getByRole('button', { name: 'Continue to coin flip' })).toBeEnabled();
    const seen = new Set<string>([shipKeys(own)]);
    for (let i = 0; i < 5; i++) {
      fireEvent.click(randomize);
      expect(shipCells(own)).toBe(17);
      seen.add(shipKeys(own));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('the first Randomize never hands the player a copy of the enemy fleet', () => {
    for (const seed of [1, 2, 3, 42, 4242]) {
      const { unmount } = render(<App seed={seed} />);
      fireEvent.click(screen.getByRole('button', { name: 'Randomize fleet' }));
      const human = shipKeys(grid('Your fleet'));
      const enemy = randomFleet(makeRng(seed)); // what startGame(seed) gives the AI
      const enemyKeys = enemy
        .flatMap((s) => engineShipCells(s))
        .map((c) => cellLabel(c))
        .sort()
        .join('|');
      const humanKeys = human
        .split('|')
        .map((l) => l.replace(', ship', ''))
        .sort()
        .join('|');
      expect(humanKeys).not.toBe(enemyKeys);
      unmount();
    }
  });
});

describe('coin flip', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('cannot be pressed twice and the result is definitive', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Randomize fleet' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue to coin flip' }));
    const flip = screen.getByRole('button', { name: 'Flip coin' });
    expect(flip).toBeEnabled();
    fireEvent.click(flip);
    expect(flip).toBeDisabled();
    expect(screen.getByRole('status').textContent).toContain('Flipping');
    fireEvent.click(flip);
    act(() => {
      vi.advanceTimersByTime(COIN_FLIP_MS + 10);
    });
    expect(screen.queryByRole('button', { name: 'Flip coin' })).toBeNull();
    expect(screen.getByRole('status').textContent).toMatch(/^(Heads|Tails)/);
    expect(screen.getByRole('grid', { name: 'Enemy waters' })).toBeInTheDocument();
  });

  it('the AI does not fire while the coin is still spinning', () => {
    startWith('tails');
    // Reveal has just happened; the AI's 250 ms clock starts now, not during the spin.
    expect(marks(grid('Your fleet'))).toBe(0);
    act(() => {
      vi.advanceTimersByTime(AI_DELAY_MS + 10);
    });
    expect(marks(grid('Your fleet'))).toBe(1);
    expect(screen.getByRole('status').textContent).toContain('Your turn');
  });

  it('heads: human fires first and the AI replies once after 250 ms', () => {
    startWith('heads');
    expect(screen.getByRole('status').textContent).toContain('Your turn');
    act(() => {
      vi.advanceTimersByTime(AI_DELAY_MS * 4);
    });
    expect(marks(grid('Your fleet'))).toBe(0);

    fireEvent.click(within(grid('Enemy waters')).getByRole('button', { name: 'J10, water' }));
    expect(screen.getByRole('status').textContent).toContain('Enemy is thinking');
    expect(within(grid('Enemy waters')).getByRole('button', { name: 'A1, water' })).toBeDisabled();
    act(() => {
      vi.advanceTimersByTime(AI_DELAY_MS + 10);
    });
    expect(marks(grid('Your fleet'))).toBe(1);
    act(() => {
      vi.advanceTimersByTime(AI_DELAY_MS * 4);
    });
    expect(marks(grid('Your fleet'))).toBe(1);
    expect(screen.getByRole('status').textContent).toMatch(/Enemy (missed|hit|sank)/);
  });
});

describe('game over and play again', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows the modal with shot counts, reveals enemy ships, and Play again returns to placement', () => {
    startWith('tails');
    // Let the AI win: it fires every 250 ms once the human gives it turns; we shoot misses-or-not
    // until the game ends (AI always finishes within 100 shots).
    for (let i = 0; i < 100 && !screen.queryByRole('dialog'); i++) {
      act(() => {
        vi.advanceTimersByTime(AI_DELAY_MS + 10);
      });
      if (screen.queryByRole('dialog')) break;
      const enemy = grid('Enemy waters');
      const target = within(enemy)
        .getAllByRole('button')
        .find((b) => !b.hasAttribute('disabled'));
      if (target) fireEvent.click(target);
    }
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toMatch(/You (win|lose)/);
    const cells = (name: string) => {
      const row = within(dialog)
        .getAllByRole('row')
        .find((r) => within(r).queryByRole('rowheader', { name }) !== null);
      if (row === undefined) throw new Error(`no ${name} row`);
      return within(row).getAllByRole('cell');
    };
    const hits = cells('Hits').map((c) => c.textContent);
    expect(hits).toHaveLength(2);
    const winnerHits = /You win/.test(dialog.textContent ?? '') ? hits[0] : hits[1];
    expect(winnerHits).toBe('17 / 17');
    expect(cells('Shots').map((c) => c.textContent)).toEqual([
      expect.stringMatching(/^\d+$/),
      expect.stringMatching(/^\d+$/),
    ]);
    expect(cells('Accuracy').map((c) => c.textContent)).toEqual([
      expect.stringMatching(/^\d+%$/),
      expect.stringMatching(/^\d+%$/),
    ]);
    expect(shipCells(grid('Enemy waters')) + marks(grid('Enemy waters'))).toBeGreaterThanOrEqual(
      17,
    );

    fireEvent.click(within(dialog).getByRole('button', { name: 'Play again' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Randomize fleet' })).toBeInTheDocument();
    expect(shipCells(grid('Your fleet'))).toBe(0);
  });

  it('New game mid-AI-turn cancels the pending AI shot', () => {
    startWith('tails');
    fireEvent.click(screen.getByRole('button', { name: 'New game' }));
    expect(screen.getByRole('button', { name: 'Randomize fleet' })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(AI_DELAY_MS * 4);
    });
    expect(marks(grid('Your fleet'))).toBe(0);
    expect(screen.queryByRole('grid', { name: 'Enemy waters' })).toBeNull();
  });
});

describe('error boundary', () => {
  it('renders a recovery message instead of a white screen when a child throws', () => {
    const Boom = () => {
      throw new Error('kaboom');
    };
    const silence = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    silence.mockRestore();
    expect(screen.getByRole('alert').textContent).toContain('Something went wrong');
    expect(screen.getByText('kaboom')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload the game' })).toBeInTheDocument();
  });
});
