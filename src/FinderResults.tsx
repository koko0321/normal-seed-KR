import styled from "@emotion/styled";
import { Typography } from "@mui/material";
import React from "react";
import { BannerData } from "./utils/bannerData";
import { generateRollsLightweight } from "./utils/seed";
import { getQueryParam } from "./utils/queryParams";

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
}: {
  workerProgresses: number[];
  seedsFound: number[];
  isSearching: boolean;
  bannerData: BannerData;
  numPulls: number;
  firstRoll?: string;
  lastRoll?: string;
}) => {
  if (seedsFound.length > 200) {
    seedsFound = seedsFound.slice(0, 200);
  }
  return isSearching ? (
    <div>
      <Typography variant="body1">검색 중...</Typography>
      {workerProgresses.map((progress, i) => {
        return (
          <RowContainer>
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
      {seedsFound.length > 0 ? (
        <>
          <Typography variant="body1">
            참고:
            <ul>
              <li>
                여러 개의 시드가 발견되면 그중 하나만 정답입니다. 몇 번 더 뽑은
                뒤 열을 확인해서 어느 것이 맞는지 확인할 수 있습니다.
              </li>
              <li>
                중복(dupe) 때문에 발견된 시드가 모두 틀렸을 수도 있습니다.
                <ul>
                  <li>그런 경우 첫 번째 고양이를 빼고 다시 시도하세요.</li>
                </ul>
              </li>
            </ul>
            <br />
            입력한 뽑기 결과와 일치하는 시드를 총 {seedsFound.length}개
            찾았습니다.{" "}
          </Typography>
          <UlWithStrong>
            {seedsFound.map((seed, i) => {
              const [seedAfterRolls, nextRollIsReroll, firstRollDupeOf] =
                generateRollsLightweight(seed, numPulls, bannerData, firstRoll);
              return (
                <li>
                  <strong>시드 {i + 1}</strong>
                  <ul>
                    <li>
                      {numPulls}회 뽑기 <strong>전</strong>:{" "}
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
                      {numPulls}회 뽑기 <strong>후</strong>:{" "}
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
                        <strong>참고:</strong> 이 시드에서는 다음 뽑기가{" "}
                        <i>중복 열 이동</i>입니다.{" "}
                        <strong>후</strong> 링크에는 마지막 뽑기가 설정되어
                        있어서, 추적기의 1A에 중복 재추첨이 반영되어
                        표시됩니다.
                      </li>
                    )}
                  </ul>
                </li>
              );
            })}
          </UlWithStrong>
        </>
      ) : (
        <Typography variant="body1">
          시드를 찾지 못했습니다. 중복(dupe) 때문일 수 있습니다. 첫 번째
          고양이를 빼고 다시 시도해 주세요.
        </Typography>
      )}
    </div>
  );
};

export default FinderResults;
