// Best pull order over the normal banners (냥코뽑기 etc.) for the items the
// user cares about. All banners share one seed and the last roll, so the
// search walks the shared seed list: a state is (position, last roll, tickets
// used per ticket type) and every pull moves the position forward. Positions
// only grow, so the states are processed in position order like a DP.
import { AllBanners, BannerData } from "./bannerData";
import { EVENT_GACHAS, EventGacha } from "./eventData";
import { GachaState, SeedList, singlePull } from "./eventEngine";

export type ItemGroupKey =
  | "darkCatseye"
  | "cataminC"
  | "cataminB"
  | "radar"
  | "lil"
  | "orbs";

export const EVENT_TO_NORMAL_ITEM: Record<string, string> = {
  "スピードアップ": "Speed Up",
  "ニャンピュータ": "Cat CPU",
  "XP5000": "5K XP",
  "XP1万": "10K XP",
  "XP3万": "30K XP",
  "XP10万": "100K XP",
  "XP100万": "1M XP",
  "ネコボン": "Rich Cat",
  "おかめはちもく": "Cat Jobs",
  "スニャイパー": "Sniper the Cat",
};

export const NORMAL_TO_EVENT_ITEM: Record<string, string> = {
  "Speed Up": "スピードアップ",
  "Cat CPU": "ニャンピュータ",
  "5K XP": "XP5000",
  "10K XP": "XP1万",
  "30K XP": "XP3万",
  "100K XP": "XP10万",
  "1M XP": "XP100万",
  "Rich Cat": "ネコボン",
  "Cat Jobs": "おかめはちもく",
  "Sniper the Cat": "スニャイパー",
};

export const eventGachaToBanners = (gacha: EventGacha): BannerData[] => {
  const units = Array.from(
    new Set(
      gacha.pools.flatMap((p) =>
        p.units.map((u) => EVENT_TO_NORMAL_ITEM[u] || u)
      )
    )
  ).filter((u) => Object.values(EVENT_TO_NORMAL_ITEM).includes(u));
  return units.map((unit) => ({
    name: gacha.name,
    shortName: "ev",
    rateCumSum: [10000],
    pools: [
      {
        rate: 10000,
        units: [unit],
        reroll: false,
      },
    ],
  }));
};

// Outline of the table cells on the best path
export const PATH_COLOR = "#ff6d00";

export const BLUE_ORBS = [
  "Cat Cannon Attack",
  "Cat Cannon Charge",
  "Worker Cat Rate",
  "Worker Cat Wallet",
  "Base Defense",
  "Research",
  "Accounting",
  "Study",
  "Cat Energy",
];

export const ITEM_GROUPS: {
  key: ItemGroupKey;
  label: string;
  matches: (unitName: string) => boolean;
}[] = [
  {
    key: "darkCatseye",
    label: "다크 캣츠아이",
    matches: (unit) => unit === "Dark Catseye",
  },
  {
    key: "cataminC",
    label: "고양이 드링크 C",
    matches: (unit) => unit === "Catamin C",
  },
  {
    key: "cataminB",
    label: "고양이 드링크 B",
    matches: (unit) => unit === "Catamin B",
  },
  {
    key: "radar",
    label: "트레저 레이더",
    matches: (unit) => unit === "Treasure Radar",
  },
  {
    key: "lil",
    label: "꼬맹이 캐릭터",
    matches: (unit) => unit.startsWith("Li'l "),
  },
  {
    key: "orbs",
    label: "파란구슬",
    matches: (unit) => BLUE_ORBS.includes(unit),
  },
];

export const groupOfUnit = (unitName: string) =>
  ITEM_GROUPS.find(({ matches }) => matches(unitName))?.key;

// Which ticket each banner spends
export type TicketType = "cat" | "lucky" | "luckyG" | "event";
export const TICKET_OF_BANNER: Record<string, TicketType> = {
  n: "cat",
  np: "cat",
  cf: "cat",
  ce: "cat",
  lt: "lucky",
  ltg: "luckyG",
  ev: "event",
};
export const TICKET_TYPES: TicketType[] = ["cat", "lucky", "luckyG", "event"];

export type NormalPathRequest = {
  seed: number;
  lastCat: string;
  // Pulls must start within this many rows of the table
  numRolls: number;
  banners: string[];
  // "tickets": at most limits[type] pulls per ticket type
  // "total": at most totalLimit pulls in all
  // "rows": as many pulls as fit in the table
  budgetMode: "tickets" | "total" | "rows";
  limits: Record<TicketType, number>;
  totalLimit: number;
  // "points": maximize the sum of points per item
  // "order": strict priority, rank 1 first (0 = don't care)
  scoreMode: "points" | "order";
  values: Record<ItemGroupKey, number>;
  includeEventDupe?: boolean;
  eventGachaKey?: string;
  // What one event pull track switch costs: a rank (order) or points taken
  // off; 0 = free
  eventSwitchValue?: number;
  // Where the event gacha is now: its own seed and state. Event pulls follow
  // its real results; only the last one before a normal pull matters.
  // Without a seed, each switch counts as one pull of the item it needs.
  eventSeed?: number;
  eventState?: GachaState;
};

export type NormalPathStep = {
  bannerShortName: string;
  // 0-based row, and track A/B, of the cell the pull reads
  row: number;
  track: "A" | "B";
  unitName: string;
  // The previous pull was the same item, so this one was rerolled
  dupe: boolean;
  // Event pulls: how many singles it takes to reach this item
  eventPulls?: number;
  isEventDupeSwitch?: boolean;
  eventUnitName?: string;
};

export type NormalPathResult =
  | {
      found: true;
      steps: NormalPathStep[];
      tickets: Record<TicketType, number>;
      collected: Partial<Record<ItemGroupKey, number>>;
      states: number;
      // The exact search was too big, so this is the best of a faster search
      // that prices tickets instead of counting them
      approximate: boolean;
    }
  | { found: false; reason: string };

const advanceSeed = (seed: number) => {
  seed ^= seed << 13;
  seed = seed >>> 0;
  seed ^= seed >>> 17;
  seed ^= seed << 15;
  seed = seed >>> 0;
  return seed;
};

// Same reroll rule as the table (seed.tsx getUnit)
const unitIndexAfterRemoval = (
  seed: number,
  units: string[],
  removedIndices: number[]
): [number, string] => {
  if (removedIndices.length === 0) {
    const seedMod = seed % units.length;
    return [seedMod, units[seedMod]];
  }
  const seedMod = seed % (units.length - removedIndices.length);
  const numRemovedBefore = removedIndices.filter(
    (index) => index <= seedMod
  ).length;
  return [seedMod, units[seedMod + numRemovedBefore]];
};

type PullResult = { end: number; unit: string; dupe: boolean };

// Event single pulls looked ahead when there's no event ticket count
const EVENT_CHAIN_MAX = 100;

// Unit name the gain of an event pull is looked up under
const EVENT_SWITCH = "__eventSwitch";

// Beyond this the exact search falls back to the approximate one. Keeps the
// worker's memory low and finishes quickly.
const MAX_STATES = 300_000;
// Price tries in the approximate search, for the progress bar
const APPROXIMATE_PASSES = 2;
const APPROXIMATE_BISECTIONS = 7;

export const findBestNormalPath = (
  request: NormalPathRequest,
  onProgress?: (done: number, total: number) => void
): NormalPathResult => {
  const selectedSet = new Set(request.banners);
  const userBanners = request.banners
    .map((shortName) => AllBanners.find((b) => b.shortName === shortName))
    .filter((b): b is BannerData => !!b);
  if (userBanners.length === 0) {
    return { found: false, reason: "사용할 배너를 하나 이상 고르세요." };
  }
  // Lucky Ticket (lt) is always available to step over non-priority cells,
  // and is placed first (index 0) so ties naturally prefer Lucky Ticket over spending
  // Cat Tickets or Lucky Ticket G.
  const ltBanner = AllBanners.find((b) => b.shortName === "lt")!;
  let eventBanners: BannerData[] = [];
  if (request.includeEventDupe) {
    const eg =
      EVENT_GACHAS.find((g) => g.key === request.eventGachaKey) ||
      EVENT_GACHAS[0];
    eventBanners = eventGachaToBanners(eg);
  }
  const banners = [
    ltBanner,
    ...userBanners.filter((b) => b.shortName !== "lt"),
    ...eventBanners,
  ];
  const ltIndex = 0;

  // Tickets of each type the path may spend: Lucky Tickets always, the others
  // only when one of their banners is in use
  const ticketLimit = (type: TicketType) => {
    if (
      type !== "lucky" &&
      !banners.some((b) => TICKET_OF_BANNER[b.shortName] === type)
    ) {
      return 0;
    }
    const raw = request.limits[type];
    return Math.max(0, Math.floor(raw !== undefined ? raw : 10));
  };
  // Maximum number of pulls possible under the chosen budget mode. With
  // ticket counts the path ends once every ticket is spent.
  const maxPulls =
    request.budgetMode === "total"
      ? Math.min(
          request.numRolls,
          Math.max(0, Math.floor(request.totalLimit || 0))
        )
      : request.budgetMode === "tickets"
      ? Math.min(
          request.numRolls,
          TICKET_TYPES.filter((type) => type !== "event").reduce(
            (sum, type) => sum + ticketLimit(type),
            0
          )
        )
      : request.numRolls;
  if (maxPulls <= 0) {
    return {
      found: true,
      steps: [],
      tickets: { cat: 0, lucky: 0, luckyG: 0, event: 0 },
      collected: {},
      states: 0,
      approximate: false,
    };
  }
  const tablePositions = request.numRolls * 2;

  // Seeds on demand; seeds[i] is the seed after i advances
  const seeds = [request.seed >>> 0];
  const seedAt = (i: number) => {
    while (seeds.length <= i) {
      seeds.push(advanceSeed(seeds[seeds.length - 1]));
    }
    return seeds[i];
  };

  // Cost dimensions: which counter each banner's pull adds to, and its limit.
  // A limit that can't run out within the table is dropped.
  const dimLimits: number[] = [];
  const bannerDim: number[] = banners.map(() => -1);
  if (request.budgetMode === "tickets") {
    TICKET_TYPES.forEach((type) => {
      const users = banners
        .map((b, i) => (TICKET_OF_BANNER[b.shortName] === type ? i : -1))
        .filter((i) => i >= 0);
      if (users.length === 0) {
        return;
      }
      const limit = ticketLimit(type);
      if (limit <= 0) {
        users.forEach((i) => (bannerDim[i] = -2));
        return;
      }
      if (limit >= request.numRolls) {
        return;
      }
      users.forEach((i) => (bannerDim[i] = dimLimits.length));
      dimLimits.push(limit);
    });
  } else if (request.budgetMode === "total") {
    const limit = Math.max(0, Math.floor(request.totalLimit || 0));
    if (limit < request.numRolls) {
      banners.forEach((b, i) => {
        if (b.shortName !== "ev") {
          bannerDim[i] = 0;
        }
      });
      dimLimits.push(limit);
    }
  }

  // Event pulls walk the event gacha's own results, so the count used so far
  // is where the next one starts: with a known seed, event banners always get
  // a dimension
  const eventSeedKnown = request.eventSeed !== undefined;
  const evBanners = banners
    .map((b, i) => (b.shortName === "ev" ? i : -1))
    .filter((i) => i >= 0);
  let evDim = evBanners.length > 0 ? bannerDim[evBanners[0]] : -1;
  if (!eventSeedKnown) {
    evDim = -1;
  } else if (evBanners.length > 0 && bannerDim[evBanners[0]] !== -2) {
    if (bannerDim[evBanners[0]] >= 0) {
      evDim = bannerDim[evBanners[0]];
    } else {
      evDim = dimLimits.length;
      dimLimits.push(
        request.budgetMode === "tickets"
          ? Math.min(EVENT_CHAIN_MAX, ticketLimit("event"))
          : EVENT_CHAIN_MAX
      );
      evBanners.forEach((i) => (bannerDim[i] = evDim));
    }
  }
  // evUnits[j]: normal item name of the (j + 1)-th event pull, "" for none.
  // evFirstAt[b][j]: first index >= j whose item is event banner b's.
  const evUnits: string[] = [];
  const evFirstAt = new Map<number, Int32Array>();
  if (eventSeedKnown && evDim >= 0) {
    const gacha =
      EVENT_GACHAS.find((g) => g.key === request.eventGachaKey) ||
      EVENT_GACHAS[0];
    const evSeeds = new SeedList(request.eventSeed!);
    let state: GachaState = request.eventState ?? {
      lastRoll: "",
      guaranteedLeft: gacha.guaranteed ? gacha.guaranteed.step : null,
      medamaStock: gacha.medama ? gacha.medama.stock : 0,
      medamaLeft: gacha.medama ? gacha.medama.guaranteedSteps : null,
    };
    let i = 1;
    for (let j = 0; j < dimLimits[evDim]; j++) {
      const outcome = singlePull(gacha, evSeeds, i, state);
      evUnits.push(EVENT_TO_NORMAL_ITEM[outcome.results[0].unit] || "");
      i += outcome.consumed;
      state = outcome.state;
    }
    evBanners.forEach((b) => {
      const unit = banners[b].pools[0].units[0];
      const firstAt = new Int32Array(evUnits.length + 1).fill(-1);
      for (let j = evUnits.length - 1; j >= 0; j--) {
        firstAt[j] = evUnits[j] === unit ? j : firstAt[j + 1];
      }
      evFirstAt.set(b, firstAt);
    });
  }
  // Event pulls it takes, from j used so far, to get banner b's item; 0 if
  // it doesn't come up in time
  const eventPullsFor = (b: number, j: number) => {
    if (!eventSeedKnown) {
      return 1;
    }
    const at = evFirstAt.get(b)?.[j] ?? -1;
    return at < 0 ? 0 : at + 1 - j;
  };

  // Score: one number for points, one count per rank for strict order
  // (compared rank 1 first)
  // An event pull switch at rank N sits just above the items of rank N, so
  // only items ranked 1 to N - 1 can pay for it
  const eventRank =
    request.scoreMode === "order" && request.includeEventDupe
      ? request.eventSwitchValue || 0
      : 0;
  const maxItemRank = Math.max(
    0,
    ...ITEM_GROUPS.map(({ key }) => request.values[key] || 0)
  );
  const ranks =
    request.scoreMode === "points"
      ? 1
      : eventRank > 0
      ? Math.max(maxItemRank + 1, eventRank)
      : maxItemRank;
  // Score slot of an item rank (or of the event switch)
  const rankIndex = (rank: number, isEventSwitch = false) =>
    isEventSwitch || eventRank === 0 || rank < eventRank ? rank - 1 : rank;
  if (
    ranks === 0 ||
    ITEM_GROUPS.every(({ key }) => !(request.values[key] > 0))
  ) {
    return { found: false, reason: "점수나 순위를 준 아이템이 없습니다." };
  }
  const gainCache = new Map<string, number[] | null>();
  const gainOf = (unit: string) => {
    let gain = gainCache.get(unit);
    if (gain === undefined) {
      gain = null;
      const group = groupOfUnit(unit);
      const value =
        unit === EVENT_SWITCH
          ? request.eventSwitchValue || 0
          : group
          ? request.values[group] || 0
          : 0;
      // An event pull switch counts against its rank instead of for it
      const sign = unit === EVENT_SWITCH ? -1 : 1;
      if (value > 0) {
        gain = new Array(ranks).fill(0);
        if (request.scoreMode === "points") {
          gain[0] = sign * value;
        } else {
          gain[rankIndex(value, unit === EVENT_SWITCH)] = sign;
        }
      }
      gainCache.set(unit, gain);
    }
    return gain;
  };

  // Pull results per (position, banner): canonical and after a dupe
  const unitIds = new Map<string, number>([["", 0]]);
  const unitNames = [""];
  const idOf = (unit: string) => {
    let id = unitIds.get(unit);
    if (id === undefined) {
      id = unitNames.length;
      unitIds.set(unit, id);
      unitNames.push(unit);
    }
    return id;
  };
  const pullCache = new Map<number, PullResult>();
  const bannerPoolAt = (p: number, b: number) => {
    const banner = banners[b];
    const raritySeed = seedAt(p + 1);
    const rarity = banner.rateCumSum.findIndex(
      (sum) => raritySeed % 10000 < sum
    );
    return banner.pools[rarity];
  };
  const canonPull = (p: number, b: number): PullResult => {
    const canonKey = (p * banners.length + b) * 2;
    let canon = pullCache.get(canonKey);
    if (!canon) {
      const pool = bannerPoolAt(p, b);
      const [, unit] = unitIndexAfterRemoval(seedAt(p + 2), pool.units, []);
      canon = { end: p + 2, unit, dupe: false };
      pullCache.set(canonKey, canon);
    }
    return canon;
  };
  const isSameUnit = (a: string, b: string) =>
    a === b ||
    NORMAL_TO_EVENT_ITEM[a] === b ||
    EVENT_TO_NORMAL_ITEM[a] === b;

  const pull = (p: number, b: number, last: string): PullResult => {
    if (banners[b].shortName === "ev") {
      // Event gacha does NOT advance the normal gacha seed index (`end = p`);
      // it only overwrites `last` with the event item to trigger a dupe on the
      // current normal gacha cell `p`.
      return { end: p, unit: banners[b].pools[0].units[0], dupe: false };
    }
    const canon = canonPull(p, b);
    const pool = bannerPoolAt(p, b);
    if (!isSameUnit(canon.unit, last) || !pool.reroll) {
      return canon;
    }
    const canonKey = (p * banners.length + b) * 2;
    let dupe = pullCache.get(canonKey + 1);
    if (!dupe) {
      const [firstIndex] = unitIndexAfterRemoval(seedAt(p + 2), pool.units, []);
      const removed = [firstIndex];
      let unit = canon.unit;
      let end = p + 2;
      while (isSameUnit(unit, canon.unit)) {
        end++;
        const [index, name] = unitIndexAfterRemoval(
          seedAt(end),
          pool.units,
          removed
        );
        unit = name;
        removed.push(index);
      }
      // unit is undefined when the reroll ran out of items
      dupe = { end, unit: unit || "", dupe: true };
      pullCache.set(canonKey + 1, dupe);
    }
    return dupe;
  };

  // Non-lt banners (n, np, cf, ce, ltg) may be pulled if:
  // 1. It yields a priority item (gainOf(unit) !== null), OR
  // 2. It triggers a duplicate reroll (dupe = true, 열이동) to switch tracks
  // Event gacha banner (ev) only sets `last` without advancing `p`, and is only
  // allowed when `unit` matches a rerollable normal banner's canonical unit at `p`.
  // All flat non-priority progression is filled with Lucky Tickets (lt).
  const isAllowedPull = (b: number, unit: string, dupe: boolean) => {
    if (!unit) {
      return false;
    }
    if (banners[b].shortName === "ev") {
      return false;
    }
    if (b === ltIndex) {
      return true;
    }
    if (!selectedSet.has(banners[b].shortName)) {
      return false;
    }
    // Once Lucky Tickets are limited, other tickets may have to step over
    // cells too
    return dupe || gainOf(unit) !== null || bannerDim[ltIndex] !== -1;
  };

  const isAllowedEventPullAt = (p: number, b: number, last: string) => {
    const unit = banners[b].pools[0].units[0];
    if (!unit || isSameUnit(unit, last)) {
      return false;
    }
    const uid = idOf(unit);
    const list = rerollUnitsAtPos[p];
    return !!list && list.some((item) => item.unitId === uid);
  };

  // Tight upper bound on seed position reachable within maxPulls pulls
  const minPullsToPos = new Int32Array(tablePositions + 1).fill(maxPulls + 1);
  minPullsToPos[0] = 0;
  let maxReachablePos = 0;
  for (let p = 0; p < tablePositions; p++) {
    const stepsHere = minPullsToPos[p];
    if (stepsHere >= maxPulls) {
      continue;
    }
    maxReachablePos = p + 1;
    const nextSteps = stepsHere + 1;
    for (let b = 0; b < banners.length; b++) {
      if (bannerDim[b] === -2) {
        continue;
      }
      const canon = canonPull(p, b);
      if (isAllowedPull(b, canon.unit, false)) {
        const cEnd = p + 2;
        if (cEnd <= tablePositions && nextSteps < minPullsToPos[cEnd]) {
          minPullsToPos[cEnd] = nextSteps;
        }
      }
      if (bannerPoolAt(p, b).reroll) {
        const dupe = pull(p, b, canon.unit);
        if (
          isAllowedPull(b, dupe.unit, dupe.dupe) &&
          dupe.end <= tablePositions &&
          nextSteps < minPullsToPos[dupe.end]
        ) {
          minPullsToPos[dupe.end] = nextSteps;
        }
      }
    }
  }
  const positions = Math.min(tablePositions, maxReachablePos);

  // At position p, `last` only matters if it equals the canonical unit of a
  // banner whose pool at p has reroll=true and that banner can be pulled at p.
  // Otherwise it behaves identically to "" (id 0), merging ~90% of states at
  // every position without loss.
  const rerollUnitsAtPos: { b: number; unitId: number }[][] = new Array(
    positions
  );
  for (let p = 0; p < positions; p++) {
    const list: { b: number; unitId: number }[] = [];
    for (let b = 0; b < banners.length; b++) {
      if (bannerDim[b] !== -2 && bannerPoolAt(p, b).reroll) {
        const canon = canonPull(p, b);
        const dupe = pull(p, b, canon.unit);
        if (
          isAllowedPull(b, canon.unit, false) ||
          isAllowedPull(b, dupe.unit, dupe.dupe)
        ) {
          list.push({ b, unitId: idOf(canon.unit) });
        }
      }
    }
    rerollUnitsAtPos[p] = list;
  }

  // DP over positions from start. Returns the banner of each pull of the best
  // path, or null when it would need more than maxStates states.
  // dimOfBanner: the cost dimension of each banner, -1 for none, -2 to leave
  // the banner out. penalty (approximate search) is taken off the score per
  // pull.
  const search = (
    start: { p: number; last: string; eventUsed?: number },
    limits: number[],
    dimOfBanner: number[],
    scoreRanks: number,
    gain: (unit: string) => number[] | null,
    penalty: number[] | null,
    maxStates: number,
    progress?: (p: number) => void
  ): { banners: number[]; states: number } | null => {
    // Tickets used are packed into one number (mixed radix), and the key of
    // a state in its position's bucket is (last roll, tickets used)
    const radix: number[] = [];
    let costSpace = 1;
    limits.forEach((limit) => {
      radix.push(costSpace);
      costSpace *= limit + 1;
    });
    const usedOf = (packed: number, dim: number) =>
      Math.floor(packed / radix[dim]) % (limits[dim] + 1);

    const effectiveLastId = (p: number, unit: string, packedCost: number) => {
      if (!unit || p >= positions) {
        return 0;
      }
      const uid = idOf(unit);
      const list = rerollUnitsAtPos[p];
      for (let i = 0; i < list.length; i++) {
        if (list[i].unitId === uid) {
          const dim = dimOfBanner[list[i].b];
          if (
            dim !== -2 &&
            (dim < 0 || usedOf(packedCost, dim) < limits[dim])
          ) {
            return uid;
          }
        }
      }
      return 0;
    };

    // Per state: score, pulls, non-lt pulls, parent, banner of the last pull.
    // Strict order scores are item counts, which fit in 16 bits; points can be
    // fractional in the approximate search.
    let capacity = 1 << 16;
    let stScore: Float64Array | Int16Array =
      scoreRanks > 1
        ? new Int16Array(capacity * scoreRanks)
        : new Float64Array(capacity * scoreRanks);
    let stPulls = new Int16Array(capacity);
    let stSpecialPulls = new Int16Array(capacity);
    // Track switches: dupe rerolls, which event pulls also lead to
    let stSwitches = new Int16Array(capacity);
    let stParent = new Int32Array(capacity);
    let stBanner = new Int8Array(capacity);
    const grow = () => {
      const resize = <
        T extends Int16Array | Int32Array | Float64Array | Int8Array
      >(
        array: T,
        width: number
      ): T => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const next = new (array.constructor as any)(capacity * 2 * width);
        next.set(array);
        return next;
      };
      stScore = resize(stScore, scoreRanks);
      stPulls = resize(stPulls, 1);
      stSpecialPulls = resize(stSpecialPulls, 1);
      stSwitches = resize(stSwitches, 1);
      stParent = resize(stParent, 1);
      stBanner = resize(stBanner, 1);
      capacity *= 2;
    };
    // Higher score first, then fewer track switches, then fewer
    // non-Lucky-Ticket pulls, then fewer total pulls
    const better = (a: number, b: number) => {
      for (let r = 0; r < scoreRanks; r++) {
        const diff =
          stScore[a * scoreRanks + r] - stScore[b * scoreRanks + r];
        if (diff !== 0) {
          return diff > 0;
        }
      }
      if (stSwitches[a] !== stSwitches[b]) {
        return stSwitches[a] < stSwitches[b];
      }
      if (stSpecialPulls[a] !== stSpecialPulls[b]) {
        return stSpecialPulls[a] < stSpecialPulls[b];
      }
      return stPulls[a] < stPulls[b];
    };

    const buckets: (Map<number, number> | undefined)[] = [];
    const bucketAt = (p: number) => {
      let bucket = buckets[p];
      if (!bucket) {
        bucket = new Map();
        buckets[p] = bucket;
      }
      return bucket;
    };

    stParent[0] = -1;
    stBanner[0] = -1;
    let count = 1;
    // Event pulls already made decide where the next ones start
    const startCost = evDim >= 0 ? (start.eventUsed || 0) * radix[evDim] : 0;
    bucketAt(start.p).set(
      effectiveLastId(start.p, start.last, startCost) * costSpace + startCost,
      0
    );
    let best = 0;

    for (let p = start.p; p < positions; p++) {
      progress?.(p);
      const bucket = buckets[p];
      if (!bucket) {
        continue;
      }
      const entries = Array.from(bucket.entries());
      for (let eIdx = 0; eIdx < entries.length; eIdx++) {
        const [stateKey, state] = entries[eIdx];
        if (stPulls[state] >= maxPulls) {
          continue;
        }
        const last = unitNames[Math.floor(stateKey / costSpace)];
        const packedCost = stateKey % costSpace;
        const prevBanner = stBanner[state];
        for (let b = 0; b < banners.length; b++) {
          const isEv = banners[b].shortName === "ev";
          if (isEv && prevBanner >= 0 && banners[prevBanner].shortName === "ev") {
            continue;
          }
          const dim = dimOfBanner[b];
          if (
            dim === -2 ||
            (dim >= 0 && usedOf(packedCost, dim) >= limits[dim])
          ) {
            continue;
          }
          const steps = isEv ? eventPullsFor(b, usedOf(packedCost, dim)) : 1;
          if (steps === 0) {
            continue;
          }
          const result = pull(p, b, last);
          if (
            isEv
              ? !isAllowedEventPullAt(p, b, last)
              : !isAllowedPull(b, result.unit, result.dupe)
          ) {
            continue;
          }
          const nextCost = packedCost + (dim >= 0 ? steps * radix[dim] : 0);
          const nextLastId = effectiveLastId(result.end, result.unit, nextCost);
          const key = nextLastId * costSpace + nextCost;
          const target = bucketAt(result.end);

          // Build the new state in the next free slot, then keep it only if
          // it's new or beats the one already there
          if (count >= capacity) {
            grow();
          }
          const next = count;
          const unitGain = gain(isEv ? EVENT_SWITCH : result.unit);
          for (let r = 0; r < scoreRanks; r++) {
            stScore[next * scoreRanks + r] =
              stScore[state * scoreRanks + r] + (unitGain ? unitGain[r] : 0);
          }
          if (penalty) {
            stScore[next * scoreRanks] -= penalty[b];
          }
          stPulls[next] = stPulls[state] + (isEv ? 0 : 1);
          stSpecialPulls[next] =
            stSpecialPulls[state] + (b === ltIndex ? 0 : 1);
          stSwitches[next] = stSwitches[state] + (result.dupe ? 1 : 0);
          stParent[next] = state;
          stBanner[next] = b;

          const existing = target.get(key);
          let kept = next;
          if (existing !== undefined) {
            if (!better(next, existing)) {
              continue;
            }
            // If it's in the same bucket `p` and already in `entries`, push a new slot so we expand the improved state too
            if (isEv) {
              target.set(key, next);
              entries.push([key, next]);
              count++;
              if (count > maxStates) {
                return null;
              }
            } else {
              // Not expanded yet, so nothing points at it: overwrite in place
              for (let r = 0; r < scoreRanks; r++) {
                stScore[existing * scoreRanks + r] =
                  stScore[next * scoreRanks + r];
              }
              stPulls[existing] = stPulls[next];
              stSpecialPulls[existing] = stSpecialPulls[next];
              stSwitches[existing] = stSwitches[next];
              stParent[existing] = state;
              stBanner[existing] = b;
              kept = existing;
            }
          } else {
            target.set(key, next);
            if (isEv) {
              entries.push([key, next]);
            }
            count++;
            if (count > maxStates) {
              return null;
            }
          }
          if (better(kept, best)) {
            best = kept;
          }
        }
      }
      // Done with this position
      buckets[p] = undefined;
    }

    const chain: number[] = [];
    for (let s = best; stParent[s] >= 0; s = stParent[s]) {
      chain.push(stBanner[s]);
    }
    return { banners: chain.reverse(), states: count };
  };

  // Turn a list of banners into the pulls they make, filling all remaining
  // cells up to tablePositions / maxPulls with Lucky Tickets (lt).
  const replay = (pullBanners: number[], fillRemaining = false) => {
    const steps: NormalPathStep[] = [];
    let p = 0;
    let last = request.lastCat;
    let eventUsed = 0;
    const pushPull = (b: number) => {
      const result = pull(p, b, last);
      if (!result.unit) {
        return false;
      }
      const eventPulls =
        banners[b].shortName === "ev" ? eventPullsFor(b, eventUsed) : 0;
      eventUsed += eventPulls;
      steps.push({
        bannerShortName: banners[b].shortName,
        row: p >> 1,
        track: p % 2 === 0 ? "A" : "B",
        unitName: result.unit,
        dupe: result.dupe,
        ...(eventPulls ? { eventPulls } : {}),
      });
      p = result.end;
      last = result.unit;
      return true;
    };
    pullBanners.forEach((b) => {
      const prevStep = steps.length > 0 ? steps[steps.length - 1] : null;
      const ok = pushPull(b);
      if (ok && prevStep && prevStep.bannerShortName === "ev") {
        const curStep = steps[steps.length - 1];
        if (curStep.dupe) {
          curStep.isEventDupeSwitch = true;
          curStep.eventUnitName = prevStep.unitName;
        }
      }
    });
    if (fillRemaining && request.budgetMode === "tickets") {
      // Spend what is left, Lucky Tickets first
      const left = Object.fromEntries(
        TICKET_TYPES.map((type) => [type, ticketLimit(type)])
      ) as Record<TicketType, number>;
      steps.forEach(({ bannerShortName, eventPulls }) => {
        left[TICKET_OF_BANNER[bannerShortName]] -= eventPulls || 1;
      });
      while (p < tablePositions) {
        const b = banners.findIndex(
          (banner) =>
            banner.shortName !== "ev" &&
            left[TICKET_OF_BANNER[banner.shortName]] > 0
        );
        if (b < 0 || !pushPull(b)) {
          break;
        }
        left[TICKET_OF_BANNER[banners[b].shortName]]--;
      }
    } else if (fillRemaining) {
      let normalPulls = steps.filter((s) => s.bannerShortName !== "ev").length;
      while (p < tablePositions && normalPulls < maxPulls) {
        if (!pushPull(ltIndex)) {
          break;
        }
        normalPulls++;
      }
    }
    return steps;
  };
  const scoreOf = (pullBanners: number[]) => {
    const score = new Array(ranks).fill(0);
    replay(pullBanners, true).forEach(({ bannerShortName, unitName }) => {
      gainOf(
        bannerShortName === "ev" ? EVENT_SWITCH : unitName
      )?.forEach((value, r) => (score[r] += value));
    });
    return score;
  };
  const compareScores = (a: number[], b: number[]) => {
    for (let r = 0; r < a.length; r++) {
      if (a[r] !== b[r]) {
        return a[r] - b[r];
      }
    }
    return 0;
  };

  const finish = (
    pullBanners: number[],
    states: number,
    approximate: boolean
  ): NormalPathResult => {
    const steps = replay(pullBanners, true);
    const tickets: Record<TicketType, number> = {
      cat: 0,
      lucky: 0,
      luckyG: 0,
      event: 0,
    };
    const collected: Partial<Record<ItemGroupKey, number>> = {};
    steps.forEach(({ bannerShortName, unitName, eventPulls }) => {
      tickets[TICKET_OF_BANNER[bannerShortName]] += eventPulls || 1;
      if (bannerShortName !== "ev") {
        const group = groupOfUnit(unitName);
        if (group && gainOf(unitName)) {
          collected[group] = (collected[group] || 0) + 1;
        }
      }
    });
    return { found: true, steps, tickets, collected, states, approximate };
  };

  const root = { p: 0, last: request.lastCat, eventUsed: 0 };
  const exact = search(root, dimLimits, bannerDim, ranks, gainOf, null, MAX_STATES, (p) => {
    if (onProgress && p % 20 === 0) {
      onProgress(p, positions * 2);
    }
  });
  if (exact) {
    return finish(exact.banners, exact.states, false);
  }

  // Approximate: drop the ticket counts from the state and charge a price per
  // pull of each ticket type instead (Lagrangian relaxation). Prices go up for
  // tickets the path overspends and down for ones it leaves unused. A path
  // that overspends is cut where it runs out, so every round gives a valid
  // path; keep the best.
  const weightOf = (unit: string) => {
    const unitGain = gainOf(unit);
    if (!unitGain) {
      return null;
    }
    // Strict order as weights: one rank-r item outweighs any number of lower
    // ones within the table
    let weight = 0;
    unitGain.forEach((value, r) => {
      weight += value * Math.pow(maxPulls + 1, ranks - 1 - r);
    });
    return [weight];
  };
  const maxWeight = Math.max(
    ...ITEM_GROUPS.map(({ key }) => {
      const value = request.values[key] || 0;
      if (value <= 0) {
        return 0;
      }
      return request.scoreMode === "points"
        ? value
        : Math.pow(maxPulls + 1, ranks - 1 - rankIndex(value));
    })
  );
  const prices = dimLimits.map(() => 0);
  let bestBanners: number[] = [];
  let bestScore = new Array(ranks).fill(0);
  let states = 0;
  const relaxedSearch = (
    start: { p: number; last: string; eventUsed: number },
    exhausted: boolean[]
  ) => {
    const result = search(
      start,
      // Only the event pull count is tracked: it decides what they give
      dimLimits.map((limit, dim) => (dim === evDim ? limit : 0)),
      bannerDim.map((dim) =>
        dim >= 0 && exhausted[dim] ? -2 : dim === evDim ? evDim : -1
      ),
      1,
      weightOf,
      banners.map((_, b) => (bannerDim[b] >= 0 ? prices[bannerDim[b]] : 0)),
      Infinity
    )!;
    states += result.states;
    return result.banners;
  };
  // Plan with the current prices, follow it until a ticket type runs out,
  // then plan the rest again from there without that ticket's banners.
  // Keeps the best path seen; returns how many of each ticket the first plan
  // wanted.
  const totalApproxRounds =
    1 + APPROXIMATE_PASSES * dimLimits.length * APPROXIMATE_BISECTIONS;
  let rounds = 0;
  const tryPrices = () => {
    rounds++;
    onProgress?.(
      positions +
        Math.floor(
          (Math.min(rounds, totalApproxRounds) * positions) /
            Math.max(1, totalApproxRounds)
        ),
      positions * 2
    );
    const initialExhausted = dimLimits.map((limit) => limit <= 0);
    const firstPlan = relaxedSearch(root, initialExhausted);
    const path: number[] = [];
    const used = dimLimits.map(() => 0);
    const exhausted = [...initialExhausted];
    let plan = firstPlan;
    let position = { ...root };
    for (;;) {
      let cut = -1;
      for (let i = 0; i < plan.length; i++) {
        const dim = bannerDim[plan[i]];
        if (dim >= 0 && used[dim] >= dimLimits[dim]) {
          cut = i;
          break;
        }
        if (dim >= 0) {
          used[dim] +=
            dim === evDim ? eventPullsFor(plan[i], used[dim]) : 1;
        }
        const result = pull(position.p, plan[i], position.last);
        position = {
          p: result.end,
          last: result.unit,
          eventUsed: evDim >= 0 ? used[evDim] : 0,
        };
        path.push(plan[i]);
      }
      if (cut < 0) {
        break;
      }
      dimLimits.forEach((limit, dim) => {
        if (used[dim] >= limit) {
          exhausted[dim] = true;
        }
      });
      plan = relaxedSearch(position, exhausted);
    }
    const score = scoreOf(path);
    const order = compareScores(score, bestScore);
    if (order > 0 || (order === 0 && path.length < bestBanners.length)) {
      bestBanners = path;
      bestScore = score;
    }
    const wanted = dimLimits.map(() => 0);
    firstPlan.forEach((b) => {
      if (bannerDim[b] >= 0) {
        wanted[bannerDim[b]]++;
      }
    });
    return wanted;
  };

  // Find each ticket's price by bisection so the plan wants about as many as
  // there are, a few passes over the ticket types since they interact
  const initialWanted = tryPrices();
  for (let pass = 0; pass < APPROXIMATE_PASSES; pass++) {
    dimLimits.forEach((limit, dim) => {
      if (
        limit <= 0 ||
        dim === evDim ||
        (pass === 0 && initialWanted[dim] <= limit)
      ) {
        return;
      }
      let low = 0;
      let high = maxWeight * 2;
      for (let i = 0; i < APPROXIMATE_BISECTIONS; i++) {
        prices[dim] = (low + high) / 2;
        if (tryPrices()[dim] > limit) {
          low = prices[dim];
        } else {
          high = prices[dim];
        }
      }
      prices[dim] = high;
    });
  }
  return finish(bestBanners, states, true);
};
