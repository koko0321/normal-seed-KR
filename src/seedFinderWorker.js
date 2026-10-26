const advanceSeed = (seed) => {
  seed ^= seed << 13;
  seed = seed >>> 0; // Convert to 32bit unsigned integer
  seed ^= seed >>> 17;
  seed ^= seed << 15;
  seed = seed >>> 0; // Convert to 32bit unsigned integer
  return seed;
};

// Inverse of 32-bit xorshift (x ^= x << 13; x ^= x >>> 17; x ^= x << 15)
const prevSeed = (seed) => {
  seed = (seed ^ (seed << 15) ^ (seed << 30)) >>> 0;
  seed = (seed ^ (seed >>> 17)) >>> 0;
  seed = (seed ^ (seed << 13) ^ (seed << 26)) >>> 0;
  return seed;
};

const getRarity = ({ seed, rateCumSum }) => {
  const seedMod = seed % 10000;
  for (let i = 0; i < rateCumSum.length; i++) {
    if (seedMod < rateCumSum[i]) {
      return i;
    }
  }
  return rateCumSum.length - 1;
};

// Mirrors getUnit in utils/seed.tsx so the finder agrees with the tracker
const getUnit = ({ seed, rarity, bannerUnits, removedIndices = [] }) => {
  const units = bannerUnits[rarity];
  if (removedIndices.length === 0) {
    const seedMod = seed % units.length;
    return [seedMod, units[seedMod]];
  }
  const seedMod = seed % (units.length - removedIndices.length);
  const numRemovedIndicesBeforeSeedMod = removedIndices.filter(
    (index) => index <= seedMod
  ).length;
  return [seedMod, units[seedMod + numRemovedIndicesBeforeSeedMod]];
};

const check = ({
  seed,
  rolls,
  bannerRateCumSum,
  bannerUnits,
  bannerRerollablePools,
  allowFirstReroll = false,
}) => {
  let lastRoll = -1;
  for (const userRoll of rolls) {
    seed = advanceSeed(seed);
    const rarity = getRarity({ seed, rateCumSum: bannerRateCumSum });

    seed = advanceSeed(seed);
    const [unitIndex, unitId] = getUnit({ seed, rarity, bannerUnits });

    if (
      allowFirstReroll &&
      lastRoll === -1 &&
      userRoll !== unitId &&
      bannerRerollablePools.includes(rarity)
    ) {
      lastRoll = unitId;
    }

    if (unitId === lastRoll && bannerRerollablePools.includes(rarity)) {
      // Pools like Lucky Ticket repeat items, so keep rerolling until the
      // item actually differs
      const removedIndices = [unitIndex];
      let rerolledUnitId = unitId;
      while (rerolledUnitId === unitId) {
        seed = advanceSeed(seed);
        const [nextUnitIndex, nextUnitId] = getUnit({
          seed,
          rarity,
          bannerUnits,
          removedIndices,
        });
        rerolledUnitId = nextUnitId;
        removedIndices.push(nextUnitIndex);
      }
      if (userRoll !== rerolledUnitId) {
        return false;
      }
      lastRoll = rerolledUnitId;
    } else {
      if (userRoll !== unitId) {
        return false;
      }
      lastRoll = unitId;
    }
  }

  return true;
};

// Calls fn for every s in [startSeed, endSeed) with s % mod === residue
const forEachResidue = (startSeed, endSeed, mod, residue, fn) => {
  const rem = startSeed % mod;
  let s = startSeed + (residue >= rem ? residue - rem : mod - (rem - residue));
  for (; s < endSeed; s += mod) {
    fn(s);
  }
};

// Returns a function to call once per checked seed; posts progress every 10%
const progressReporter = (totalSteps) => {
  const reportEvery = Math.max(1, Math.floor(totalSteps / 10));
  let steps = 0;
  let percentageSearched = 0;
  return () => {
    steps++;
    if (steps % reportEvery === 0 && percentageSearched < 90) {
      percentageSearched += 10;
      postMessage({ type: "progress", percentageSearched });
    }
  };
};

// The ways the first roll can give its target, each as a residue class of one
// seed so the search can jump straight across it:
// - "plain" (rerolls = 0): the unit seed picks the target
// - rerolls = L: the pull before is unknown, so the unit seed may have picked
//   a dupe of it, rerolled L times in a row (the pool must have L copies of
//   that unit) until the last reroll seed picked the target. With L units
//   removed, the target's position is between its own and L lower.
const firstRollPasses = ({
  firstTarget,
  bannerRateCumSum,
  bannerUnits,
  bannerRerollablePools,
}) => {
  const passes = [];
  bannerUnits.forEach((units, p) => {
    const rateLo = p === 0 ? 0 : bannerRateCumSum[p - 1];
    const rateHi = bannerRateCumSum[p];
    const slots = [];
    units.forEach((unit, slot) => unit === firstTarget && slots.push(slot));
    if (rateHi <= rateLo || slots.length === 0) {
      return;
    }
    const base = { units, rateLo, rateHi };
    slots.forEach((slot) =>
      passes.push({ ...base, rerolls: 0, mod: units.length, residue: slot })
    );
    if (!bannerRerollablePools.includes(p)) {
      return;
    }
    const copies = new Map();
    units.forEach((unit) => copies.set(unit, (copies.get(unit) || 0) + 1));
    copies.delete(firstTarget);
    const maxRerolls = Math.max(0, ...copies.values());
    // Copies of the unit in each slot (0 for the target), and a reusable
    // buffer for the removed indices while replaying
    const copiesBySlot = units.map((unit) => copies.get(unit) || 0);
    const removed = new Array(maxRerolls + 1);
    for (let rerolls = 1; rerolls <= maxRerolls; rerolls++) {
      const mod = units.length - rerolls;
      const residues = new Set();
      slots.forEach((slot) => {
        for (let r = slot - rerolls; r <= slot; r++) {
          if (r >= 0 && r < mod) {
            residues.add(r);
          }
        }
      });
      residues.forEach((residue) =>
        passes.push({ ...base, rerolls, mod, residue, copiesBySlot, removed })
      );
    }
  });
  return passes;
};

// For a reroll pass: given the last reroll seed, walks back to the unit seed
// and replays the reroll chain the same way check() does. Returns the unit
// seed if the chain gives the target, otherwise null. Runs for a large share
// of all seeds, so it avoids allocating.
const replayFirstRollRerolls = (pass, lastRerollSeed, target) => {
  const { units, rerolls, copiesBySlot, removed } = pass;
  let unitSeed = lastRerollSeed;
  for (let j = 0; j < rerolls; j++) {
    unitSeed = prevSeed(unitSeed);
  }
  const unitIndex = unitSeed % units.length;
  if (copiesBySlot[unitIndex] < rerolls) {
    // Also rejects the target itself, which has 0 copies here
    return null;
  }
  const rolled = units[unitIndex];
  removed[0] = unitIndex;
  let seed = unitSeed;
  for (let j = 0; j < rerolls; j++) {
    seed = advanceSeed(seed);
    const numRemoved = j + 1;
    const seedMod = seed % (units.length - numRemoved);
    let picked = seedMod;
    for (let k = 0; k < numRemoved; k++) {
      if (removed[k] <= seedMod) {
        picked++;
      }
    }
    if (units[picked] !== (j === rerolls - 1 ? target : rolled)) {
      return null;
    }
    removed[numRemoved] = seedMod;
  }
  return unitSeed;
};

// Cheap pre-filter before check(): given the last seed of the first roll, the
// second roll's plain result must already be the second target, or be a dupe
// of the first target that a reroll may still turn into it
const secondRollCouldMatch = (seed, rolls, bannerRateCumSum, bannerUnits, bannerRerollablePools) => {
  if (rolls.length < 2) {
    return true;
  }
  const raritySeed = advanceSeed(seed);
  const rarity = getRarity({ seed: raritySeed, rateCumSum: bannerRateCumSum });
  const units = bannerUnits[rarity];
  const unit = units[advanceSeed(raritySeed) % units.length];
  return (
    unit === rolls[1] ||
    (unit === rolls[0] && bannerRerollablePools.includes(rarity))
  );
};

const searchRange = (data) => {
  const {
    startSeed,
    endSeed,
    rolls,
    bannerRateCumSum,
    bannerUnits,
    bannerRerollablePools,
    allowFirstReroll = false,
  } = data;

  if (!rolls || rolls.length === 0) {
    return;
  }

  if (!allowFirstReroll) {
    const passes = firstRollPasses({
      firstTarget: rolls[0],
      bannerRateCumSum,
      bannerUnits,
      bannerRerollablePools,
    });
    if (passes.length === 0) {
      return;
    }

    const reportProgress = progressReporter(
      passes.reduce((sum, { mod }) => sum + (endSeed - startSeed) / mod, 0)
    );
    const found = (seed0) => {
      if (
        seed0 !== 0 &&
        check({
          seed: seed0,
          rolls,
          bannerRateCumSum,
          bannerUnits,
          bannerRerollablePools,
          allowFirstReroll: true,
        })
      ) {
        postMessage({ type: "seedFound", seed: seed0 });
      }
    };

    for (const pass of passes) {
      const { rateLo, rateHi, mod, residue } = pass;
      forEachResidue(startSeed, endSeed, mod, residue, (s) => {
        reportProgress();
        // s is the unit seed of the first roll, or its last reroll seed;
        // either way the last seed the first roll uses
        if (
          !secondRollCouldMatch(
            s,
            rolls,
            bannerRateCumSum,
            bannerUnits,
            bannerRerollablePools
          )
        ) {
          return;
        }
        const unitSeed =
          pass.rerolls === 0 ? s : replayFirstRollRerolls(pass, s, rolls[0]);
        if (unitSeed === null) {
          return;
        }
        const rSeed = prevSeed(unitSeed);
        const rScore = rSeed % 10000;
        if (rScore >= rateLo && rScore < rateHi) {
          found(prevSeed(rSeed));
        }
      });
    }
    return;
  }

  const oneTenthBlock = (endSeed - startSeed) / 10;
  let percentageSearched = 0;
  let outputBreakpoint = startSeed + oneTenthBlock;

  for (let seed = startSeed; seed < endSeed; seed++) {
    if (seed >= outputBreakpoint) {
      percentageSearched += 10;
      postMessage({
        type: "progress",
        percentageSearched: percentageSearched,
      });
      outputBreakpoint += oneTenthBlock;
    }
    const seedIsValid = check({
      seed,
      rolls,
      bannerRateCumSum,
      bannerUnits,
      bannerRerollablePools,
      allowFirstReroll: true,
    });
    if (seedIsValid) {
      postMessage({
        type: "seedFound",
        seed: seed,
      });
    }
  }
};

onmessage = (e) => {
  searchRange(e.data);
  postMessage({
    type: "progress",
    percentageSearched: 100,
  });
};
