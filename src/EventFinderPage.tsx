import React, { useEffect, useRef, useState } from "react";
import styled from "@emotion/styled";
import { Typography } from "@mui/material";
import { getQueryParam } from "./utils/queryParams";
import { EVENT_GACHAS, EventGacha, MEDAMA } from "./utils/eventData";
import { GachaState, SeedList, singlePull } from "./utils/eventEngine";
import { eventKo, unitKo } from "./utils/i18n";

type FoundMatch = {
  seedBefore: number;
  seedAfter: number;
};

type WorkerEventMessage = {
  type: "progress" | "complete";
  percentageSearched?: number;
  matches?: FoundMatch[];
  matchCount?: number;
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

const simulateRolls = (
  gacha: EventGacha,
  initialSeed: number,
  rolls: string[],
  initialState: GachaState
) => {
  const seeds = new SeedList(initialSeed);
  let idx = 1;
  let state: GachaState = { ...initialState };
  let firstRollDupeOf = "";
  for (let i = 0; i < rolls.length; i++) {
    const r = rolls[i];
    let outcome = singlePull(gacha, seeds, idx, state);
    // The first regular roll may be a dupe of the unknown pull before it
    // (medamas before it keep the last roll unknown)
    if (
      state.lastRoll === "" &&
      outcome.results.length === 1 &&
      !outcome.results[0].isMedama &&
      !outcome.results[0].isGuaranteed &&
      outcome.results[0].unit !== r &&
      gacha.pools[outcome.results[0].pool].reroll
    ) {
      firstRollDupeOf = outcome.results[0].unit;
      outcome = singlePull(gacha, seeds, idx, {
        ...state,
        lastRoll: firstRollDupeOf,
      });
    }
    idx += outcome.consumed;
    state = outcome.state;
  }
  const nextOutcome = singlePull(gacha, seeds, idx, state);
  const nextIsReroll = nextOutcome.results.some((res) => res.rerolled);
  return {
    seedBefore: initialSeed,
    seedAfter: seeds.get(idx - 1),
    stateBefore: { ...initialState, lastRoll: firstRollDupeOf },
    stateAfter: state,
    nextIsReroll,
  };
};

const EventFinderPage = () => {
  useEffect(() => {
    document.title = "이벤트 뽑기 시드 찾기";
  }, []);

  const initialEvKey = getQueryParam("ev");
  const [gachaKey, setGachaKey] = useState(
    EVENT_GACHAS.find((g) => g.key === initialEvKey)?.key || EVENT_GACHAS[0].key
  );
  const gacha =
    EVENT_GACHAS.find((g) => g.key === gachaKey) || EVENT_GACHAS[0];

  const [guaranteedLeft, setGuaranteedLeft] = useState<number>(
    gacha.guaranteed ? gacha.guaranteed.step : 10
  );
  const [medamaStock, setMedamaStock] = useState<number>(
    gacha.medama ? gacha.medama.stock : 0
  );
  const [medamaLeft, setMedamaLeft] = useState<number>(
    gacha.medama ? gacha.medama.guaranteedSteps : 0
  );

  const [selectedRolls, setSelectedRolls] = useState<string[]>([]);
  const [searchFilter, setSearchFilter] = useState("");

  const [progresses, setProgresses] = useState<number[]>([]);
  const [matchesFound, setMatchesFound] = useState<FoundMatch[]>([]);
  const [totalMatchCount, setTotalMatchCount] = useState<number>(0);
  const [searchedConfig, setSearchedConfig] = useState<{
    gacha: EventGacha;
    rolls: string[];
    initialState: GachaState;
  } | null>(null);

  const workersRef = useRef<Worker[]>([]);

  const isSearching = progresses.length > 0 && progresses.some((p) => p < 100);
  const finishedSearching = progresses.length > 0 && !isSearching;

  const stopWorkers = () => {
    workersRef.current.forEach((w) => w.terminate());
    workersRef.current = [];
  };

  useEffect(() => () => stopWorkers(), []);

  const handleGachaChange = (newKey: string) => {
    stopWorkers();
    setProgresses([]);
    setMatchesFound([]);
    setTotalMatchCount(0);
    setSelectedRolls([]);
    setGachaKey(newKey);
    const next = EVENT_GACHAS.find((g) => g.key === newKey) || EVENT_GACHAS[0];
    setGuaranteedLeft(next.guaranteed ? next.guaranteed.step : 10);
    setMedamaStock(next.medama ? next.medama.stock : 0);
    setMedamaLeft(next.medama ? next.medama.guaranteedSteps : 0);
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

    const initialState: GachaState = {
      lastRoll: "",
      guaranteedLeft: gacha.guaranteed ? guaranteedLeft : null,
      medamaStock: gacha.medama ? medamaStock : 0,
      medamaLeft:
        gacha.medama && medamaStock > 0 && medamaLeft > 0 ? medamaLeft : null,
    };

    setSearchedConfig({
      gacha,
      rolls: rollsToSearch,
      initialState,
    });
    setMatchesFound([]);
    setTotalMatchCount(0);

    const numWorkers = Math.min(
      16,
      Math.max(4, navigator.hardwareConcurrency || 8)
    );
    const totalSeeds = 2 ** 32;
    const chunkSize = Math.ceil(totalSeeds / numWorkers);

    setProgresses(Array(numWorkers).fill(0));
    const newWorkers: Worker[] = [];

    for (let wIdx = 0; wIdx < numWorkers; wIdx++) {
      const startSeed = Math.max(1, wIdx * chunkSize);
      const endSeed = Math.min(totalSeeds, (wIdx + 1) * chunkSize);
      const worker = new Worker(
        new URL("./eventSeedFinderWorker.js", import.meta.url)
      );
      worker.onmessage = (event: { data: WorkerEventMessage }) => {
        const { type, percentageSearched, matches, matchCount } = event.data;
        if (type === "progress") {
          setProgresses((prev) => [
            ...prev.slice(0, wIdx),
            percentageSearched ?? 0,
            ...prev.slice(wIdx + 1),
          ]);
        } else if (type === "complete") {
          if (matches && matches.length > 0) {
            setMatchesFound((prev) =>
              [...prev, ...matches].sort((a, b) => a.seedBefore - b.seedBefore)
            );
          }
          if (typeof matchCount === "number" && matchCount > 0) {
            setTotalMatchCount((prev) => prev + matchCount);
          }
          setProgresses((prev) => [
            ...prev.slice(0, wIdx),
            100,
            ...prev.slice(wIdx + 1),
          ]);
        }
      };
      worker.postMessage({
        startSeed,
        endSeed,
        gacha,
        rolls: rollsToSearch,
        initialState,
      });
      newWorkers.push(worker);
    }
    workersRef.current = newWorkers;
  };

  const buildEventTableUrl = (
    targetGacha: EventGacha,
    seed: number,
    state: GachaState
  ) => {
    const params = new URLSearchParams(window.location.search);
    params.set("ev", targetGacha.key);
    params.set("evSeed", seed.toString());
    params.set("evLast", state.lastRoll || "");
    if (targetGacha.guaranteed && state.guaranteedLeft !== null) {
      params.set("evGuar", state.guaranteedLeft.toString());
    } else {
      params.delete("evGuar");
    }
    if (targetGacha.medama) {
      params.set("evStock", state.medamaStock.toString());
      params.set("evMedama", (state.medamaLeft || 0).toString());
    } else {
      params.delete("evStock");
      params.delete("evMedama");
    }
    return `?${params.toString()}#/event`;
  };

  // Unique units for the picker
  const unitEntries: string[] = [];
  const seenUnits = new Set<string>();
  gacha.pools.forEach((pool) => {
    pool.units.forEach((u) => {
      if (!seenUnits.has(u)) {
        seenUnits.add(u);
        unitEntries.push(u);
      }
    });
  });
  if (gacha.medama && medamaStock > 0) {
    unitEntries.push(MEDAMA);
  }

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
        이벤트 뽑기 시드 찾기 <a href="#credits">[크레딧]</a>
      </Typography>
      <div style={{ display: "flex", gap: "6px", margin: "4px 0" }}>
        <button
          type="button"
          onClick={() => (window.location.hash = `#/event`)}
        >
          이벤트 뽑기 배열로 이동
        </button>
        <button
          type="button"
          onClick={() => (window.location.hash = `#/finder`)}
        >
          냥코뽑기 시드 찾기로 이동
        </button>
      </div>
      <Typography variant="h6">이 도구에 대하여</Typography>
      <ul>
        <li>
          이벤트 뽑기에서 단발로 뽑은 결과를 순서대로 선택해 현재 시드를 찾는
          도구입니다.
        </li>
        <li>
          보통 <strong>단발 7~10회 정도</strong>의 결과를 순서대로 입력하면
          시드를 하나로 특정할 수 있습니다.
        </li>
        <li>
          특별 아이템이 있는 배너는 재고를 모두 소진한 뒤(`0 (모두 소진)`)에
          단발로 뽑아 찾는 것이 훨씬 간단합니다.
        </li>
      </ul>

      <Typography variant="h6">1. 대상 이벤트 뽑기</Typography>
      <div style={{ marginBottom: "10px" }}>
        <select
          value={gacha.key}
          onChange={(e) => handleGachaChange(e.target.value)}
        >
          {EVENT_GACHAS.map(({ key, name }) => (
            <option key={key} value={key}>
              {eventKo(name)}
            </option>
          ))}
        </select>
      </div>

      {(gacha.guaranteed || gacha.medama) && (
        <>
          <Typography variant="h6">2. 뽑기 시작 전 상태</Typography>
          <Box>
            {gacha.guaranteed && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "4px",
                }}
              >
                <span>확정까지 남은 횟수:</span>
                <select
                  value={guaranteedLeft}
                  onChange={(e) =>
                    setGuaranteedLeft(parseInt(e.target.value, 10))
                  }
                >
                  {Array.from(
                    { length: gacha.guaranteed.step },
                    (_, i) => i + 1
                  ).map((left) => (
                    <option key={left} value={left}>
                      {left === 1 ? "1 (첫 뽑기가 확정)" : left}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {gacha.medama && (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: medamaStock > 0 ? "6px" : "0",
                  }}
                >
                  <span>남은 특별 아이템 재고:</span>
                  <select
                    value={medamaStock}
                    onChange={(e) =>
                      setMedamaStock(parseInt(e.target.value, 10))
                    }
                  >
                    {Array.from(
                      { length: gacha.medama.stock + 1 },
                      (_, i) => i
                    ).map((stock) => (
                      <option key={stock} value={stock}>
                        {stock === 0 ? "0 (모두 소진)" : stock}
                      </option>
                    ))}
                  </select>
                </div>
                {medamaStock > 0 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span>다음 특별 아이템 확정까지:</span>
                    <select
                      value={medamaLeft}
                      onChange={(e) =>
                        setMedamaLeft(parseInt(e.target.value, 10))
                      }
                    >
                      <option value={0}>모름 / 확정 없음</option>
                      {Array.from(
                        { length: gacha.medama.guaranteedSteps },
                        (_, i) => i + 1
                      ).map((left) => (
                        <option key={left} value={left}>
                          {left === 1 ? "1 (첫 뽑기가 확정)" : left}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}
          </Box>
        </>
      )}

      <Typography variant="h6">
        {gacha.guaranteed || gacha.medama ? "3." : "2."} 뽑은 결과 (단발 7~10회
        권장)
      </Typography>
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

      {isSearching && (
        <div style={{ marginBottom: "16px" }}>
          <Typography variant="body1">검색 중...</Typography>
          {progresses.map((progress, i) => (
            <RowContainer key={i}>
              <Typography variant="body1" style={{ minWidth: "30px" }}>
                #{i + 1}
              </Typography>
              <ProgressBarContainer>
                <ProgressBar percentage={progress} />
              </ProgressBarContainer>
            </RowContainer>
          ))}
        </div>
      )}

      {finishedSearching && searchedConfig && (
        <div style={{ marginBottom: "24px" }}>
          <Typography variant="h6">검색 결과</Typography>
          {matchesFound.length > 0 ? (
            <>
              <Typography variant="body1" style={{ marginBottom: "8px" }}>
                입력한 {searchedConfig.rolls.length}회 뽑기 결과와 일치하는
                시드를 총 <strong>{totalMatchCount}개</strong> 찾았습니다.
                {totalMatchCount > matchesFound.length &&
                  ` (상위 ${matchesFound.length}개 표시)`}
              </Typography>
              <ul>
                {matchesFound.slice(0, 100).map((match, i) => {
                  const sim = simulateRolls(
                    searchedConfig.gacha,
                    match.seedBefore,
                    searchedConfig.rolls,
                    searchedConfig.initialState
                  );
                  return (
                    <li key={match.seedBefore} style={{ marginBottom: "6px" }}>
                      <strong>후보 {i + 1}</strong>
                      <ul>
                        <li>
                          {searchedConfig.rolls.length}회 뽑기{" "}
                          <strong>전</strong> 시드 (검증용):{" "}
                          <a
                            href={buildEventTableUrl(
                              searchedConfig.gacha,
                              sim.seedBefore,
                              sim.stateBefore
                            )}
                          >
                            {sim.seedBefore}
                          </a>
                        </li>
                        <li>
                          {searchedConfig.rolls.length}회 뽑기{" "}
                          <strong>후</strong> 시드 (현재 위치):{" "}
                          <a
                            href={buildEventTableUrl(
                              searchedConfig.gacha,
                              sim.seedAfter,
                              sim.stateAfter
                            )}
                          >
                            {sim.seedAfter}
                          </a>
                        </li>
                        {sim.nextIsReroll && (
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
              </ul>
            </>
          ) : (
            <div>
              <Typography variant="body1" style={{ marginBottom: "6px" }}>
                일치하는 시드를 찾지 못했습니다. 입력한 내용이 다르거나, 첫 번째
                뽑기가 직전 뽑기와 중복(재추첨)되어 바뀐 결과일 수 있습니다.
              </Typography>
              {searchedConfig.rolls.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const nextRolls = searchedConfig.rolls.slice(1);
                    setSelectedRolls(nextRolls);
                    runSearch(nextRolls);
                  }}
                >
                  맨 앞의 &ldquo;{unitKo(searchedConfig.rolls[0])}&rdquo;을(를)
                  빼고 다시 검색하기
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default EventFinderPage;
