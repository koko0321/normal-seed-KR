import React, { useEffect, useRef, useState } from "react";
import styled from "@emotion/styled";
import { Typography } from "@mui/material";
import { generateWorkerInitializationMessage } from "./utils/seedFinder";
import { unitKo } from "./utils/i18n";
import {
  BannerData,
  CatfruitBannerData,
  CatseyeBannerData,
  LuckyTicketBannerData,
  LuckyTicketGBannerData,
  NormalBannerData,
  NormalBannerPlusData,
} from "./utils/bannerData";
import FinderResults from "./FinderResults";

type FinderBanner =
  | "normal"
  | "normalPlus"
  | "catfruit"
  | "catseye"
  | "luckyTicket"
  | "luckyTicketG";

export type WorkerMessage = {
  type: "progress" | "seedFound";
  percentageSearched?: number;
  seed?: number;
};

const Box = styled.div`
  border: 1px solid #ccc;
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 10px;
  max-width: 560px;
  background: #fafafa;
`;

const ChipList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 36px;
  padding: 6px 8px;
  border: 1px solid #bbb;
  border-radius: 6px;
  background: #fff;
  align-items: center;
  max-width: 560px;
  margin-bottom: 8px;
`;

const RollChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border: 1px solid #888;
  border-radius: 14px;
  background: #f0f4ff;
  font-size: 0.85rem;
  button {
    border: none;
    background: none;
    cursor: pointer;
    padding: 0 2px;
    font-weight: bold;
    color: #555;
  }
`;

const UnitGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 4px;
  max-width: 560px;
  margin-bottom: 10px;
`;

const UnitButton = styled.button`
  text-align: left;
  padding: 6px 10px;
  border: 1px solid #bbb;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  &:hover {
    background: #eef4ff;
    border-color: #1976d2;
  }
`;

const BANNER_MAP: Record<FinderBanner, BannerData> = {
  normal: NormalBannerData,
  normalPlus: NormalBannerPlusData,
  catfruit: CatfruitBannerData,
  catseye: CatseyeBannerData,
  luckyTicket: LuckyTicketBannerData,
  luckyTicketG: LuckyTicketGBannerData,
};

const FinderPage = () => {
  useEffect(() => {
    document.title = "냥코 뽑기 시드 추적기";
  }, []);

  const [banner, setBanner] = useState<FinderBanner>("normal");
  const [selectedRolls, setSelectedRolls] = useState<string[]>([]);
  const [searchFilter, setSearchFilter] = useState("");

  const bannerObj = BANNER_MAP[banner];

  const [progresses, setProgresses] = useState<number[]>([]);
  const [seedsFound, setSeedsFound] = useState<number[]>([]);
  const [searchedConfig, setSearchedConfig] = useState<{
    bannerData: BannerData;
    rolls: string[];
  } | null>(null);

  const workersRef = useRef<Worker[]>([]);

  const isSearching = progresses.length > 0 && progresses.some((p) => p < 100);
  const startedAndFinishedSearching = progresses.length > 0 && !isSearching;

  const stopWorkers = () => {
    workersRef.current.forEach((w) => w.terminate());
    workersRef.current = [];
  };

  useEffect(() => () => stopWorkers(), []);

  const handleBannerChange = (nextBanner: FinderBanner) => {
    stopWorkers();
    setProgresses([]);
    setSeedsFound([]);
    setSearchedConfig(null);
    setSelectedRolls([]);
    setBanner(nextBanner);
  };

  const addRoll = (unit: string) => {
    if (selectedRolls.length >= 20) {
      return;
    }
    setSelectedRolls((prev) => [...prev, unit]);
  };

  const removeRollAt = (idx: number) => {
    setSelectedRolls((prev) => prev.filter((_, i) => i !== idx));
  };

  const runSearch = (rollsToSearch: string[]) => {
    if (rollsToSearch.length === 0) return;
    stopWorkers();

    if (!window.Worker) {
      alert("죄송합니다. 이 브라우저는 웹 워커를 지원하지 않습니다.");
      return;
    }

    const partialInitialMessage = generateWorkerInitializationMessage({
      banner: bannerObj,
      rolls: rollsToSearch,
    });

    setSearchedConfig({
      bannerData: bannerObj,
      rolls: rollsToSearch,
    });
    setSeedsFound([]);

    const numWorkers = Math.min(
      16,
      Math.max(4, navigator.hardwareConcurrency || 8)
    );
    const totalSeeds = 2 ** 32;
    const chunkSize = Math.ceil(totalSeeds / numWorkers);

    setProgresses(Array(numWorkers).fill(0));
    const newWorkers: Worker[] = [];

    for (let workerNumber = 0; workerNumber < numWorkers; workerNumber++) {
      const startSeed = Math.max(1, workerNumber * chunkSize);
      const endSeed = Math.min(totalSeeds, (workerNumber + 1) * chunkSize);
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
          setProgresses((prev) => [
            ...prev.slice(0, workerNumber),
            event.data.percentageSearched!,
            ...prev.slice(workerNumber + 1),
          ]);
        } else if (messageType === "seedFound") {
          setSeedsFound((prevSeedsFound) =>
            [...prevSeedsFound, event.data.seed!].sort((a, b) => a - b)
          );
        }
      };
      worker.postMessage(initialMessage);
      newWorkers.push(worker);
    }
    workersRef.current = newWorkers;
  };

  // Deduplicated unit list for the button picker
  const unitEntries: string[] = [];
  const seenUnits = new Set<string>();
  bannerObj.pools.forEach((pool) => {
    pool.units.forEach((u) => {
      if (!seenUnits.has(u)) {
        seenUnits.add(u);
        unitEntries.push(u);
      }
    });
  });

  const filteredUnits = unitEntries.filter((unit) => {
    if (!searchFilter.trim()) {
      return true;
    }
    const q = searchFilter.trim().toLowerCase();
    return (
      unitKo(unit).toLowerCase().includes(q) || unit.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <Typography variant="h4">
        냥코 뽑기 시드 추적기 <a href="#credits">[크레딧]</a>
      </Typography>
      <div style={{ display: "flex", gap: "6px", margin: "4px 0" }}>
        <button type="button" onClick={() => (window.location.hash = "#")}>
          냥코 뽑기 배열로 이동
        </button>
        <button
          type="button"
          onClick={() => (window.location.hash = "#/event-finder")}
        >
          이벤트 뽑기 시드 찾기로 이동
        </button>
      </div>
      <Typography variant="h6">이 도구에 대하여</Typography>
      <Typography variant="body1">
        <ul style={{ marginTop: 0 }}>
          <li>
            냥코 뽑기·개다래·캣츠아이·럭키 티켓에서 뽑은 결과를 순서대로 선택해
            현재 시드를 찾는 도구입니다.
          </li>
          <li>
            보통 <strong>단발 7~10회 정도</strong>의 결과를 순서대로 입력하면
            시드를 하나로 특정할 수 있습니다.
          </li>
          <li>
            이미 시드를 찾으셨나요? <a href="#">여기를 클릭하세요.</a>
          </li>
        </ul>
      </Typography>

      <Typography variant="h6">1. 대상 배너</Typography>
      <div style={{ marginBottom: "10px" }}>
        <select
          id="banner"
          value={banner}
          onChange={(e) => handleBannerChange(e.target.value as FinderBanner)}
        >
          <option value="normal">냥코 뽑기</option>
          <option value="normalPlus">냥코 뽑기+ (고양이 초인 포함)</option>
          <option value="catfruit">개다래 뽑기</option>
          <option value="catseye">캣츠아이 뽑기</option>
          <option value="luckyTicket">럭키 티켓</option>
          <option value="luckyTicketG">럭키 티켓 G</option>
        </select>
      </div>

      <Typography variant="h6">2. 뽑은 결과 (단발 7~10회 권장)</Typography>
      <ChipList>
        {selectedRolls.length === 0 ? (
          <span style={{ color: "#777" }}>
            아래 목록에서 뽑은 아이템/캐릭터를 누르면 순서대로 추가됩니다.
          </span>
        ) : (
          selectedRolls.map((unit, idx) => (
            <RollChip key={idx}>
              <span>
                {idx + 1}. {unitKo(unit)}
              </span>
              <button
                type="button"
                title="삭제"
                onClick={() => removeRollAt(idx)}
              >
                ×
              </button>
            </RollChip>
          ))
        )}
      </ChipList>
      {selectedRolls.length > 0 && (
        <div style={{ marginBottom: "8px", display: "flex", gap: "6px" }}>
          <button
            type="button"
            onClick={() =>
              setSelectedRolls((prev) => prev.slice(0, prev.length - 1))
            }
          >
            마지막 지우기
          </button>
          <button type="button" onClick={() => setSelectedRolls([])}>
            전체 초기화
          </button>
        </div>
      )}

      <Box>
        <div style={{ marginBottom: "8px" }}>
          <input
            type="text"
            placeholder="아이템/캐릭터 이름으로 검색"
            style={{ width: "100%", maxWidth: "300px", padding: "4px 6px" }}
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
          />
        </div>
        <UnitGrid>
          {filteredUnits.map((unit) => (
            <UnitButton
              key={unit}
              type="button"
              onClick={() => addRoll(unit)}
            >
              {unitKo(unit)}
            </UnitButton>
          ))}
        </UnitGrid>
      </Box>

      <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
        <button
          type="button"
          onClick={() => runSearch(selectedRolls)}
          disabled={selectedRolls.length === 0 || isSearching}
          style={{ padding: "6px 16px", fontWeight: "bold" }}
        >
          시드 검색 시작
        </button>
        {isSearching && (
          <button
            type="button"
            onClick={() => {
              stopWorkers();
              setProgresses([]);
            }}
          >
            검색 중지
          </button>
        )}
      </div>

      {(isSearching || startedAndFinishedSearching) && searchedConfig && (
        <>
          <Typography variant="h6">검색 결과</Typography>
          <FinderResults
            workerProgresses={progresses}
            seedsFound={seedsFound}
            isSearching={isSearching}
            bannerData={searchedConfig.bannerData}
            numPulls={searchedConfig.rolls.length}
            firstRoll={searchedConfig.rolls[0]}
            lastRoll={searchedConfig.rolls[searchedConfig.rolls.length - 1]}
            onRetryWithoutFirst={
              searchedConfig.rolls.length > 1
                ? () => {
                    const nextRolls = searchedConfig.rolls.slice(1);
                    setSelectedRolls(nextRolls);
                    runSearch(nextRolls);
                  }
                : undefined
            }
          />
        </>
      )}
    </>
  );
};

export default FinderPage;
