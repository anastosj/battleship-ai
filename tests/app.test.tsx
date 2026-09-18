import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { AI_DELAY_MS } from '../src/ui/useGame';

describe('App', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('lets the human fire, then the AI replies exactly once', () => {
    render(<App />);
    const enemy = screen.getByRole('grid', { name: 'Enemy waters' });
    const own = screen.getByRole('grid', { name: 'Your fleet' });
    const before = own.querySelectorAll('.cell.miss, .cell.hit').length;

    fireEvent.click(screen.getByRole('button', { name: 'J10, water' }));
    expect(screen.getByRole('status').textContent).toContain('Enemy is thinking');
    expect(enemy.querySelectorAll('.cell.miss')).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(AI_DELAY_MS + 10);
    });
    const after = own.querySelectorAll('.cell.miss, .cell.hit').length;
    expect(after - before).toBe(1);
    expect(screen.getByRole('status').textContent).toContain('Your turn');
  });

  it("keeps the human's shot result visible after the AI replies", () => {
    render(<App />);
    // AI cruiser occupies B1–D1 in the fixed fleet
    fireEvent.click(screen.getByRole('button', { name: 'B1, water' }));
    expect(screen.getByRole('status').textContent).toContain('Hit!');
    act(() => {
      vi.advanceTimersByTime(AI_DELAY_MS + 10);
    });
    const text = screen.getByRole('status').textContent ?? '';
    expect(text).toContain('Hit!');
    expect(text).toMatch(/Enemy (missed|hit|sank)/);
  });

  it('disables enemy cells while the AI is thinking', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'J10, water' }));
    expect(screen.getByRole('button', { name: 'A1, water' })).toBeDisabled();
  });
});
