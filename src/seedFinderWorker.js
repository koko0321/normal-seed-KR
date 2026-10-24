const advanceSeed = (seed) => {
  seed ^= seed << 13;
  seed = seed >>> 0; // Convert to 32bit unsigned integer
  seed ^= seed >>> 17;
  seed ^= seed << 15;
  seed = seed >>> 0; // Convert to 32bit unsigned integer
  return seed;
};

const getRarity = ({ seed, rateCumSum }) => {
  const seedMod = seed % 10000;
  return rateCumSum.findIndex((sum) => seedMod < sum);
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
}) => {
  let lastRoll = -1;
  for (const userRoll of rolls) {
    seed = advanceSeed(seed);
    const rarity = getRarity({ seed, rateCumSum: bannerRateCumSum });

    seed = advanceSeed(seed);
    const [unitIndex, unitId] = getUnit({ seed, rarity, bannerUnits });
    // The pull before the first input is unknown, so the first input may
    // itself be a dupe reroll. Assume so if it doesn't match the distinct roll.
    if (lastRoll === -1 && userRoll !== unitId) {
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

const searchRange = (data) => {
  const {
    workerNumber,
    startSeed,
    endSeed,
    rolls,
    bannerRateCumSum,
    bannerUnits,
    bannerRerollablePools,
  } = data;

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
