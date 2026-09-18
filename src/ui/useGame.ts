import { useEffect, useReducer, useRef } from 'react';
import { chooseShot } from '../ai/random';
import { fire, newGame, toAIView } from '../engine/game';
import { makeRng } from '../engine/rng';
import {
  SHIP_NAMES,
  type Coord,
  type GameState,
  type Player,
  type RNG,
  type ShotResult,
} from '../engine/types';

export const AI_DELAY_MS = 250;

type UIState = { game: GameState; lastHuman: string; lastAi: string };

type Action = { type: 'fire'; shooter: Player; at: Coord } | { type: 'reset'; seed: number };

const describe = (shooter: Player, result: ShotResult): string | undefined => {
  const you = shooter === 'human';
  switch (result.kind) {
    case 'miss':
      return you ? 'Miss.' : 'Enemy missed.';
    case 'hit':
      return you ? 'Hit!' : 'Enemy hit your ship!';
    case 'sunk':
      return you
        ? `You sank their ${SHIP_NAMES[result.ship]}!`
        : `Enemy sank your ${SHIP_NAMES[result.ship]}!`;
    case 'invalid':
      return undefined;
  }
};

const reducer = (ui: UIState, action: Action): UIState => {
  switch (action.type) {
    case 'reset':
      return init(action.seed);
    case 'fire': {
      const { state, result } = fire(ui.game, action.shooter, action.at);
      const text = describe(action.shooter, result);
      if (text === undefined) return ui;
      return action.shooter === 'human'
        ? { game: state, lastHuman: text, lastAi: '' }
        : { ...ui, game: state, lastAi: text };
    }
  }
};

const init = (seed: number): UIState => ({
  game: newGame(seed),
  lastHuman: 'Click a cell in Enemy waters to fire.',
  lastAi: '',
});

const newSeed = (): number => Math.floor(Math.random() * 2 ** 32);

export const useGame = () => {
  const [ui, dispatch] = useReducer(reducer, undefined, () => init(newSeed()));
  const rng = useRef<RNG | null>(null);
  if (rng.current === null) rng.current = makeRng(ui.game.seed);

  const { game } = ui;
  useEffect(() => {
    if (game.phase !== 'playing' || game.turn !== 'ai') return;
    const timer = setTimeout(() => {
      const at = chooseShot(toAIView(game), rng.current ?? makeRng(game.seed));
      dispatch({ type: 'fire', shooter: 'ai', at });
    }, AI_DELAY_MS);
    return () => clearTimeout(timer);
  }, [game]);

  return {
    game,
    lastHuman: ui.lastHuman,
    lastAi: ui.lastAi,
    fireAt: (at: Coord) => dispatch({ type: 'fire', shooter: 'human', at }),
    reset: () => {
      const seed = newSeed();
      rng.current = makeRng(seed);
      dispatch({ type: 'reset', seed });
    },
  };
};
