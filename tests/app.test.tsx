import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { randomFleet } from '../src/engine/fleet';
import { confirmFleet, flipCoin, setHumanFleet, startGame } from '../src/engine/game';
import { makeRng } from '../src/engine/rng';
import { shipCells as engineShipCells } from '../src/engine/board';
import { cellLabel } from '../src/ui/cellLabel';
import { AI_DELAY_MS, COIN_FLIP_MS, COIN_REVEAL_MS, uiRng } from '../src/ui/useGame';
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

/** Advance through the spin, then (after React commits the landed face) through the reveal hold. */
const settleCoin = () => {
  act(() => {
    vi.advanceTimersByTime(COIN_FLIP_MS + 10);
  });
  act(() => {
    vi.advanceTimersByTime(COIN_REVEAL_MS + 10);
  });
};

/** Randomize → Continue → Flip, then advance past the reveal so play has begun. */
const startWith = (coin: 'heads' | 'tails') => {
  render(<App seed={seedFor(coin)} />);
  fireEvent.click(screen.getByRole('button', { name: 'Randomize fleet' }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue to coin flip' }));
  fireEvent.click(screen.getByRole('button', { name: 'Flip coin' }));
  settleCoin();
  expect(screen.getByRole('status').textContent).toMatch(coin === 'heads' ? /^Heads/ : /^Tails/);
};

describe('placement', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts in placement with an empty board and Continue disabled', () => {
    render(<App />);
    expect(shipCells(grid('Your fleet'))).toBe(0);
    const cont = screen.getByRole('button', { name: 'Continue to coin flip' });
    expect(cont).toBeDisabled();
    expect(cont).not.toHaveClass('attention');
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

  it('a touch tap leaves no preview outline stuck under the finger', () => {
    render(<App />);
    const own = grid('Your fleet');
    const j1 = within(own).getByRole('button', { name: 'J1, water' });
    fireEvent.mouseEnter(j1); // touch browsers synthesize hover on tap
    fireEvent.pointerDown(j1, { pointerType: 'mouse' });
    fireEvent.click(j1); // illegal: a mouse keeps the red preview under the cursor
    expect(j1.className).toContain('preview-bad');

    fireEvent.pointerDown(j1, { pointerType: 'touch' });
    fireEvent.click(j1);
    expect(own.querySelectorAll('.preview-ok, .preview-bad').length).toBe(0);

    // A later keyboard activation (no pointerdown) must not inherit the touch cleanup.
    fireEvent.focus(j1);
    fireEvent.click(j1);
    expect(j1.className).toContain('preview-bad');
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
    const cont = screen.getByRole('button', { name: 'Continue to coin flip' });
    expect(cont).toBeEnabled();
    expect(cont).toHaveClass('attention');
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

describe('difficulty', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('defaults to Hard, can be switched during placement, and disappears once the fleet is confirmed', () => {
    render(<App seed={seedFor('tails')} />);
    const easy = screen.getByRole('radio', { name: /Easy/ });
    const hard = screen.getByRole('radio', { name: /Hard/ });
    expect(hard).toBeChecked();
    fireEvent.click(easy);
    expect(easy).toBeChecked();
    expect(screen.queryByText('Easy', { selector: '.badge' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Randomize fleet' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue to coin flip' }));
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByText('Easy', { selector: '.badge' })).toBeInTheDocument();
  });

  it('switching difficulty does not disturb the ship being placed', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^Destroyer/ }));
    fireEvent.click(screen.getByRole('radio', { name: /Easy/ }));
    expect(screen.getByRole('button', { name: /^Destroyer/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(within(grid('Your fleet')).getByRole('button', { name: 'A1, water' }));
    expect(shipCells(grid('Your fleet'))).toBe(2);
  });

  it('the chosen difficulty survives Play again / New game', () => {
    render(<App seed={seedFor('tails')} />);
    fireEvent.click(screen.getByRole('radio', { name: /Easy/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Randomize fleet' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue to coin flip' }));
    fireEvent.click(screen.getByRole('button', { name: 'New game' }));
    expect(screen.getByRole('radio', { name: /Easy/ })).toBeChecked();
  });

  it('an Easy opponent does not hunt on a single parity', () => {
    render(<App seed={seedFor('tails')} />);
    fireEvent.click(screen.getByRole('radio', { name: /Easy/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Randomize fleet' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue to coin flip' }));
    fireEvent.click(screen.getByRole('button', { name: 'Flip coin' }));
    settleCoin();
    // Alternate: AI fires, then we fire a cell we have not fired at yet.
    const parities = new Set<number>();
    for (let i = 0; i < 12; i++) {
      act(() => {
        vi.advanceTimersByTime(AI_DELAY_MS + 10);
      });
      const own = grid('Your fleet');
      own.querySelectorAll('.cell.miss, .cell.hit, .cell.sunk').forEach((cell) => {
        const label = cell.getAttribute('aria-label') ?? '';
        const m = /^([A-J])(\d+)/.exec(label);
        if (m) parities.add((m[1]!.charCodeAt(0) + Number(m[2])) % 2);
      });
      if (screen.queryByRole('dialog')) break;
      const target = within(grid('Enemy waters'))
        .getAllByRole('button')
        .find((b) => !b.hasAttribute('disabled'));
      if (target) fireEvent.click(target);
    }
    expect(parities.size).toBe(2);
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
    // Landed: the face is held on screen with the result before play begins.
    expect(screen.getByRole('button', { name: 'Flip coin' })).toBeDisabled();
    expect(screen.getByRole('status').textContent).toMatch(/^(Heads|Tails)/);
    expect(screen.queryByRole('grid', { name: 'Enemy waters' })).toBeNull();
    act(() => {
      vi.advanceTimersByTime(COIN_REVEAL_MS + 10);
    });
    expect(screen.queryByRole('button', { name: 'Flip coin' })).toBeNull();
    expect(screen.getByRole('status').textContent).toMatch(/^(Heads|Tails)/);
    expect(screen.getByRole('grid', { name: 'Enemy waters' })).toBeInTheDocument();
  });

  it('the AI does not fire while the landed coin is still on screen', () => {
    render(<App seed={seedFor('tails')} />);
    fireEvent.click(screen.getByRole('button', { name: 'Randomize fleet' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue to coin flip' }));
    fireEvent.click(screen.getByRole('button', { name: 'Flip coin' }));
    act(() => {
      vi.advanceTimersByTime(COIN_FLIP_MS + 10);
    });
    act(() => {
      vi.advanceTimersByTime(COIN_REVEAL_MS - 20);
    });
    expect(screen.queryByRole('grid', { name: 'Your fleet' })).toBeNull();
    act(() => {
      vi.advanceTimersByTime(20);
    });
    // Play begins only now; the AI's clock starts here, not during the hold.
    expect(marks(grid('Your fleet'))).toBe(0);
    act(() => {
      vi.advanceTimersByTime(AI_DELAY_MS + 10);
    });
    expect(marks(grid('Your fleet'))).toBe(1);
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

describe('match history', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  const finishGame = () => {
    for (let i = 0; i < 100 && !screen.queryByRole('dialog'); i++) {
      act(() => {
        vi.advanceTimersByTime(AI_DELAY_MS + 10);
      });
      if (screen.queryByRole('dialog')) break;
      const target = within(grid('Enemy waters'))
        .getAllByRole('button')
        .find((b) => !b.hasAttribute('disabled'));
      if (target) fireEvent.click(target);
    }
    return screen.getByRole('dialog');
  };
  const rows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);

  it('is hidden until a game finishes, then lists it once and persists across reloads', () => {
    const view = render(<App seed={seedFor('tails')} />);
    expect(screen.queryByText("Ship's log")).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Randomize fleet' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue to coin flip' }));
    fireEvent.click(screen.getByRole('button', { name: 'Flip coin' }));
    settleCoin();
    const dialog = finishGame();
    const won = /You win/.test(dialog.textContent ?? '');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Play again' }));
    expect(screen.getByText("Ship's log")).toBeInTheDocument();
    expect(rows()).toHaveLength(1);
    const cells = within(rows()[0]!)
      .getAllByRole('cell')
      .map((c) => c.textContent);
    expect(cells[1]).toBe('Hard');
    expect(cells[2]).toBe(won ? 'Won' : 'Lost');
    expect(cells[won ? 4 : 6]).toBe('17 / 17');
    expect(screen.getByText(won ? '1–0 vs. the enemy' : '0–1 vs. the enemy')).toBeInTheDocument();

    view.unmount();
    render(<App seed={seedFor('heads')} />);
    expect(rows()).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Clear history' }));
    expect(screen.queryByText("Ship's log")).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it('ignores corrupt storage and a New game mid-match records nothing', () => {
    localStorage.setItem('battleship-ai.matches.v1', '{oops');
    startWith('tails');
    fireEvent.click(screen.getByRole('button', { name: 'New game' }));
    expect(screen.queryByText("Ship's log")).toBeNull();
  });
});

describe('leaderboard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  /** Heads (human first), then shoot every enemy ship cell: a 17-shot win the AI cannot beat. */
  const winPerfectly = (seed = seedFor('heads')) => {
    render(<App seed={seed} />);
    fireEvent.click(screen.getByRole('button', { name: 'Randomize fleet' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue to coin flip' }));
    fireEvent.click(screen.getByRole('button', { name: 'Flip coin' }));
    settleCoin();
    const cells = randomFleet(makeRng(seed)).flatMap((s) => engineShipCells(s));
    for (const c of cells) {
      if (screen.queryByRole('dialog')) break;
      fireEvent.click(
        within(grid('Enemy waters')).getByRole('button', { name: `${cellLabel(c)}, water` }),
      );
      act(() => {
        vi.advanceTimersByTime(AI_DELAY_MS + 10);
      });
    }
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('You win!');
    return dialog;
  };
  const board = () => screen.getByRole('table', { name: 'Hall of Captains' });
  const boardRows = () => within(board()).getAllByRole('row').slice(1);

  it('prompts for a name on a qualifying win, ranks it, persists it, and survives Clear history', () => {
    const view = winPerfectly();
    expect(screen.getByText('17 shots earns a place in the Hall of Captains!')).toBeInTheDocument();
    const input = screen.getByLabelText("Captain's name");
    expect(input).toHaveFocus();
    const save = screen.getByRole('button', { name: 'Enter the Hall' });
    expect(save).toBeDisabled();
    fireEvent.change(input, { target: { value: '  Grace  Hopper ' } });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    expect(screen.queryByLabelText("Captain's name")).toBeNull();
    expect(screen.getByText("Saved — you're #1 in the Hall of Captains.")).toBeInTheDocument();

    fireEvent.click(within(view).getByRole('button', { name: 'Play again' }));
    expect(boardRows()).toHaveLength(1);
    const cells = within(boardRows()[0]!)
      .getAllByRole('cell')
      .map((c) => c.textContent);
    expect(cells.slice(0, 4)).toEqual(['1', 'Grace Hopper', '17', 'Hard']);

    fireEvent.click(screen.getByRole('button', { name: 'Clear history' }));
    expect(screen.queryByText("Ship's log")).toBeNull();
    expect(boardRows()).toHaveLength(1);
    expect(localStorage.getItem('battleship-ai.leaderboard.v1')).toContain('Grace Hopper');
  });

  it('prefills the last name, dedupes per game, and Clear leaderboard empties it', () => {
    localStorage.setItem(
      'battleship-ai.leaderboard.v1',
      JSON.stringify([
        {
          id: 'p',
          name: 'Previous',
          shots: 40,
          difficulty: 'easy',
          playedAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
    );
    const view = winPerfectly();
    const input = screen.getByLabelText<HTMLInputElement>("Captain's name");
    expect(input.value).toBe('Previous');
    fireEvent.submit(input.closest('form')!);
    fireEvent.submit(input.closest('form')!); // no second entry
    expect(screen.getByText("Saved — you're #1 in the Hall of Captains.")).toBeInTheDocument();
    fireEvent.click(within(view).getByRole('button', { name: 'Play again' }));
    expect(boardRows().map((r) => within(r).getAllByRole('cell')[1]!.textContent)).toEqual([
      'Previous',
      'Previous',
    ]);
    expect(boardRows().map((r) => within(r).getAllByRole('cell')[2]!.textContent)).toEqual([
      '17',
      '40',
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Clear leaderboard' }));
    expect(screen.queryByRole('table', { name: 'Hall of Captains' })).toBeNull();
    expect(localStorage.getItem('battleship-ai.leaderboard.v1')).toBeNull();
  });

  it('does not prompt when the win would not make a full board', () => {
    localStorage.setItem(
      'battleship-ai.leaderboard.v1',
      JSON.stringify(
        Array.from({ length: 10 }, (_, i) => ({
          id: `e${i}`,
          name: `P${i}`,
          shots: 17,
          difficulty: 'hard',
          playedAt: '2026-01-01T00:00:00.000Z',
        })),
      ),
    );
    winPerfectly();
    expect(screen.queryByLabelText("Captain's name")).toBeNull();
    expect(screen.getByRole('button', { name: 'Play again' })).toHaveFocus();
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
    expect(screen.getByRole('alert').textContent).toContain('Console fault');
    expect(screen.getByText('kaboom')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reboot the console' })).toBeInTheDocument();
  });
});
