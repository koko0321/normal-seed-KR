import styled from "@emotion/styled";
import { Typography } from "@mui/material";
import React from "react";
import { BannerData } from "./utils/bannerData";
import { generateRollsLightweight } from "./utils/seed";
import { getQueryParam } from "./utils/queryParams";
import { unitKo } from "./utils/i18n";

// Links to the tracker with the seed, its last roll (so 1A dupes show up) and
// the searched banner switched on
const getTrackUrl = (seed: number, lastCat: string, bannerShortName: string) => {
  const queryParams = new URLSearchParams(window.location.search);
  queryParams.set("seed", seed.toString());
  queryParams.set("lastCat", lastCat);
  queryParams.delete("selected");
  const banners = getQueryParam("banners").split(",");
  if (!banners.includes(bannerShortName)) {
    queryParams.set("banners", [...banners, bannerShortName].sort().join(","));
  }
  return `?${queryParams.toString()}#`;
};

const ProgressBarContainer = styled.div`
  width: 100%;
  height: 1em;
  border: 1px solid black;
  max-width: 40em;
`;

const ProgressBar = styled.div<{ percentage: number }>`
  width: ${(props) => props.percentage}%;
  height: 100%;
  background-color: green;
`;

const RowContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
`;

// Don't ask
const UlWithStrong = styled.ul`
  strong {
    font-weight: bold;
  }
`;

const FinderResults = ({
  workerProgresses,
  seedsFound,
  isSearching,
  bannerData,
  numPulls,
  firstRoll,
  lastRoll,
  onRetryWithoutFirst,
}: {
  workerProgresses: number[];
  seedsFound: number[];
  isSearching: boolean;
  bannerData: BannerData;
  numPulls: number;
  firstRoll?: string;
  lastRoll?: string;
  onRetryWithoutFirst?: () => void;
}) => {
  const totalCount = seedsFound.length;
  const displayedSeeds =
    seedsFound.length > 100 ? seedsFound.slice(0, 100) : seedsFound;

  return isSearching ? (
    <div>
      <Typography variant="body1">검색 중...</Typography>
      {workerProgresses.map((progress, i) => {
        return (
          <RowContainer key={i}>
            <Typography variant="body1" style={{ minWidth: "30px" }}>
              #{i + 1}
            </Typography>
            <ProgressBarContainer>
              <ProgressBar percentage={progress} />
            </ProgressBarContainer>
          </RowContainer>
        );
      })}
    </div>
  ) : (
    <div style={{ marginBottom: "24px" }}>
      {displayedSeeds.length > 0 ? (
        <>
          <Typography variant="body1" style={{ marginBottom: "8px" }}>
            입력한 {numPulls}회 뽑기 결과와 일치하는 시드를 총{" "}
            <strong>{totalCount}개</strong> 찾았습니다.
            {totalCount > displayedSeeds.length &&
              ` (상위 ${displayedSeeds.length}개 표시)`}
          </Typography>
          <UlWithStrong>
            {displayedSeeds.map((seed, i) => {
              const [seedAfterRolls, nextRollIsReroll, firstRollDupeOf] =
                generateRollsLightweight(seed, numPulls, bannerData, firstRoll);
              return (
                <li key={seed} style={{ marginBottom: "6px" }}>
                  <strong>후보 {i + 1}</strong>
                  <ul>
                    <li>
                      {numPulls}회 뽑기 <strong>전</strong> 시드 (검증용):{" "}
                      <a
                        href={getTrackUrl(
                          seed,
                          firstRollDupeOf,
                          bannerData.shortName
                        )}
                      >
                        {seed}
                      </a>
                    </li>
                    <li>
                      {numPulls}회 뽑기 <strong>후</strong> 시드 (현재 위치):{" "}
                      <a
                        href={getTrackUrl(
                          seedAfterRolls,
                          lastRoll || "",
                          bannerData.shortName
                        )}
                      >
                        {seedAfterRolls}
                      </a>
                    </li>
                    {nextRollIsReroll && (
                      <li>
                        <strong>참고:</strong> 이 시드에서는 다음 뽑기(1A)가{" "}
                        <i>중복 열 이동</i>입니다. <strong>후</strong> 시드
                        링크를 클릭하면 마지막 뽑기 아이템이 자동으로
                        반영됩니다.
                      </li>
                    )}
                  </ul>
                </li>
              );
            })}
          </UlWithStrong>
        </>
      ) : (
        <div>
          <Typography variant="body1" style={{ marginBottom: "6px" }}>
            일치하는 시드를 찾지 못했습니다. 입력한 내용이 다르거나, 첫 번째
            뽑기가 직전 뽑기와 중복(재추첨)되어 바뀐 결과일 수 있습니다.
          </Typography>
          {onRetryWithoutFirst && firstRoll && numPulls > 1 && (
            <button type="button" onClick={onRetryWithoutFirst}>
              맨 앞의 &ldquo;{unitKo(firstRoll)}&rdquo;을(를) 빼고 다시 검색하기
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default FinderResults;
