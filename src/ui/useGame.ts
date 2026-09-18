import { useEffect, useReducer, useRef } from 'react';
import { chooseShot } from '../ai/huntTarget';
import { randomFleet } from '../engine/fleet';
import {
  confirmFleet,
  fire,
  flipCoin,
  placeHumanShip,
  removeHumanShip,
  setHumanFleet,
  startGame,
  toAIView,
} from '../engine/game';
import { makeRng } from '../engine/rng';
import {
  SHIP_KINDS,
  SHIP_NAMES,
  type Coord,
  type GameState,
  type Orientation,
  type Player,
  type RNG,
  type Ship,
  type ShipKind,
  type ShotResult,
} from '../engine/types';

export const AI_DELAY_MS = 250;
/** How long the coin "spins" before the result is shown and play begins. */
export const COIN_FLIP_MS = 1000;

export type UIState = {
  game: GameState;
  lastHuman: string;
  lastAi: string;
  /** Placement: which ship the next board click places (undefined once all are down). */
  selected: ShipKind | undefined;
  orientation: Orientation;
  /** True between pressing "Flip coin" and the result being revealed. */
  flipping: boolean;
};

type Action =
  | { type: 'select'; kind: ShipKind }
  | { type: 'rotate' }
  | { type: 'place'; at: Coord }
  | { type: 'pickup'; kind: ShipKind }
  | { type: 'setFleet'; ships: readonly Ship[] }
  | { type: 'confirm' }
  | { type: 'flip'; roll: number }
  | { type: 'flipDone' }
  | { type: 'fire'; shooter: Player; at: Coord }
  | { type: 'reset'; seed: number };

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

const nextUnplaced = (game: GameState): ShipKind | undefined =>
  SHIP_KINDS.find((k) => !game.human.ships.some((s) => s.kind === k));

const withGame = (ui: UIState, game: GameState): UIState =>
  game === ui.game ? ui : { ...ui, game, selected: nextUnplaced(game) };

export const reducer = (ui: UIState, action: Action): UIState => {
  switch (action.type) {
    case 'reset':
      return init(action.seed);
    case 'select':
      return ui.game.phase === 'placement' ? { ...ui, selected: action.kind } : ui;
    case 'rotate':
      return { ...ui, orientation: ui.orientation === 'h' ? 'v' : 'h' };
    case 'place': {
      if (ui.selected === undefined) return ui;
      const ship: Ship = { kind: ui.selected, bow: action.at, orientation: ui.orientation };
      return withGame(ui, placeHumanShip(ui.game, ship));
    }
    case 'pickup': {
      const game = removeHumanShip(ui.game, action.kind);
      if (game === ui.game) return ui;
      const picked = game.human.ships.length < ui.game.human.ships.length;
      return { ...ui, game, selected: picked ? action.kind : nextUnplaced(game) };
    }
    case 'setFleet':
      return withGame(ui, setHumanFleet(ui.game, action.ships));
    case 'confirm':
      return withGame(ui, confirmFleet(ui.game));
    case 'flip': {
      const game = flipCoin(ui.game, () => action.roll);
      return game === ui.game ? ui : { ...ui, game, flipping: true };
    }
    case 'flipDone': {
      if (!ui.flipping) return ui;
      const heads = ui.game.coin === 'heads';
      return {
        ...ui,
        flipping: false,
        lastHuman: heads ? 'Heads — you fire first.' : 'Tails — enemy fires first.',
        lastAi: '',
      };
    }
    case 'fire': {
      const { state, result } = fire(ui.game, action.shooter, action.at);
      const text = describe(action.shooter, result);
      if (text === undefined) return ui;
      return action.shooter === 'human'
        ? { ...ui, game: state, lastHuman: text, lastAi: '' }
        : { ...ui, game: state, lastAi: text };
    }
  }
};

export const init = (seed: number): UIState => {
  const game = startGame(seed);
  return {
    game,
    lastHuman: '',
    lastAi: '',
    selected: nextUnplaced(game),
    orientation: 'h',
    flipping: false,
  };
};

const newSeed = (): number => Math.floor(Math.random() * 2 ** 32);

/**
 * UI-side random stream (Randomize, coin). Must not be `makeRng(seed)`: the engine
 * draws the AI fleet from that stream, so the first Randomize would clone the enemy layout.
 */
export const uiRng = (seed: number): RNG => makeRng((seed ^ 0x9e3779b9) >>> 0);

export const useGame = (initialSeed?: number) => {
  const [ui, dispatch] = useReducer(reducer, undefined, () => init(initialSeed ?? newSeed()));
  const rng = useRef<RNG | null>(null);
  if (rng.current === null) rng.current = uiRng(ui.game.seed);
  const draw = (): RNG => rng.current ?? (rng.current = uiRng(ui.game.seed));

  const { game, flipping } = ui;

  useEffect(() => {
    if (!flipping) return;
    const timer = setTimeout(() => dispatch({ type: 'flipDone' }), COIN_FLIP_MS);
    return () => clearTimeout(timer);
  }, [flipping]);

  useEffect(() => {
    if (flipping || game.phase !== 'playing' || game.turn !== 'ai') return;
    const timer = setTimeout(() => {
      const at = chooseShot(toAIView(game), rng.current ?? uiRng(game.seed));
      dispatch({ type: 'fire', shooter: 'ai', at });
    }, AI_DELAY_MS);
    return () => clearTimeout(timer);
  }, [game, flipping]);

  return {
    game,
    lastHuman: ui.lastHuman,
    lastAi: ui.lastAi,
    selected: ui.selected,
    orientation: ui.orientation,
    flipping,
    select: (kind: ShipKind) => dispatch({ type: 'select', kind }),
    rotate: () => dispatch({ type: 'rotate' }),
    placeAt: (at: Coord) => dispatch({ type: 'place', at }),
    pickup: (kind: ShipKind) => dispatch({ type: 'pickup', kind }),
    randomize: () => dispatch({ type: 'setFleet', ships: randomFleet(draw()) }),
    confirm: () => dispatch({ type: 'confirm' }),
    flip: () => dispatch({ type: 'flip', roll: draw()() }),
    fireAt: (at: Coord) => dispatch({ type: 'fire', shooter: 'human', at }),
    reset: () => {
      const seed = newSeed();
      rng.current = uiRng(seed);
      dispatch({ type: 'reset', seed });
    },
  };
};
