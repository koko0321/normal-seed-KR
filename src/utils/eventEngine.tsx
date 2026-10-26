import { advanceSeed } from "./seed";
import { EventGacha, MEDAMA, MULTI_ROLL_NUM } from "./eventData";

// seeds.get(0) is the starting seed, seeds.get(k) the k-th seed after it.
// A roll that starts at index i uses seeds i, i + 1, ...
export class SeedList {
  private seeds: number[];

  constructor(initialSeed: number) {
    this.seeds = [initialSeed >>> 0];
  }

  get(index: number) {
    while (this.seeds.length <= index) {
      this.seeds.push(advanceSeed(this.seeds[this.seeds.length - 1]));
    }
    return this.seeds[index];
  }
}

export type GachaState = {
  lastRoll: string; // "" if unknown
  guaranteedLeft: number | null; // rolls until the guaranteed character, 1 = next
  medamaStock: number;
  medamaLeft: number | null; // rolls until the guaranteed medama, 1 = next
};

export type RollResult = {
  unit: string;
  pool: number; // -1 for medama
  isMedama: boolean;
  isGuaranteedMedama: boolean;
  isGuaranteed: boolean; // guaranteed character
  rerolled: boolean; // replaced a dupe of the previous roll
  cellIndex?: number; // starting seed index for this roll
};

export type PullOutcome = {
  results: RollResult[];
  consumed: number; // number of seeds used
  state: GachaState; // state after the pull
};

export const medamaActive = (gacha: EventGacha, state: GachaState) =>
  !!gacha.medama && state.medamaStock > 0;

const poolForRarity = (gacha: EventGacha, raritySeed: number) => {
  const score = raritySeed % 10000;
  let sum = 0;
  for (let i = 0; i < gacha.pools.length; i++) {
    sum += gacha.pools[i].rate;
    if (score < sum) {
      return i;
    }
  }
  return gacha.pools.length - 1;
};

// The pool of a guaranteed roll is picked among the guaranteed pools by their
// relative rates
const guaranteedPoolFor = (gacha: EventGacha, seed: number) => {
  const pools = gacha.guaranteed!.pools;
  const total = pools.reduce((sum, i) => sum + gacha.pools[i].rate, 0);
  const score = seed % total;
  let sum = 0;
  for (const i of pools) {
    sum += gacha.pools[i].rate;
    if (score < sum) {
      return i;
    }
  }
  return pools[pools.length - 1];
};

// A regular roll: seed i picks the pool, seed i + 1 the unit. If the pool
// rerolls dupes and the unit is the same as the last roll, the rolled unit is
// removed and the next seed picks again, until a different unit comes out.
const regularRoll = (
  gacha: EventGacha,
  seeds: SeedList,
  i: number,
  lastRoll: string
): { result: RollResult; consumed: number } => {
  const pool = poolForRarity(gacha, seeds.get(i));
  const { units, reroll } = gacha.pools[pool];
  const unit = units[seeds.get(i + 1) % units.length];
  const result = {
    unit,
    pool,
    isMedama: false,
    isGuaranteedMedama: false,
    isGuaranteed: false,
    rerolled: false,
  };
  if (!reroll || unit !== lastRoll || units.length <= 1) {
    return { result, consumed: 2 };
  }
  let remaining = units.slice();
  let k = i + 1;
  let rerolledUnit = unit;
  while (rerolledUnit === unit && remaining.length > 1) {
    remaining.splice(remaining.indexOf(unit), 1);
    k++;
    rerolledUnit = remaining[seeds.get(k) % remaining.length];
  }
  if (rerolledUnit === unit) {
    return { result, consumed: 2 };
  }
  return {
    result: { ...result, unit: rerolledUnit, rerolled: true },
    consumed: k + 1 - i,
  };
};

const medamaResult = (isGuaranteedMedama: boolean): RollResult => ({
  unit: MEDAMA,
  pool: -1,
  isMedama: true,
  isGuaranteedMedama,
  isGuaranteed: false,
  rerolled: false,
});

const countDown = (left: number | null) => (left === null ? null : left - 1);

// One single pull starting at seed index i
export const singlePull = (
  gacha: EventGacha,
  seeds: SeedList,
  i: number,
  state: GachaState
): PullOutcome => {
  if (medamaActive(gacha, state)) {
    const { rate, guaranteedSteps } = gacha.medama!;
    const medamaStock = state.medamaStock - 1;
    // A guaranteed medama uses no seeds
    if (state.medamaLeft === 1) {
      return {
        results: [medamaResult(true)],
        consumed: 0,
        state: { ...state, medamaStock, medamaLeft: guaranteedSteps },
      };
    }
    // Otherwise one seed decides a natural medama, which keeps the last roll
    const medamaLeft = countDown(state.medamaLeft);
    if (seeds.get(i) % 10000 < rate) {
      return {
        results: [medamaResult(false)],
        consumed: 1,
        state: { ...state, medamaStock, medamaLeft },
      };
    }
    const { result, consumed } = regularRoll(gacha, seeds, i + 1, state.lastRoll);
    return {
      results: [result],
      consumed: consumed + 1,
      state: { ...state, lastRoll: result.unit, medamaLeft },
    };
  }

  if (gacha.guaranteed && state.guaranteedLeft === 1) {
    const unit = guaranteedUnitAt(gacha, seeds, i);
    return {
      results: [
        {
          unit,
          pool: guaranteedPoolFor(gacha, seeds.get(i)),
          isMedama: false,
          isGuaranteedMedama: false,
          isGuaranteed: true,
          rerolled: false,
        },
      ],
      consumed: 2,
      state: { ...state, lastRoll: unit, guaranteedLeft: gacha.guaranteed.step },
    };
  }

  const { result, consumed } = regularRoll(gacha, seeds, i, state.lastRoll);
  return {
    results: [result],
    consumed,
    state: {
      ...state,
      lastRoll: result.unit,
      guaranteedLeft: countDown(state.guaranteedLeft),
    },
  };
};

// The guaranteed character a single pull at index i would give: seed i picks
// the pool, seed i + 1 the character
export const guaranteedUnitAt = (gacha: EventGacha, seeds: SeedList, i: number) => {
  const { units } = gacha.pools[guaranteedPoolFor(gacha, seeds.get(i))];
  return units[seeds.get(i + 1) % units.length];
};

// A multi pull (10 rolls) starting at seed index i
export const multiPull = (
  gacha: EventGacha,
  seeds: SeedList,
  i: number,
  state: GachaState,
  numRolls = MULTI_ROLL_NUM
): PullOutcome => {
  const results: RollResult[] = [];
  let k = i;
  let lastRoll = state.lastRoll;

  if (medamaActive(gacha, state)) {
    const { rate, guaranteedSteps } = gacha.medama!;
    // Positions of guaranteed medamas within this pull
    const guaranteedPositions: number[] = [];
    if (state.medamaLeft !== null) {
      for (let p = state.medamaLeft - 1; p < numRolls; p += guaranteedSteps) {
        guaranteedPositions.push(p);
      }
    }
    // First, one seed per other position decides a natural medama
    const naturalPositions: number[] = [];
    const medamaCheckSeeds = new Map<number, number>();
    for (let p = 0; p < numRolls; p++) {
      if (!guaranteedPositions.includes(p)) {
        medamaCheckSeeds.set(p, k);
        if (seeds.get(k) % 10000 < rate) {
          naturalPositions.push(p);
        }
        k++;
      }
    }
    // Natural medamas take the stock first (earliest first), then guaranteed
    const reserved = naturalPositions.slice(0, state.medamaStock);
    const guaranteedReserved = guaranteedPositions.slice(
      0,
      Math.max(0, state.medamaStock - reserved.length)
    );
    // Then the rolls are given in order; medamas use no seeds and keep the
    // last roll
    for (let p = 0; p < numRolls; p++) {
      if (reserved.includes(p) || guaranteedReserved.includes(p)) {
        results.push({
          ...medamaResult(guaranteedReserved.includes(p)),
          cellIndex: reserved.includes(p) ? medamaCheckSeeds.get(p) : undefined,
        });
        continue;
      }
      const { result, consumed } = regularRoll(gacha, seeds, k, lastRoll);
      results.push({ ...result, cellIndex: k });
      k += consumed;
      lastRoll = result.unit;
    }
    const lastGuaranteed = guaranteedPositions[guaranteedPositions.length - 1];
    const medamaLeft =
      lastGuaranteed !== undefined
        ? guaranteedSteps - (numRolls - 1 - lastGuaranteed)
        : state.medamaLeft === null
        ? null
        : Math.max(1, state.medamaLeft - numRolls);
    return {
      results,
      consumed: k - i,
      state: {
        ...state,
        lastRoll,
        medamaStock:
          state.medamaStock - reserved.length - guaranteedReserved.length,
        medamaLeft,
      },
    };
  }

  // A multi pull containing a guaranteed roll first uses one seed per
  // guaranteed roll in it to pick that roll's pool
  const guaranteedPools: number[] = [];
  if (gacha.guaranteed && state.guaranteedLeft !== null) {
    let left = state.guaranteedLeft;
    for (let p = 0; p < numRolls; p++) {
      if (left === 1) {
        guaranteedPools.push(guaranteedPoolFor(gacha, seeds.get(k)));
        k++;
        left = gacha.guaranteed.step;
      } else {
        left--;
      }
    }
  }
  let guaranteedLeft = state.guaranteedLeft;
  for (let p = 0; p < numRolls; p++) {
    if (gacha.guaranteed && guaranteedLeft === 1) {
      const pool = guaranteedPools.shift()!;
      const { units } = gacha.pools[pool];
      const unit = units[seeds.get(k) % units.length];
      results.push({
        unit,
        pool,
        isMedama: false,
        isGuaranteedMedama: false,
        isGuaranteed: true,
        rerolled: false,
        cellIndex: Math.max(1, k - 1),
      });
      k++;
      lastRoll = unit;
      guaranteedLeft = gacha.guaranteed.step;
      continue;
    }
    const { result, consumed } = regularRoll(gacha, seeds, k, lastRoll);
    results.push({ ...result, cellIndex: k });
    k += consumed;
    lastRoll = result.unit;
    guaranteedLeft = countDown(guaranteedLeft);
  }
  return {
    results,
    consumed: k - i,
    state: { ...state, lastRoll, guaranteedLeft },
  };
};
