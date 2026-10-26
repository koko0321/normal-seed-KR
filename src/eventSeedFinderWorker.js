const advanceSeed = (seed) => {
  seed ^= seed << 13;
  seed = seed >>> 0;
  seed ^= seed >>> 17;
  seed ^= seed << 15;
  seed = seed >>> 0;
  return seed;
};

// Inverse of 32-bit xorshift (x ^= x << 13; x ^= x >>> 17; x ^= x << 15)
const prevSeed = (seed) => {
  seed = (seed ^ (seed << 15) ^ (seed << 30)) >>> 0;
  seed = (seed ^ (seed >>> 17)) >>> 0;
  seed = (seed ^ (seed << 13) ^ (seed << 26)) >>> 0;
  return seed;
};

const pickPool = (raritySeed, rateCumSum, mod = 10000) => {
  const score = raritySeed % mod;
  for (let i = 0; i < rateCumSum.length; i++) {
    if (score < rateCumSum[i]) {
      return i;
    }
  }
  return rateCumSum.length - 1;
};

// Called for a large share of all seeds, so it takes the shared config object
// as is rather than a fresh object per call
const checkSeed = (initialSeed, config, allowFirstReroll) => {
  const {
    rolls,
    poolRateCumSum,
    poolUnits,
    poolReroll,
    guarRateCumSum,
    guarTotalRate,
    guarPoolUnits,
    guaranteedStep,
    medamaRate,
    medamaGuaranteedSteps,
    medamaId,
    initGuarLeft,
    initMedamaStock,
    initMedamaLeft,
  } = config;
  let seed = initialSeed;
  let lastRoll = -1;
  let guarLeft = initGuarLeft;
  let medamaStock = initMedamaStock;
  let medamaLeft = initMedamaLeft;

  for (let step = 0; step < rolls.length; step++) {
    const target = rolls[step];

    // 1. Medama (special item) active
    if (medamaStock > 0) {
      if (medamaLeft === 1) {
        if (target !== medamaId) {
          return -1;
        }
        medamaStock--;
        medamaLeft = medamaGuaranteedSteps;
        continue;
      }
      seed = advanceSeed(seed);
      if (medamaLeft > 0) {
        medamaLeft--;
      }
      if (seed % 10000 < medamaRate) {
        if (target !== medamaId) {
          return -1;
        }
        medamaStock--;
        continue;
      }
    } else if (guarLeft === 1 && guarTotalRate > 0) {
      // 2. Guaranteed character step
      seed = advanceSeed(seed);
      const gPool = pickPool(seed, guarRateCumSum, guarTotalRate);
      seed = advanceSeed(seed);
      const gUnits = guarPoolUnits[gPool];
      const unitId = gUnits[seed % gUnits.length];
      if (unitId !== target) {
        return -1;
      }
      guarLeft = guaranteedStep;
      lastRoll = unitId;
      continue;
    } else if (guarLeft > 1) {
      guarLeft--;
    }

    // 3. Regular roll (rarity seed + unit seed, plus optional dupe reroll)
    seed = advanceSeed(seed);
    const poolIdx = pickPool(seed, poolRateCumSum, 10000);
    const units = poolUnits[poolIdx];
    seed = advanceSeed(seed);
    let unitId = units[seed % units.length];

    if (
      allowFirstReroll &&
      lastRoll === -1 &&
      target !== unitId &&
      poolReroll[poolIdx]
    ) {
      lastRoll = unitId;
    }

    if (unitId === lastRoll && poolReroll[poolIdx] && units.length > 1) {
      const remaining = units.slice();
      let rerolled = unitId;
      while (rerolled === unitId && remaining.length > 1) {
        remaining.splice(remaining.indexOf(unitId), 1);
        seed = advanceSeed(seed);
        rerolled = remaining[seed % remaining.length];
      }
      unitId = rerolled;
    }

    if (unitId !== target) {
      return -1;
    }
    lastRoll = unitId;
  }

  return seed;
};

onmessage = (e) => {
  const {
    startSeed,
    endSeed,
    gacha,
    rolls,
    initialState,
    allowFirstReroll = false,
  } = e.data;

  const MEDAMA_UNIT = "目玉アイテム";
  const allNames = [
    MEDAMA_UNIT,
    ...new Set(gacha.pools.flatMap((p) => p.units)),
  ];
  const nameToId = new Map(allNames.map((name, i) => [name, i]));
  const medamaId = nameToId.get(MEDAMA_UNIT);

  const poolRateCumSum = [];
  const poolRateBounds = [];
  let sum = 0;
  for (const p of gacha.pools) {
    poolRateBounds.push([sum, sum + p.rate]);
    sum += p.rate;
    poolRateCumSum.push(sum);
  }
  const poolUnits = gacha.pools.map((p) =>
    p.units.map((u) => nameToId.get(u))
  );
  const poolReroll = gacha.pools.map((p) => !!p.reroll);

  const guarRateCumSum = [];
  const guarRateBounds = [];
  const guarPoolUnits = [];
  let guarTotalRate = 0;
  if (gacha.guaranteed) {
    for (const pIdx of gacha.guaranteed.pools) {
      const r = gacha.pools[pIdx].rate;
      guarRateBounds.push([guarTotalRate, guarTotalRate + r]);
      guarTotalRate += r;
      guarRateCumSum.push(guarTotalRate);
      guarPoolUnits.push(poolUnits[pIdx]);
    }
  }

  const targetRolls = rolls.map((r) =>
    nameToId.has(r) ? nameToId.get(r) : -999
  );

  const config = {
    rolls: targetRolls,
    poolRateCumSum,
    poolUnits,
    poolReroll,
    guarRateCumSum,
    guarTotalRate,
    guarPoolUnits,
    guaranteedStep: gacha.guaranteed ? gacha.guaranteed.step : 10,
    medamaRate: gacha.medama ? gacha.medama.rate : 0,
    medamaGuaranteedSteps: gacha.medama ? gacha.medama.guaranteedSteps : 30,
    medamaId,
    initGuarLeft: initialState.guaranteedLeft || 0,
    initMedamaStock: initialState.medamaStock || 0,
    initMedamaLeft: initialState.medamaLeft || 0,
    allowFirstReroll,
  };

  const matches = [];
  let matchCount = 0;
  const addMatch = (seedBefore, seedAfter) => {
    matchCount++;
    if (matches.length < 200) {
      matches.push({ seedBefore, seedAfter });
    }
  };

  // Determine the first seed-consuming roll so we can jump directly across
  // matching modulo residues when allowFirstReroll is false.
  let firstActiveIdx = 0;
  let firstMedamaStock = config.initMedamaStock;
  let firstMedamaLeft = config.initMedamaLeft;
  if (firstMedamaStock > 0 && firstMedamaLeft === 1) {
    if (targetRolls[0] !== medamaId) {
      postMessage({
        type: "complete",
        percentageSearched: 100,
        matches,
        matchCount,
      });
      return;
    }
    firstActiveIdx = 1;
    firstMedamaStock--;
    firstMedamaLeft = config.medamaGuaranteedSteps;
  }

  const canFastJump =
    !allowFirstReroll &&
    firstActiveIdx < targetRolls.length &&
    !(firstMedamaStock > 0 && firstMedamaLeft === 1);

  if (canFastJump) {
    const firstTarget = targetRolls[firstActiveIdx];
    const medamaActiveOnFirst = firstMedamaStock > 0;
    const guarActiveOnFirst =
      !medamaActiveOnFirst &&
      config.initGuarLeft === 1 &&
      guarTotalRate > 0;

    // Case A: First active roll is a natural medama (s1 % 10000 < medamaRate)
    if (medamaActiveOnFirst && firstTarget === medamaId) {
      const rate = config.medamaRate;
      const firstBlock = Math.floor(startSeed / 10000) * 10000;
      const totalBlocks = Math.max(1, Math.ceil((endSeed - firstBlock) / 10000));
      const reportStep = Math.max(1, Math.floor(totalBlocks / 10));
      let blocksDone = 0;
      let nextReport = reportStep;
      let pct = 0;

      for (let base = firstBlock; base < endSeed; base += 10000) {
        blocksDone++;
        if (blocksDone >= nextReport) {
          pct = Math.min(90, pct + 10);
          postMessage({ type: "progress", percentageSearched: pct });
          nextReport += reportStep;
        }
        const lo = Math.max(startSeed, base);
        const hi = Math.min(endSeed, base + rate);
        for (let s1 = lo; s1 < hi; s1++) {
          const seed0 = prevSeed(s1);
          if (seed0 === 0) continue;
          // A medama keeps the (unknown) last roll, so the first regular roll
          // after it may still be a dupe reroll
          const seedAfter = checkSeed(seed0, config, true);
          if (seedAfter !== -1) {
            addMatch(seed0, seedAfter);
          }
        }
      }
      postMessage({
        type: "complete",
        percentageSearched: 100,
        matches,
        matchCount,
      });
      return;
    }

    // Case B: First active roll is a character/item from a pool
    const activeUnits = guarActiveOnFirst ? guarPoolUnits : poolUnits;
    const activeBounds = guarActiveOnFirst ? guarRateBounds : poolRateBounds;
    const activeMod = guarActiveOnFirst ? guarTotalRate : 10000;

    // The ways the first roll can give its target, each as a residue class of
    // one seed so the search can jump straight across it:
    // - rerolls = 0: the unit seed picks the target
    // - rerolls = L: the pull before is unknown, so the unit seed may have
    //   picked a dupe of it, rerolled L times in a row (the pool must have L
    //   copies of that unit) until the last reroll seed picked the target.
    //   With L units removed, the target's position is between its own and L
    //   lower.
    // A guaranteed character is never rerolled.
    const passes = [];
    for (let p = 0; p < activeUnits.length; p++) {
      const units = activeUnits[p];
      const slots = [];
      units.forEach((unit, slot) => unit === firstTarget && slots.push(slot));
      const [rateLo, rateHi] = activeBounds[p];
      if (rateHi <= rateLo || slots.length === 0) {
        continue;
      }
      const base = { units, rateLo, rateHi };
      slots.forEach((slot) =>
        passes.push({ ...base, rerolls: 0, mod: units.length, residue: slot })
      );
      if (guarActiveOnFirst || !poolReroll[p]) {
        continue;
      }
      const copies = new Map();
      units.forEach((unit) => copies.set(unit, (copies.get(unit) || 0) + 1));
      copies.delete(firstTarget);
      const maxRerolls = Math.max(0, ...copies.values());
      // Copies of the unit in each slot (0 for the target), and a reusable
      // mask of removed slots while replaying
      const copiesBySlot = units.map((unit) => copies.get(unit) || 0);
      const removedMask = new Array(units.length).fill(false);
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
          passes.push({
            ...base,
            rerolls,
            mod,
            residue,
            copiesBySlot,
            removedMask,
          })
        );
      }
    }

    // For a reroll pass: given the last reroll seed, walks back to the unit
    // seed and replays the reroll chain the same way checkSeed does (the first
    // remaining copy of the rerolled unit is removed each time). Returns the
    // unit seed if the chain gives the target, otherwise null. Runs for a
    // large share of all seeds, so it avoids allocating.
    const replayFirstRollRerolls = (pass, lastRerollSeed) => {
      const { units, rerolls, copiesBySlot, removedMask } = pass;
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
      removedMask.fill(false);
      let seed = unitSeed;
      let result = unitSeed;
      for (let j = 0; j < rerolls; j++) {
        // Remove the first remaining copy of the rolled unit
        for (let i = 0; i < units.length; i++) {
          if (!removedMask[i] && units[i] === rolled) {
            removedMask[i] = true;
            break;
          }
        }
        // Pick the (seed % remaining)-th remaining unit
        seed = advanceSeed(seed);
        let n = seed % (units.length - j - 1);
        let picked = -1;
        for (let i = 0; i < units.length; i++) {
          if (!removedMask[i] && n-- === 0) {
            picked = units[i];
            break;
          }
        }
        if (picked !== (j === rerolls - 1 ? firstTarget : rolled)) {
          result = null;
          break;
        }
      }
      return result;
    };

    if (passes.length === 0) {
      postMessage({
        type: "complete",
        percentageSearched: 100,
        matches,
        matchCount,
      });
      return;
    }

    const totalSteps = passes.reduce(
      (sum, { mod }) => sum + (endSeed - startSeed) / mod,
      0
    );
    const reportEvery = Math.max(1, Math.floor(totalSteps / 10));
    let steps = 0;
    let pct = 0;

    // From the rarity seed of the first regular roll back to the starting
    // seed (past the medama check seed when there is one)
    const fromRaritySeed = (rSeed) => {
      if (!medamaActiveOnFirst) {
        return prevSeed(rSeed);
      }
      const mSeed = prevSeed(rSeed);
      return mSeed % 10000 < config.medamaRate ? 0 : prevSeed(mSeed);
    };
    const tryRaritySeed = (rSeed, rateLo, rateHi, lastFirstRollSeed) => {
      const rScore = rSeed % activeMod;
      if (rScore < rateLo || rScore >= rateHi) {
        return;
      }
      // null when the caller already ran the second-roll filter
      if (lastFirstRollSeed !== null && !secondRollCouldMatch(lastFirstRollSeed)) {
        return;
      }
      const seed0 = fromRaritySeed(rSeed);
      if (seed0 === 0) {
        return;
      }
      const seedAfter = checkSeed(seed0, config, !guarActiveOnFirst);
      if (seedAfter !== -1) {
        addMatch(seed0, seedAfter);
      }
    };

    // Cheap pre-filter before checkSeed: given the last seed of the first
    // regular roll, the second roll must be able to give the second target.
    // The state after the first roll is the same for every candidate.
    const secondTarget = targetRolls[firstActiveIdx + 1];
    const medamaLeftAfterFirst =
      medamaActiveOnFirst && firstMedamaLeft > 0 ? firstMedamaLeft - 1 : 0;
    const guarLeftAfterFirst = guarActiveOnFirst
      ? config.guaranteedStep
      : config.initGuarLeft > 1
      ? config.initGuarLeft - 1
      : config.initGuarLeft;
    const secondRollCouldMatch = (seed) => {
      if (secondTarget === undefined) {
        return true;
      }
      if (medamaActiveOnFirst) {
        if (medamaLeftAfterFirst === 1) {
          return secondTarget === medamaId;
        }
        seed = advanceSeed(seed);
        if (seed % 10000 < config.medamaRate) {
          return secondTarget === medamaId;
        }
        if (secondTarget === medamaId) {
          return false;
        }
      } else if (guarLeftAfterFirst === 1 && guarTotalRate > 0) {
        seed = advanceSeed(seed);
        const units = guarPoolUnits[pickPool(seed, guarRateCumSum, guarTotalRate)];
        return units[advanceSeed(seed) % units.length] === secondTarget;
      }
      seed = advanceSeed(seed);
      const pool = pickPool(seed, poolRateCumSum, 10000);
      const units = poolUnits[pool];
      const unit = units[advanceSeed(seed) % units.length];
      return (
        unit === secondTarget || (unit === firstTarget && poolReroll[pool])
      );
    };

    for (const pass of passes) {
      const { rateLo, rateHi, mod, residue } = pass;
      const rem = startSeed % mod;
      const first =
        startSeed + (residue >= rem ? residue - rem : mod - (rem - residue));
      for (let s = first; s < endSeed; s += mod) {
        steps++;
        if (steps % reportEvery === 0 && pct < 90) {
          pct += 10;
          postMessage({ type: "progress", percentageSearched: pct });
        }
        // s is the unit seed of the first regular roll, or its last reroll
        // seed; either way the last seed the first roll uses. Cheapest
        // checks first: replaying rerolls costs more than the second-roll
        // filter, which costs more than the rarity check.
        if (pass.rerolls === 0) {
          tryRaritySeed(prevSeed(s), rateLo, rateHi, s);
          continue;
        }
        if (!secondRollCouldMatch(s)) {
          continue;
        }
        const unitSeed = replayFirstRollRerolls(pass, s);
        if (unitSeed !== null) {
          tryRaritySeed(prevSeed(unitSeed), rateLo, rateHi, null);
        }
      }
    }

    postMessage({
      type: "complete",
      percentageSearched: 100,
      matches,
      matchCount,
    });
    return;
  }

  // Fallback full scan (used when checking if the first roll was a dupe reroll)
  const oneTenthBlock = (endSeed - startSeed) / 10;
  let percentageSearched = 0;
  let outputBreakpoint = startSeed + oneTenthBlock;

  for (let seed = startSeed; seed < endSeed; seed++) {
    if (seed >= outputBreakpoint) {
      percentageSearched += 10;
      postMessage({
        type: "progress",
        percentageSearched,
      });
      outputBreakpoint += oneTenthBlock;
    }
    const seedAfter = checkSeed(seed, config, config.allowFirstReroll);
    if (seedAfter !== -1) {
      addMatch(seed, seedAfter);
    }
  }

  postMessage({
    type: "complete",
    percentageSearched: 100,
    matches,
    matchCount,
  });
};
