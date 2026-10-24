import React, { useState } from "react";
import { Typography } from "@mui/material";
import { generateWorkerInitializationMessage } from "./utils/seedFinder";
import { unitKo } from "./utils/i18n";
import {
  LuckyTicketBannerData,
  NormalBannerData,
  NormalBannerPlusData,
} from "./utils/bannerData";
import FinderResults from "./FinderResults";

type FinderBanner = "normal" | "normalPlus" | "luckyTicket";

export type WorkerMessage = {
  type: "progress" | "seedFound";
  percentageSearched?: number;
  seed?: number;
};

const FinderPage = () => {
  // We'll just put all our controls here because we're lazy
  const [banner, setBanner] = useState<FinderBanner>("normal");
  const [userRolls, setUserRolls] = useState<(string | null)[]>(
    Array(10).fill(null)
  );
  const setUserRoll = (index: number, unit: string | null) => {
    if (unit === "null") {
      unit = null;
    }
    setUserRolls((prevRolls) => [
      ...prevRolls.slice(0, index),
      unit,
      ...prevRolls.slice(index + 1),
    ]);
  };

  const bannerObj = {
    normal: NormalBannerData,
    normalPlus: NormalBannerPlusData,
    luckyTicket: LuckyTicketBannerData,
  }[banner];
  const bannerPool = bannerObj.pools.flatMap((pool) => pool.units);

  const [progresses, setProgresses] = useState<number[]>([]);
  const setWorkerProgress = (worker: number, progress: number) => {
    setProgresses((prevProgresses) => [
      ...prevProgresses.slice(0, worker),
      progress,
      ...prevProgresses.slice(worker + 1),
    ]);
  };
  const [seedsFound, setSeedsFound] = useState<number[]>([]);
  const isSearching = progresses.length > 0 && progresses.some((p) => p < 100);
  const startedAndFinishedSearching = progresses.length > 0 && !isSearching;

  const onClick = () => {
    const partialInitialMessage = generateWorkerInitializationMessage({
      banner: bannerObj,
      rolls: userRolls.filter(Boolean) as string[],
    });

    if (window.Worker) {
      const chunkSize = 100_000_000;
      const startingSeed = 1;
      const endingSeedPlusOne = 2 ** 32;
      const chunks = [];
      for (let start = 0; start <= endingSeedPlusOne; start += chunkSize) {
        chunks.push([
          Math.max(startingSeed, start),
          Math.min(endingSeedPlusOne, start + chunkSize),
        ]);
      }

      const workers = [];
      setProgresses(chunks.map(() => 0));
      for (const [workerNumber, [startSeed, endSeed]] of chunks.entries()) {
        const initialMessage = {
          ...partialInitialMessage,
          workerNumber,
          startSeed,
          endSeed,
        };
        const worker = new Worker(
          new URL("./seedFinderWorker.js", import.meta.url)
        );
        worker.onmessage = (event: { data: WorkerMessage }) => {
          const messageType = event.data.type;
          if (messageType === "progress") {
            setWorkerProgress(workerNumber, event.data.percentageSearched!);
          } else if (messageType === "seedFound") {
            setSeedsFound((prevSeedsFound) => [
              ...prevSeedsFound,
              event.data.seed!,
            ]);
          }
        };
        worker.postMessage(initialMessage);
        workers.push(worker);
      }
    } else {
      alert("죄송합니다. 이 브라우저는 웹 워커를 지원하지 않습니다.");
    }
  };
  return (
    <>
      <Typography variant="h4">
        냥코 뽑기 시드 추적기 <a href="#credits">[크레딧]</a>
      </Typography>
      <Typography variant="h6">이 도구에 대하여</Typography>
      <Typography variant="body1">
        <ul style={{ marginTop: 0 }}>
          <li>입력한 뽑기 결과와 일치하는 시드를 찾아주는 도구입니다.</li>
          <li>
            검색은 <strong>브라우저 내부에서</strong> 진행되므로 사용자의 기기
            자원을 소모합니다.
            <ul>
              <li>검색이 진행되는 동안 기기가 느려질 수 있습니다.</li>
            </ul>
          </li>
          <li>
            레어뽑기 시드와 마찬가지로, 신뢰할 수 있는 결과를 얻으려면 최소
            8~10회의 뽑기 정보가 필요합니다.
          </li>
          <li>
            럭키 티켓으로도 시드를 찾을 수 있습니다. 같은 이름의 아이템이 여러
            개 있다면 아무거나 선택하면 됩니다.
          </li>
          <li>
            이미 시드를 찾으셨나요? <a href="#">여기를 클릭하세요.</a>
          </li>
        </ul>
      </Typography>
      <Typography variant="h6">설정</Typography>
      <Typography variant="subtitle2">배너</Typography>
      <div style={{ marginBottom: "4px" }}>
        <select
          id="banner"
          onChange={(e) => {
            setBanner(e.target.value as FinderBanner);
            setUserRolls(Array(10).fill(null));
          }}
        >
          <option value="normal">냥코 뽑기</option>
          <option value="normalPlus">냥코 뽑기+ (고양이 초인 포함)</option>
          <option value="luckyTicket">럭키 티켓</option>
        </select>
      </div>
      <Typography variant="subtitle2">뽑기 결과</Typography>
      <div
        style={{
          marginBottom: "4px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {userRolls.map((roll, i) => {
          return (
            <select
              onChange={(e) => setUserRoll(i, e.target.value)}
              style={{
                maxWidth: "300px",
                marginBottom: "4px",
              }}
            >
              <option value="null" selected={roll === null}>
                -- {i + 1}번째 뽑기 선택 --
              </option>
              {bannerPool.map((unit, j) => {
                return (
                  // Lucky Ticket pools repeat names, so key by position
                  <option key={j} value={unit} selected={roll === unit}>
                    {unitKo(unit)}
                  </option>
                );
              })}
            </select>
          );
        })}
      </div>
      <Typography variant="subtitle2">시작</Typography>
      <button
        type="button"
        onClick={onClick}
        disabled={userRolls.every((roll) => roll === null) || isSearching}
      >
        검색 시작
      </button>
      {(isSearching || startedAndFinishedSearching) && (
        <>
          <Typography variant="h6">결과</Typography>
          <FinderResults
            workerProgresses={progresses}
            seedsFound={seedsFound}
            isSearching={isSearching}
            bannerData={bannerObj}
            numPulls={userRolls.filter(Boolean).length}
            firstRoll={userRolls.find(Boolean) ?? undefined}
            lastRoll={userRolls.filter(Boolean).slice(-1)[0] ?? undefined}
          />
        </>
      )}
    </>
  );
};

export default FinderPage;
