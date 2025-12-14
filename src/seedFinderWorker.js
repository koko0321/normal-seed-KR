// bc-normal-seed-tracking/src/seedFinderWorker.js

const advanceSeed = (seed) => {
// ... (advanceSeed 함수는 동일)
  seed ^= seed << 13;
  seed = seed >>> 0; // Convert to 32bit unsigned integer
  seed ^= seed >>> 17;
  seed ^= seed << 15;
  seed = seed >>> 0; // Convert to 32bit unsigned integer
  return seed;
};

const getRarity = ({ seed, rateCumSum }) => {
// ... (getRarity 함수는 동일)
  const seedMod = seed % 10000;
  return rateCumSum.findIndex((sum) => seedMod < sum);
};

const getUnit = ({ seed, rarity, bannerUnits, removedIndex = -1 }) => {
// ... (getUnit 함수는 동일)
  const units = bannerUnits[rarity];
  let seedMod;
  if (removedIndex === -1) {
    seedMod = seed % units.length;
  } else {
    seedMod = seed % (units.length - 1);
    if (seedMod >= removedIndex) {
      seedMod++;
    }
  }
  return [seedMod, units[seedMod]];
};

const check = ({
  seed,
  rolls, // rolls는 이제 유닛 인덱스 목록의 배열입니다.
  bannerRateCumSum,
  bannerUnits,
  bannerRerollablePools,
}) => {
  let lastRoll = -1;
  // rolls의 각 항목은 인덱스 배열입니다.
  for (const possibleRolls of rolls) {
    seed = advanceSeed(seed);
    const rarity = getRarity({ seed, rateCumSum: bannerRateCumSum });

    let currentRollMatches = false; // 현재 롤이 가능한 인덱스 중 하나와 일치하는지 플래그

    seed = advanceSeed(seed);
    const [unitIndex, unitId] = getUnit({ seed, rarity, bannerUnits });
    
    if (unitId === lastRoll && bannerRerollablePools.includes(rarity)) {
      // 듀프 트랙 스위치 로직
      seed = advanceSeed(seed);
      const [_, rerolledUnitId] = getUnit({
        seed,
        rarity,
        bannerUnits,
        removedIndex: unitIndex,
      });
      
      // rerolledUnitId가 possibleRolls 배열에 포함되어 있는지 확인합니다.
      if (possibleRolls.includes(rerolledUnitId)) {
        currentRollMatches = true;
        lastRoll = rerolledUnitId;
      }
      
    } else {
      // 일반 롤 로직
      
      // unitId가 possibleRolls 배열에 포함되어 있는지 확인합니다.
      if (possibleRolls.includes(unitId)) {
        currentRollMatches = true;
        lastRoll = unitId;
      }
    }
    
    if (!currentRollMatches) {
      // 현재 롤이 가능한 인덱스 중 어떤 것과도 일치하지 않으면 이 시드는 유효하지 않습니다.
      return false;
    }
  }

  return true;
};

const searchRange = (data) => {
// ... (searchRange 함수는 동일)
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