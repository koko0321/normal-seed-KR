import styled from "@emotion/styled";
import { Typography, css } from "@mui/material";
import React from "react";
import { BannerData } from "./utils/bannerData";
import { advanceSeed, generateRollsLightweight } from "./utils/seed";

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

const FinderResultsRare = ({
  guaranteed,
  workerProgresses,
  seedsFound,
  isSearching,
  bannerData,
  numPulls,
  firstRoll,
}: {
  guaranteed: boolean;
  workerProgresses: number[];
  seedsFound: number[];
  isSearching: boolean;
  bannerData: BannerData;
  numPulls: number;
  firstRoll?: string;
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
              const [seedAfterRolls, nextRollIsReroll] =
                generateRollsLightweight(seed, numPulls, bannerData, firstRoll);
              return (
                <li>
                  <strong>시드 {i + 1}</strong>
                  <ul>
                    <li style={{ color: "#777777" }}>
                      {numPulls}회 뽑기 <strong>전</strong>: {seed}
                    </li>
                    <li style={guaranteed ? { color: "#777777" } : {}}>
                      {numPulls}회 뽑기 <strong>후</strong>:{" "}
                      {seedAfterRolls}
                    </li>
                    {guaranteed && (
                      <li>
                        확정 뽑기로 인한 <strong>열 이동 후</strong>: {advanceSeed(seedAfterRolls)}
                      </li>
                    )}
                    {!guaranteed && nextRollIsReroll && (
                      <li>
                        <strong>중요:</strong> 이 시드에서는 다음 뽑기가{" "}
                        <i>중복 열 이동</i>으로 감지되었습니다.
                        <ul>
                          <li>
                            <strong>후</strong> 시드를 그대로 사용하면 추적기가
                            이를 <i>반영하지 않으므로</i>, A열을 계속
                            진행하는 것처럼 잘못 표시됩니다.
                          </li>
                          <li>
                            대신 <strong>전</strong> 시드를 사용해서 시드를
                            직접 업데이트하세요.
                          </li>
                        </ul>
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

export default FinderResultsRare;
