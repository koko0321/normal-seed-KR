// bc-normal-seed-tracking/src/utils/seedFinder.tsx

import { BannerData } from "./bannerData";

type WorkerInitializationMessage = {
  // rolls를 단일 인덱스 배열에서 인덱스 배열의 배열로 변경
  rolls: number[][]; // (이전: rolls: number[])
  bannerRateCumSum: number[];
  bannerUnits: number[][];
  bannerRerollablePools: number[];
};

export const generateWorkerInitializationMessage = ({
  banner,
  rolls,
}: {
  banner: BannerData;
  rolls: string[];
}): WorkerInitializationMessage => {
  // To speed up computation, convert each unit to a numberic value
  const allUnits = banner.pools.flatMap((pool) => pool.units);
  const poolsNumeric = banner.pools.map((pool) =>
    pool.units.map((unit) => allUnits.indexOf(unit))
  );

  // --- 수정 부분 시작 ---
  // rollsNumeric는 각 롤이 가질 수 있는 모든 가능한 인덱스 목록을 포함합니다.
  const rollsNumeric: number[][] = rolls.map((roll) => {
    const indices: number[] = [];
    allUnits.forEach((unit, index) => {
      if (unit === roll) {
        indices.push(index);
      }
    });
    // rollsNumeric에 단위 인덱스가 아닌 인덱스 목록을 저장합니다.
    return indices;
  });
  // --- 이 부분 수정 끝 ---

  const rerollablePools = banner.pools.flatMap((pool, i) =>
    pool.reroll ? [i] : []
  );
  
  // Sanitize
  if (poolsNumeric.length !== banner.rateCumSum.length) {
    throw new Error(
      "Number of pools and number of cumulative rates do not match"
    );
  }
  
  // rollsNumeric에 빈 배열(롤이 풀에 없는 경우)이 없는지 확인
  if (rollsNumeric.some(indices => indices.length === 0)) {
     throw new Error("Rolls contains units not in the banner");
  }

  return {
    bannerRateCumSum: banner.rateCumSum,
    bannerUnits: poolsNumeric,
    bannerRerollablePools: rerollablePools,
    rolls: rollsNumeric,
  };
};