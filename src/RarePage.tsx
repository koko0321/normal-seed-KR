import styled from "@emotion/styled";
import { Typography } from "@mui/material";
import React, { useState } from "react";
import { BannerData } from "./utils/bannerData";
import { generateWorkerInitializationMessage } from "./utils/seedFinder";
import { unitKo } from "./utils/i18n";
import { WorkerMessage } from "./FinderPage";
import FinderResultsRare from "./FinderResultsRare";
const GodfatExampleImage = require("./images/godfat.png");

const parseBannerData = (bannerData: string): BannerData => {
  // Some browsers don't copy over the newlines for some reason
  const lineSeparatedBannerData = bannerData
    .replace("Rare: ", "\nRare: ")
    .replace("Super: ", "\nSuper: ")
    .replace("Uber: ", "\nUber: ")
    .replace("Legendary: ", "\nLegendary: ");
  const splitBannerData = lineSeparatedBannerData
    .split("\n")
    .map((line) => line.trim());
  const relevantBannerData = splitBannerData.filter(
    (line) =>
      line.startsWith("Rare:") ||
      line.startsWith("Super:") ||
      line.startsWith("Uber:") ||
      line.startsWith("Legendary:")
  );

  const lineRegex =
    /^(?<rarity>[a-zA-Z]*): (?<rate>.*)% \(\d* cats\)(?<cats>.*)?$/;
  const relevantBannerDataParsed = relevantBannerData.map((line) => {
    const result = lineRegex.exec(line);
    return result?.groups as { rarity: string; rate: string; cats: string };
  });
  const bannerDataPoolsElements = relevantBannerDataParsed
    .filter(({ cats }) => Boolean(cats))
    .map(({ rarity, rate, cats }) => {
      // Turn rate into the number of slots in 10000
      const raritySlots = Math.round(parseFloat(rate) * 100);
      // Parse units
      const parsedUnits = cats
        .trim()
        .slice(1)
        .split(/, \d+/)
        .map((unit) => unit.trim());
      return {
        rate: raritySlots,
        units: parsedUnits,
        reroll: rarity === "Rare",
      };
    });

  // Create cumsum
  const rateCumSum = bannerDataPoolsElements
    .map((pool) => pool.rate)
    .map((rate, index, rates) =>
      rates.slice(0, index + 1).reduce((a, b) => a + b, 0)
    );

  return {
    name: "Custom",
    shortName: "c",
    rateCumSum,
    pools: bannerDataPoolsElements,
  };
};

const RarePage = () => {
  const [dataToParse, setDataToParse] = useState<string>("");
  const [bannerData, setBannerData] = useState<BannerData | null>(null);
  const hasBannerData = bannerData !== null;

  const [guaranteed, setGuaranteed] = useState<boolean>(false);
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

  const bannerPool = bannerData?.pools.flatMap((pool) => pool.units);

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
      banner: bannerData!,
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
      setSeedsFound([]);
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
        레어뽑기 시드 추적기 <a href="#credits">[크레딧]</a>
      </Typography>
      <Typography variant="h6">먼저 읽어주세요</Typography>
      <Typography variant="h5">
        이 도구를 사용하는 데 시드는 필요 없습니다.
        <br />
        이 도구는 시드를 찾기 위한 도구입니다.
      </Typography>
      <Typography variant="h6">배경</Typography>
      <ul>
        <li>
          Godfat의{" "}
          <a href="https://bc-seek.godfat.org/seek">시드 파인더</a>를 대신하는
          도구로, <strong>사용자의 브라우저 안에서</strong> 실행됩니다.
          <ul>
            <li>
              내 기기의 자원으로 실행되므로 대기열에서 기다릴 필요가 없습니다.
            </li>
            <li>
              대신 실행되는 동안 기기가 크게 느려집니다.
            </li>
          </ul>
        </li>
        <li>
          시드 찾기에서 가장 어려운 부분은 각 배너의 데이터와 유닛 목록을
          확보하고 최신으로 유지하는 것입니다.
          <ul>
            <li>
              구현을 쉽게 하기 위해, Godfat이 공들여 정리한 배너 확률과 유닛
              목록을 그대로 활용합니다.
            </li>
            <li>
              따라서 이 작업의 공로는 Godfat에게 있습니다. 이 사이트를 만드는
              일은 그에 비하면 아주 간단했습니다.
            </li>
          </ul>
        </li>
      </ul>
      <Typography variant="h6">사용 방법</Typography>
      <Typography variant="body1" style={{ marginBottom: "12px" }}>
        <ul>
          <li>배너에서 8~10회 뽑기를 합니다.</li>
          <li>
            Godfat의{" "}
            <a href="https://bc.godfat.org/?seed=1&details=true">
              시드 추적 웹사이트
            </a>
            로 이동해서 뽑은 배너를 선택합니다.
          </li>
          <li>
            <strong>이 단계에서는 시드가 필요 없습니다.</strong>
          </li>
          <li>
            <strong>
              아래 이미지에 시드가 보이지만 임의의 예시일 뿐입니다.{" "}
              <a href="https://bc.godfat.org/?seed=1&details=true">이 링크</a>
              로 이동해서 아래 안내를 따르세요.
            </strong>
          </li>
          <li>
            <img
              src={GodfatExampleImage}
              style={{ maxWidth: "100%", maxHeight: "400px" }}
            />
          </li>
          <li>
            <span style={{ border: "3px solid #22B14C" }}>뽑은 배너</span>를
            선택합니다.
          </li>
          <li>
            <span style={{ border: "3px solid red" }}>Details</span> 체크박스가
            꺼져 있다면 체크해서 자세한{" "}
            <span style={{ border: "3px solid #00A2E8" }}>확률 정보</span>를
            표시한 뒤, 그 내용을 전부 복사해서 아래 입력란에 붙여넣습니다.
          </li>
          <li>
            제대로 분석되면 평소처럼 유닛을 입력하고 시드를 추적할 수
            있습니다.
          </li>
        </ul>
      </Typography>
      <Typography variant="h6">데이터 분석</Typography>

      <textarea
        style={{ width: "100%", height: "10rem", resize: "none" }}
        placeholder={`복사한 정보를 여기에 붙여넣은 뒤 아래의 "분석" 버튼을 클릭하세요.`}
        onChange={(event) => setDataToParse(event.target.value)}
      />
      <div
        style={{ display: "flex", flexDirection: "row", marginBottom: "12px" }}
      >
        <button
          type="button"
          onClick={() => {
            try {
              const parsedData = parseBannerData(dataToParse);
              setBannerData(parsedData);
            } catch (e) {
              console.log(e);
              alert("배너 데이터를 제대로 분석하지 못했습니다 :(");
            }
          }}
        >
          분석
        </button>
        {hasBannerData && (
          <Typography variant="body1" style={{ marginLeft: "8px" }}>
            분석 완료! 아래로 스크롤하세요...
          </Typography>
        )}
      </div>

      {hasBannerData && (
        <>
          <Typography variant="h6">시드 찾기</Typography>
          <Typography variant="subtitle2">확정 뽑기인가요?</Typography>
          <label>
            <input
              type="checkbox"
              checked={guaranteed}
              onClick={(event) => {
                setGuaranteed((event.target as HTMLInputElement).checked);
              }}
            />
            &nbsp;<strong>울슈레 확정 이벤트</strong>에서 뽑았다면
            체크하세요.
          </label>
          <Typography variant="subtitle2">뽑기 결과</Typography>
          {guaranteed && (
            <div>
              확정 뽑기를 했으므로, <strong>확정 울슈레 이전에</strong> 받은
              고양이 10마리를 입력하세요.
            </div>
          )}
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
                  {bannerPool!.map((unit) => {
                    return (
                      <option key={unit} value={unit} selected={roll === unit}>
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
              <FinderResultsRare
                guaranteed={guaranteed}
                workerProgresses={progresses}
                seedsFound={seedsFound}
                isSearching={isSearching}
                bannerData={bannerData!}
                numPulls={userRolls.filter(Boolean).length}
                firstRoll={userRolls.find(Boolean) ?? undefined}
              />
            </>
          )}
        </>
      )}
    </>
  );
};

export default RarePage;
