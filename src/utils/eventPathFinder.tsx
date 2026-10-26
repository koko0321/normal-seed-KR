import { EventGacha, MULTI_ROLL_NUM } from "./eventData";
import {
  GachaState,
  PullOutcome,
  SeedList,
  medamaActive,
  multiPull,
  singlePull,
} from "./eventEngine";
import { SharedBanner } from "./sharedBanners";

export type PathTarget = { unit: string; count: number };

type Kind = "single" | "multi";

// A pull: on the event gacha (banner null), or a single pull on one of the
// normal ticket banners that share its seed
type Move = { banner: SharedBanner | null; kind: Kind };

export type PathStep = Move & {
  index: number; // seed index the pull starts at
  outcome: PullOutcome;
  dupeAction?: "create" | "avoid";
};

export type PathResult =
  | {
      found: true;
      complete: boolean; // every target reached (budget mode may stop short)
      tickets: number; // event tickets
      normalTickets: number; // tickets on the normal banners
      steps: PathStep[];
      endIndex: number;
      collected: number[]; // per target, in the order given
      // Budget mode only: the search hit its state limit, so budgets were
      // only fully checked up to this many tickets
      checkedUpTo?: number;
    }
  | { found: false; reason: "out-of-range" | "too-many-states" };

export type PathOptions = {
  // Rolls per event multi-pull (one ticket each)
  multiCount?: number;
  // Normal ticket banners that may be pulled (single pulls) along the way,
  // and how many tickets may be used on them in total. They cost no event
  // tickets.
  sharedBanners?: SharedBanner[];
  maxNormalTickets?: number;
  // With a budget, find the most targets within that many event tickets
  // instead of requiring all of them
  budget?: number | null;
  maxStates?: number;
  // Called now and then with how far the search has got
  onProgress?: (progress: { tickets: number; states: number }) => void;
};

// A place is a seed index plus the gacha state there; everything that decides
// what the next pulls give. Places are numbered as they are first reached.
type Place = { index: number; state: GachaState };

// What a pull does from a place: where it leads and how many of each target it
// gives. Depends only on the place, so it is computed once per place.
type Effect = { next: number; gains: number[] };

// Kept small: a search can create millions of these. "collected" packs how
// many of each target were rolled into one number (see Counts below), and
// pull results are replayed only once the path is known.
type Node = {
  place: number;
  collected: number;
  tickets: number; // event tickets
  normal: number; // normal banner tickets
  prev: Node | null;
  move: number; // index into moves of the pull that led here, -1 at start
};

// Packs per-target counts (each 0..goal) into one number, mixed radix
class Counts {
  private readonly goal: number[];
  private readonly weight: number[];
  readonly full: number;

  constructor(goal: number[]) {
    this.goal = goal;
    let weight = 1;
    this.weight = goal.map((g) => {
      const w = weight;
      weight *= g + 1;
      return w;
    });
    this.full = goal.reduce((sum, g, i) => sum + g * this.weight[i], 0);
  }

  get(code: number, i: number) {
    return Math.floor(code / this.weight[i]) % (this.goal[i] + 1);
  }

  add(code: number, gains: number[]) {
    for (let i = 0; i < gains.length; i++) {
      if (gains[i] > 0) {
        const room = this.goal[i] - this.get(code, i);
        code += Math.min(room, gains[i]) * this.weight[i];
      }
    }
    return code;
  }

  // a has at least as many of every target as b
  covers(a: number, b: number) {
    if (a === b) {
      return true;
    }
    for (let i = 0; i < this.goal.length; i++) {
      if (this.get(a, i) < this.get(b, i)) {
        return false;
      }
    }
    return true;
  }

  // How many targets are still missing
  missing(code: number) {
    let missing = 0;
    for (let i = 0; i < this.goal.length; i++) {
      missing += this.goal[i] - this.get(code, i);
    }
    return missing;
  }

  unpack(code: number) {
    return this.goal.map((_, i) => this.get(code, i));
  }
}

// Finds the way with the fewest event tickets (one per roll) to roll every
// target the given number of times, starting at seed index `startIndex`, using
// at most `maxNormalTickets` single pulls on the normal banners; among equally
// cheap ways, the one with the fewest normal tickets.
// Pulls follow utils/eventEngine.tsx, so dupe rerolls, guaranteed characters
// (which count toward the targets) and medamas behave exactly as in the
// table. Pulls must start before `maxIndex`.
export const findShortestPath = (
  gacha: EventGacha,
  seeds: SeedList,
  startIndex: number,
  startState: GachaState,
  targets: PathTarget[],
  maxIndex: number,
  {
    multiCount = MULTI_ROLL_NUM,
    sharedBanners = [],
    maxNormalTickets = Infinity,
    budget = null,
    maxStates = 300_000,
    onProgress,
  }: PathOptions = {}
): PathResult => {
  const targetIndex = new Map(targets.map(({ unit }, i) => [unit, i]));
  const counts = new Counts(targets.map(({ count }) => count));

  const moves: Move[] = [
    { banner: null, kind: "single" },
    { banner: null, kind: "multi" },
    ...sharedBanners.map((banner) => ({ banner, kind: "single" as const })),
  ];
  // Event tickets a pull costs; normal banner pulls cost a normal ticket
  const ticketsFor = (move: Move) =>
    move.banner ? 0 : move.kind === "multi" ? multiCount : 1;

  const pull = (move: Move, index: number, state: GachaState): PullOutcome => {
    if (!move.banner) {
      return move.kind === "single"
        ? singlePull(gacha, seeds, index, state)
        : multiPull(gacha, seeds, index, state, multiCount);
    }
    // A normal banner pull only changes the last roll, not the event's
    // guaranteed or medama counters
    const outcome = singlePull(move.banner.gacha, seeds, index, {
      lastRoll: state.lastRoll,
      guaranteedLeft: null,
      medamaStock: 0,
      medamaLeft: null,
    });
    return {
      ...outcome,
      state: { ...state, lastRoll: outcome.state.lastRoll },
    };
  };

  // Only units that can be rerolled (on any of the gachas) make the last roll
  // matter, so any other last roll is treated as none to merge equal places.
  // Likewise the medama counter stops mattering once the stock is gone.
  const rerollUnits = new Set(
    [gacha, ...sharedBanners.map((b) => b.gacha)].flatMap((g) =>
      g.pools.filter((p) => p.reroll).flatMap((p) => p.units)
    )
  );
  const normalize = (state: GachaState): GachaState => {
    let normalized = state;
    if (!rerollUnits.has(state.lastRoll) && state.lastRoll !== "") {
      normalized = { ...normalized, lastRoll: "" };
    }
    if (state.medamaStock === 0 && state.medamaLeft !== null) {
      normalized = { ...normalized, medamaLeft: null };
    }
    return normalized;
  };

  const places: Place[] = [];
  const placeIds = new Map<string, number>();
  const placeOf = (index: number, state: GachaState) => {
    const key = `${index}|${state.lastRoll}|${state.guaranteedLeft}|${state.medamaStock}|${state.medamaLeft}`;
    let id = placeIds.get(key);
    if (id === undefined) {
      id = places.length;
      places.push({ index, state });
      placeIds.set(key, id);
    }
    return id;
  };

  const effects: (Effect | undefined)[][] = [];
  const effectOf = (moveIndex: number, place: number): Effect => {
    const cached = (effects[place] = effects[place] || [])[moveIndex];
    if (cached) {
      return cached;
    }
    const { index, state } = places[place];
    const outcome = pull(moves[moveIndex], index, state);
    const gains = targets.map(() => 0);
    for (const result of outcome.results) {
      const i = targetIndex.get(result.unit);
      if (i !== undefined) {
        gains[i]++;
      }
    }
    const effect = {
      next: placeOf(index + outcome.consumed, normalize(outcome.state)),
      gains,
    };
    effects[place][moveIndex] = effect;
    return effect;
  };

  // A node is useless if its place was already reached for no more event and
  // normal tickets with at least as many of every target. Stored as flat
  // [collected, tickets, normal, ...] lists per place.
  const reached: number[][] = [];
  const dominated = (
    place: number,
    collected: number,
    tickets: number,
    normal: number
  ) => {
    const list = reached[place];
    if (!list) {
      return false;
    }
    for (let i = 0; i < list.length; i += 3) {
      if (
        list[i + 1] <= tickets &&
        list[i + 2] <= normal &&
        counts.covers(list[i], collected)
      ) {
        return true;
      }
    }
    return false;
  };

  const toResult = (end: Node): Extract<PathResult, { found: true }> => {
    const nodes: Node[] = [];
    for (let n: Node | null = end; n && n.prev; n = n.prev) {
      nodes.unshift(n);
    }
    let state = startState;
    const steps = nodes.map((n) => {
      const index = places[n.prev!.place].index;
      const move = moves[n.move];
      const outcome = pull(move, index, state);
      let dupeAction: "create" | "avoid" | undefined = undefined;
      if (move.banner) {
        const directOutcome = singlePull(gacha, seeds, index, state);
        const directRerolls = directOutcome.results.some((r) => r.rerolled);
        const ltRerolls = outcome.results.some((r) => r.rerolled);
        const nextEventOutcome = singlePull(
          gacha,
          seeds,
          index + outcome.consumed,
          outcome.state
        );
        const nextEventRerolls = nextEventOutcome.results.some(
          (r) => r.rerolled
        );
        if (directRerolls && !nextEventRerolls) {
          dupeAction = "avoid";
        } else if (ltRerolls || nextEventRerolls) {
          dupeAction = "create";
        }
      }
      state = outcome.state;
      return { ...move, index, outcome, dupeAction };
    });
    return {
      found: true,
      complete: end.collected === counts.full,
      tickets: end.tickets,
      normalTickets: end.normal,
      steps,
      endIndex: places[end.place].index,
      collected: counts.unpack(end.collected),
    };
  };

  // Nodes are taken in order of priority: event tickets spent, plus (when
  // every target is required) how many targets are still missing. Each event
  // ticket gives at most one target and normal banner pulls never give one
  // (the targets are event characters), so that never overestimates the event
  // tickets still needed, and the first finished node taken is still the
  // cheapest (A* search). Within a priority, nodes with fewer normal tickets
  // go first, so among equally cheap ways the first found uses the fewest.
  // Priorities are small integers, so lists per priority and normal tickets
  // work as the queue; normal tickets never go down along a path, so a list
  // only gets nodes added while it, or an earlier one, is being taken.
  const useEstimate = budget === null;
  const priority = (node: Node) =>
    node.tickets + (useEstimate ? counts.missing(node.collected) : 0);

  const start: Node = {
    place: placeOf(startIndex, normalize(startState)),
    collected: 0,
    tickets: 0,
    normal: 0,
    prev: null,
    move: -1,
  };
  const buckets: Node[][][] = [];
  const enqueue = (node: Node) => {
    const p = priority(node);
    const byNormal = (buckets[p] = buckets[p] || []);
    (byNormal[node.normal] = byNormal[node.normal] || []).push(node);
  };
  enqueue(start);
  let best = start; // budget mode: most targets so far
  let states = 0;

  // Fewer missing, then fewer event tickets, then fewer normal tickets
  const better = (a: Node, b: Node) =>
    counts.missing(a.collected) - counts.missing(b.collected) ||
    a.tickets - b.tickets ||
    a.normal - b.normal;

  for (let p = 0; p < buckets.length; p++) {
    const byNormal = buckets[p];
    if (!byNormal) {
      continue;
    }
    for (let n = 0; n < byNormal.length; n++) {
      const bucket = byNormal[n];
      if (!bucket) {
        continue;
      }
      for (let b = 0; b < bucket.length; b++) {
        const node = bucket[b];
        if (dominated(node.place, node.collected, node.tickets, node.normal)) {
          continue;
        }
        (reached[node.place] = reached[node.place] || []).push(
          node.collected,
          node.tickets,
          node.normal
        );
        if (node.collected === counts.full) {
          return toResult(node);
        }
        if (better(node, best) < 0) {
          best = node;
        }
        if (++states > maxStates) {
          if (budget !== null) {
            // Everything cheaper than this node was fully checked
            return { ...toResult(best), checkedUpTo: node.tickets - 1 };
          }
          return { found: false, reason: "too-many-states" };
        }
        if (onProgress && states % 20_000 === 0) {
          onProgress({ tickets: node.tickets, states });
        }
        const { index, state } = places[node.place];
        if (index >= maxIndex) {
          continue;
        }

        for (let m = 0; m < moves.length; m++) {
          const move = moves[m];
          // Without a guarantee or medamas a multi-pull is the same as singles
          if (
            move.kind === "multi" &&
            !gacha.guaranteed &&
            !medamaActive(gacha, state)
          ) {
            continue;
          }
          if (move.banner) {
            // Lucky Ticket can be used for either:
            // 1. 열이동 유도 (Track switch creation):
            //    LT itself dupes/rerolls, OR setting lastRoll causes the next event pull to reroll when direct pull wouldn't
            // 2. 중복 회피 (Duplicate avoidance):
            //    Direct event pull would have duped/rerolled, but pulling LT changes lastRoll so the next event pull avoids the reroll
            const directOutcome = singlePull(gacha, seeds, index, state);
            const directRerolls = directOutcome.results.some((r) => r.rerolled);

            const ltOutcome = pull(move, index, state);
            const ltRerolls = ltOutcome.results.some((r) => r.rerolled);
            const nextEventOutcome = singlePull(
              gacha,
              seeds,
              index + ltOutcome.consumed,
              ltOutcome.state
            );
            const nextEventRerolls = nextEventOutcome.results.some(
              (r) => r.rerolled
            );

            const createsDupe =
              ltRerolls || (!directRerolls && nextEventRerolls);
            const avoidsDupe = directRerolls && !nextEventRerolls;

            if (!createsDupe && !avoidsDupe) {
              continue;
            }
          }
          const tickets = node.tickets + ticketsFor(move);
          const normal = node.normal + (move.banner ? 1 : 0);
          if (
            (budget !== null && tickets > budget) ||
            normal > maxNormalTickets
          ) {
            continue;
          }
          const effect = effectOf(m, node.place);
          const collected = counts.add(node.collected, effect.gains);
          if (dominated(effect.next, collected, tickets, normal)) {
            continue;
          }
          enqueue({
            place: effect.next,
            collected,
            tickets,
            normal,
            prev: node,
            move: m,
          });
        }
      }
      byNormal[n] = []; // free memory
    }
    buckets[p] = [];
  }
  if (budget !== null) {
    return toResult(best);
  }
  return { found: false, reason: "out-of-range" };
};
