import React, { useEffect, useState } from "react";
import styled from "@emotion/styled";
import { Tooltip, Typography } from "@mui/material";
import { getQueryParam, setQueryParam } from "./utils/queryParams";
import {
  EVENT_GACHAS,
  EventGacha,
  EventPoolColor,
  MULTI_ROLL_NUM,
} from "./utils/eventData";
import {
  GachaState,
  PullOutcome,
  SeedList,
  medamaActive,
  multiPull,
  singlePull,
} from "./utils/eventEngine";
import { eventKo, unitKo } from "./utils/i18n";

type Destination = { outcome: PullOutcome; dest: number };

type EventCell = {
  index: number; // seed index the cell starts at
  label: string;
  stateBefore: GachaState;
  plain: Destination; // as a regular pull, not a dupe of the previous roll
  dupe?: Destination; // if the previous roll was the same unit
  showDupe: boolean;
  guaranteed?: Destination; // if this pull were the guaranteed one
  multi?: Destination; // a 10-pull starting here
  multiDupe?: Destination; // a 10-pull starting here if the first roll dupes
};

const TRACKS = ["A", "B", "C"];

// A last roll that matches no unit
const NO_DUPE = "\u0000";

const labelFor = (index: number, trackCount: number) =>
  `${Math.floor((index - 1) / trackCount) + 1}${
    TRACKS[(index - 1) % trackCount]
  }`;

// A guaranteed medama uses no seeds, so the same cell also shows the next pull
const cellPull = (
  gacha: EventGacha,
  seeds: SeedList,
  index: number,
  state: GachaState
): Destination => {
  let outcome = singlePull(gacha, seeds, index, state);
  while (outcome.consumed === 0) {
    const next = singlePull(gacha, seeds, index, outcome.state);
    outcome = {
      results: [...outcome.results, ...next.results],
      consumed: next.consumed,
      state: next.state,
    };
  }
  return { outcome, dest: index + outcome.consumed };
};

const buildCells = (
  gacha: EventGacha,
  seeds: SeedList,
  numRolls: number,
  initialState: GachaState,
  multiRollCount = MULTI_ROLL_NUM
) => {
  const trackCount = medamaActive(gacha, initialState) ? 3 : 2;
  const cells = new Map<number, EventCell>();

  for (let track = 0; track < trackCount; track++) {
    // Each track is followed as if pulling one at a time down it
    let state: GachaState = {
      ...initialState,
      lastRoll: track === 0 ? initialState.lastRoll : "",
    };
    for (let row = 0; row < numRolls; row++) {
      const index = 1 + track + row * trackCount;
      // The cell shows regular pulls; the guaranteed character is shown
      // separately. Afterwards the guaranteed counter has moved on by one.
      const regularPull = (lastRoll: string) => {
        const pull = cellPull(gacha, seeds, index, {
          ...state,
          lastRoll,
          guaranteedLeft: null,
        });
        pull.outcome.state.guaranteedLeft =
          state.guaranteedLeft === null
            ? null
            : state.guaranteedLeft > 1
            ? state.guaranteedLeft - 1
            : gacha.guaranteed!.step;
        return pull;
      };
      // The plain result ignores the last roll, but a medama keeps it
      const plain = regularPull(NO_DUPE);
      if (plain.outcome.state.lastRoll === NO_DUPE) {
        plain.outcome.state.lastRoll = state.lastRoll;
      }
      const plainResult = plain.outcome.results[plain.outcome.results.length - 1];
      const canDupe = !plainResult.isMedama && gacha.pools[plainResult.pool].reroll;
      const dupe = canDupe ? regularPull(plainResult.unit) : undefined;
      const hasMulti = !!gacha.guaranteed || medamaActive(gacha, state);
      const multi = hasMulti
        ? (() => {
            const outcome = multiPull(
              gacha,
              seeds,
              index,
              {
                ...state,
                lastRoll: NO_DUPE,
              },
              multiRollCount
            );
            return { outcome, dest: index + outcome.consumed };
          })()
        : undefined;
      const multiDupe =
        multi &&
        (() => {
          const firstNormal = multi.outcome.results.find(
            (r) => !r.isMedama && !r.isGuaranteed
          );
          if (!firstNormal || !gacha.pools[firstNormal.pool].reroll) {
            return undefined;
          }
          const outcome = multiPull(
            gacha,
            seeds,
            index,
            {
              ...state,
              lastRoll: firstNormal.unit,
            },
            multiRollCount
          );
          return { outcome, dest: index + outcome.consumed };
        })();
      cells.set(index, {
        index,
        label: labelFor(index, trackCount),
        stateBefore: state,
        plain,
        dupe,
        showDupe: canDupe && state.lastRoll === plainResult.unit,
        guaranteed: gacha.guaranteed
          ? cellPull(gacha, seeds, index, { ...state, guaranteedLeft: 1 })
          : undefined,
        multi,
        multiDupe,
      });
      // Guaranteed character counters are taken from the controls for every
      // cell; medama stock and counters carry on down the track
      state = {
        ...plain.outcome.state,
        guaranteedLeft: initialState.guaranteedLeft,
      };
    }
  }

  return { trackCount, cells };
};

const POOL_COLORS: Record<EventPoolColor, string> = {
  common: "#FFFFFF",
  rare: "#EEEEEE",
  super: "gold",
  special: "red",
  xp: "aqua",
};
const MEDAMA_COLOR = "#b9f6ca";

const Table = styled.table`
  border-collapse: collapse;
  td {
    border: 1px solid black;
    text-align: center;
    white-space: nowrap;
    padding: 0 6px;
  }
  th {
    border: 1px solid black;
    font-weight: bold;
  }
`;

const Small = styled.div`
  font-size: 0.75rem !important;
  color: #333;
  a,
  span {
    font-size: 0.75rem !important;
  }
`;

const EventPage = () => {
  useEffect(() => {
    document.title = "이벤트 뽑기 배열";
  }, []);
  const gacha =
    EVENT_GACHAS.find(({ key }) => key === getQueryParam("ev")) ||
    EVENT_GACHAS[0];
  const [seedInput, setSeedInput] = useState(getQueryParam("evSeed"));
  const [selectedPull, setSelectedPull] = useState<{
    index: number;
    kind: "single" | "multi";
    useDupe: boolean;
  } | null>(null);
  const numRolls = parseInt(getQueryParam("evRolls"), 10);
  const seed = parseInt(getQueryParam("evSeed"), 10) || 1;

  const intParam = (
    key: "evGuar" | "evStock" | "evMedama" | "evMulti",
    fallback: number
  ) => {
    const value = parseInt(getQueryParam(key), 10);
    return Number.isNaN(value) ? fallback : value;
  };
  const multiRollCount = Math.min(
    MULTI_ROLL_NUM,
    Math.max(2, intParam("evMulti", MULTI_ROLL_NUM))
  );
  const initialState: GachaState = {
    lastRoll: getQueryParam("evLast"),
    guaranteedLeft: gacha.guaranteed
      ? intParam("evGuar", gacha.guaranteed.step)
      : null,
    medamaStock: gacha.medama ? intParam("evStock", gacha.medama.stock) : 0,
    medamaLeft: gacha.medama
      ? intParam("evMedama", gacha.medama.guaranteedSteps) || null
      : null,
  };

  const seeds = new SeedList(seed);
  // Extra buffer so a multi-pull near the bottom can still highlight its destination
  const { trackCount, cells } = buildCells(
    gacha,
    seeds,
    numRolls + 12,
    initialState,
    multiRollCount
  );

  type CellHighlight = {
    inPath?: boolean;
    isLanding?: boolean;
    usedDupe?: boolean;
    isGuaranteedStep?: boolean;
    multiSelected?: boolean;
  };
  const highlights = new Map<number, CellHighlight>();
  if (selectedPull) {
    const startCell = cells.get(selectedPull.index);
    if (startCell) {
      if (selectedPull.kind === "multi" && startCell.multi) {
        const chosen =
          selectedPull.useDupe && startCell.multiDupe
            ? startCell.multiDupe
            : startCell.multi;
        highlights.set(startCell.index, {
          ...highlights.get(startCell.index),
          multiSelected: true,
        });
        for (const r of chosen.outcome.results) {
          if (r.cellIndex !== undefined) {
            const prev = highlights.get(r.cellIndex) || {};
            highlights.set(r.cellIndex, {
              ...prev,
              inPath: true,
              usedDupe: prev.usedDupe || r.rerolled,
              isGuaranteedStep: prev.isGuaranteedStep || r.isGuaranteed,
            });
          }
        }
        const prevDest = highlights.get(chosen.dest) || {};
        highlights.set(chosen.dest, {
          ...prevDest,
          inPath: true,
          isLanding: true,
        });
      } else if (selectedPull.kind === "single") {
        let curIndex = startCell.index;
        let forceDupeFirst = selectedPull.useDupe;
        let prevUnit = "";
        for (let step = 0; step <= MULTI_ROLL_NUM; step++) {
          const c = cells.get(curIndex);
          if (!c) {
            break;
          }
          const isLast = step === MULTI_ROLL_NUM;
          const plainRes = c.plain.outcome.results;
          const plainUnit = plainRes[plainRes.length - 1].unit;
          const takeDupe =
            !isLast &&
            !!c.dupe &&
            (step === 0 ? forceDupeFirst : plainUnit === prevUnit);
          const prev = highlights.get(curIndex) || {};
          highlights.set(curIndex, {
            ...prev,
            inPath: true,
            isLanding: isLast,
            usedDupe: !isLast ? takeDupe : prev.usedDupe,
          });
          if (isLast) {
            break;
          }
          const dest = takeDupe && c.dupe ? c.dupe : c.plain;
          prevUnit = dest.outcome.state.lastRoll;
          curIndex = dest.dest;
        }
      }
    }
  }

  // Link to the table after a pull: the seed before the destination, plus the
  // state the pull leaves behind
  const hrefFor = ({ outcome, dest }: Destination) => {
    const params = new URLSearchParams(window.location.search);
    params.set("evSeed", seeds.get(dest - 1).toString());
    params.set("evLast", outcome.state.lastRoll);
    if (outcome.state.guaranteedLeft !== null) {
      params.set("evGuar", outcome.state.guaranteedLeft.toString());
    }
    if (gacha.medama) {
      params.set("evStock", outcome.state.medamaStock.toString());
      params.set("evMedama", (outcome.state.medamaLeft || 0).toString());
    }
    return `?${params.toString()}#/event`;
  };

  const resultText = (outcome: PullOutcome) =>
    outcome.results
      .map((result) =>
        result.isMedama
          ? result.isGuaranteedMedama
            ? "특별 아이템(확정)"
            : "특별 아이템"
          : unitKo(result.unit)
      )
      .join(" + ");

  const destLabel = (dest: number) => labelFor(dest, trackCount);

  const hasMultiCol = !!gacha.guaranteed || medamaActive(gacha, initialState);
  const colsPerTrack = hasMultiCol ? 3 : 2;

  const multiText = ({ outcome }: Destination) => {
    if (gacha.guaranteed) {
      const guaranteed = outcome.results.filter((r) => r.isGuaranteed);
      if (guaranteed.length === 0) {
        return "확정 없음";
      }
      return guaranteed.map((r) => unitKo(r.unit)).join(", ");
    }
    const medamas = outcome.results.filter((r) => r.isMedama).length;
    const characters = outcome.results.filter(
      (r) =>
        !r.isMedama &&
        !r.isGuaranteed &&
        gacha.pools[r.pool].color === "special"
    ).length;
    const parts = [];
    if (medamas > 0) {
      parts.push(`특별 아이템 ${medamas}개`);
    }
    if (characters > 0) {
      parts.push(`캐릭터 ${characters}개`);
    }
    return parts.length > 0 ? parts.join(", ") : "-";
  };

  const formatMultiRollList = (outcome: PullOutcome) =>
    outcome.results
      .map((r, i) => {
        const name = r.isMedama
          ? r.isGuaranteedMedama
            ? "특별 아이템(확정)"
            : "특별 아이템"
          : unitKo(r.unit);
        const suffix = r.isGuaranteed
          ? " (확정)"
          : r.rerolled
          ? " (중복)"
          : "";
        return `${i + 1}: ${name}${suffix}`;
      })
      .join("\n");

  const multiTooltipText = (cell: EventCell) => {
    if (!cell.multi) {
      return "";
    }
    if (cell.multiDupe) {
      return [
        "[처음에 중복이 아닐 때]",
        formatMultiRollList(cell.multi.outcome),
        `→ ${destLabel(cell.multi.dest)}`,
        "",
        `[처음에 중복일 때: ${multiText(cell.multiDupe)} → ${destLabel(
          cell.multiDupe.dest
        )}]`,
        formatMultiRollList(cell.multiDupe.outcome),
      ].join("\n");
    }
    return [
      formatMultiRollList(cell.multi.outcome),
      `→ ${destLabel(cell.multi.dest)}`,
    ].join("\n");
  };

  const wrapTooltip = (title: string | undefined, children: React.ReactElement) =>
    title ? (
      <Tooltip
        title={<span style={{ whiteSpace: "pre-line" }}>{title}</span>}
        arrow
        placement="top"
      >
        {children}
      </Tooltip>
    ) : (
      children
    );

  const highlightBackground = (hl?: CellHighlight) => {
    if (!hl?.inPath) {
      return undefined;
    }
    if (hl.isLanding) {
      return "repeating-linear-gradient(90deg, #00000075 5px, #00000075 15px, #00000050 15px, #00000050 25px)";
    }
    return "linear-gradient(#00000050, #00000050)";
  };

  const toggleSelect = (
    e: React.MouseEvent,
    index: number,
    kind: "single" | "multi",
    canDupe: boolean,
    defaultDupe: boolean
  ) => {
    if ((e.target as HTMLElement).closest("a")) {
      return;
    }
    setSelectedPull((prev) => {
      if (!prev || prev.index !== index || prev.kind !== kind) {
        return { index, kind, useDupe: defaultDupe };
      }
      if (canDupe && prev.useDupe === defaultDupe) {
        return { index, kind, useDupe: !defaultDupe };
      }
      return null;
    });
  };

  const renderCell = (cell: EventCell) => {
    const plainResults = cell.plain.outcome.results;
    const last = plainResults[plainResults.length - 1];
    const background = last.isMedama
      ? MEDAMA_COLOR
      : POOL_COLORS[gacha.pools[last.pool].color];
    const jumps = cell.plain.dest !== cell.index + trackCount;
    const singleTooltip = cell.dupe
      ? `중복 시: ${resultText(cell.dupe.outcome)} → ${destLabel(cell.dupe.dest)}`
      : undefined;
    const hl = highlights.get(cell.index);
    const bgImage = highlightBackground(hl);
    const showDupeLine = (cell.showDupe || hl?.usedDupe) && cell.dupe;
    return (
      <React.Fragment key={cell.index}>
        <td rowSpan={trackCount}>{cell.label}</td>
        {wrapTooltip(
          singleTooltip,
          <td
            rowSpan={trackCount}
            onClick={(e) =>
              toggleSelect(
                e,
                cell.index,
                "single",
                !!cell.dupe,
                cell.showDupe && !!cell.dupe
              )
            }
            style={{
              backgroundColor: background,
              backgroundImage: bgImage,
              cursor: "pointer",
              borderBottom:
                cell.dupe && !showDupeLine ? "1px dotted #1976d2" : undefined,
            }}
          >
            <div
              style={{
                opacity: hl?.inPath && !hl.isLanding && hl.usedDupe ? 0.55 : 1,
              }}
            >
              <a href={hrefFor(cell.plain)}>{resultText(cell.plain.outcome)}</a>
              {jumps && ` → ${destLabel(cell.plain.dest)}`}
            </div>
            {showDupeLine && cell.dupe && (
              <div
                style={{
                  fontWeight: hl?.usedDupe ? "bold" : undefined,
                }}
              >
                <a href={hrefFor(cell.dupe)}>
                  ({resultText(cell.dupe.outcome)} → {destLabel(cell.dupe.dest)})
                </a>
              </div>
            )}
            {cell.guaranteed && (
              <Small
                style={{
                  fontWeight: hl?.isGuaranteedStep ? "bold" : undefined,
                }}
              >
                <a href={hrefFor(cell.guaranteed)}>
                  {resultText(cell.guaranteed.outcome)}
                </a>
              </Small>
            )}
          </td>
        )}
        {hasMultiCol &&
          cell.multi &&
          wrapTooltip(
            multiTooltipText(cell),
            <td
              rowSpan={trackCount}
              onClick={(e) =>
                toggleSelect(
                  e,
                  cell.index,
                  "multi",
                  !!cell.multiDupe,
                  cell.showDupe && !!cell.multiDupe
                )
              }
              style={{
                cursor: "pointer",
                backgroundImage: hl?.multiSelected
                  ? "linear-gradient(#00000050, #00000050)"
                  : undefined,
                color:
                  gacha.guaranteed &&
                  !cell.multi.outcome.results.some((r) => r.isGuaranteed)
                    ? "#777"
                    : undefined,
                fontStyle:
                  gacha.guaranteed &&
                  !cell.multi.outcome.results.some((r) => r.isGuaranteed)
                    ? "italic"
                    : undefined,
                borderBottom:
                  cell.multiDupe && !cell.showDupe
                    ? "1px dotted #1976d2"
                    : undefined,
              }}
            >
              <div
                style={{
                  fontWeight:
                    hl?.multiSelected && !selectedPull?.useDupe
                      ? "bold"
                      : undefined,
                }}
              >
                <a href={hrefFor(cell.multi)}>
                  {multiText(cell.multi)} → {destLabel(cell.multi.dest)}
                </a>
              </div>
              {(cell.showDupe ||
                (hl?.multiSelected && selectedPull?.useDupe)) &&
                cell.multiDupe && (
                  <div
                    style={{
                      fontWeight:
                        hl?.multiSelected && selectedPull?.useDupe
                          ? "bold"
                          : undefined,
                    }}
                  >
                    <a href={hrefFor(cell.multiDupe)}>
                      ({multiText(cell.multiDupe)} →{" "}
                      {destLabel(cell.multiDupe.dest)})
                    </a>
                  </div>
                )}
            </td>
          )}
      </React.Fragment>
    );
  };

  // One table row per seed; each cell spans trackCount rows, and track t
  // starts t seeds later
  const lastIndex = numRolls * trackCount + trackCount - 1;
  const rows = [];
  for (let index = 1; index <= lastIndex; index++) {
    const tds = [];
    for (let track = 0; track < trackCount; track++) {
      const cell = cells.get(index);
      const row = Math.floor((index - 1) / trackCount);
      if ((index - 1) % trackCount === track && row < numRolls && cell) {
        tds.push(renderCell(cell));
      } else if (index === 1 && track > 0) {
        tds.push(
          <td key={`top-${track}`} colSpan={colsPerTrack} rowSpan={track} />
        );
      } else if (index === numRolls * trackCount + track + 1) {
        tds.push(
          <td
            key={`bottom-${track}`}
            colSpan={colsPerTrack}
            rowSpan={trackCount - 1 - track}
          />
        );
      }
    }
    rows.push(<tr key={index}>{tds}</tr>);
  }

  // Changing the event resets everything that depends on it
  const switchEvent = (key: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set("ev", key);
    ["evLast", "evGuar", "evStock", "evMedama", "evMulti"].forEach((k) =>
      params.delete(k)
    );
    window.location.href = `?${params.toString()}#/event`;
  };

  const rerollUnits = [
    ...new Set(gacha.pools.filter((p) => p.reroll).flatMap((p) => p.units)),
  ];

  return (
    <>
      <Typography variant="h4">
        이벤트 뽑기 배열 <a href="#credits">[크레딧]</a>
      </Typography>
      <div style={{ display: "flex", gap: "6px", margin: "4px 0" }}>
        <button
          type="button"
          onClick={() => (window.location.hash = "#/")}
        >
          냥코뽑기 배열로 이동
        </button>
        <button
          type="button"
          onClick={() => {
            const params = new URLSearchParams(window.location.search);
            params.set("ev", gacha.key);
            window.location.href = `?${params.toString()}#/event-finder`;
          }}
        >
          이벤트 뽑기 시드 찾기
        </button>
      </div>
      <Typography variant="h6">이 도구에 대하여</Typography>
      <ul>
        <li>
          시드를 찾고 계신가요?{" "}
          <a href={`?ev=${gacha.key}#/event-finder`}>여기서</a> 찾을 수
          있습니다.
        </li>
        <li>
          이벤트 뽑기도 같은 방식으로 시드가 정해집니다. 한 번 뽑을 때 시드를
          2개 씁니다. 첫 번째 시드는 등급을, 두 번째 시드는 아이템을 정합니다.
          중복 재추첨도 냥코뽑기와 똑같이 작동합니다.
        </li>
        <li>
          <strong>확정 뽑기</strong>: 확정 캐릭터가 포함된 연뽑은 첫 시드를
          확정 캐릭터의 등급을 정하는 데 먼저 쓰고 시작합니다. 그래서 단일
          뽑기를 여러 번 하는 것과 연뽑의 결과가 다릅니다.
          <ul>
            <li>
              일반열 칸 아래의 작은 글씨는 그 칸이 단일 확정 뽑기일 때 나오는
              확정 캐릭터입니다.
            </li>
            <li>
              <strong>확정열({multiRollCount}연)</strong>은 그 칸에서{" "}
              {multiRollCount}연뽑을 했을 때의 확정 결과와 다음 위치입니다.
              마우스를 올리면 1~{multiRollCount}번째에 무엇이 나오는지 확인할 수
              있고, <strong>링크 바깥의 칸 여백을 클릭</strong>하면 냥코뽑기
              배열처럼 {multiRollCount}연 동안 거쳐 가는 칸들과 열 이동 경로,
              도착 위치(빗금)가 하이라이트됩니다(첫 칸이 중복 가능한 칸이면 한 번
              더 클릭해 첫 칸 중복 경로도 볼 수 있습니다).
            </li>
            <li>
              <strong>일반열</strong>에서 중복 재추첨이 일어날 수 있는 칸에
              마우스를 올리면 중복 시 무엇이 나오고 어디로 이동하는지 표시됩니다.
            </li>
          </ul>
        </li>
        <li>
          <strong>특별 아이템</strong>(다운로드 기념 등의 한정 보상)이 남아 있는
          뽑기는 뽑기마다 특별 아이템 당첨을 정하는 시드를 하나 더 써서 A·B·C열이
          됩니다.
          <ul>
            <li>
              특별 아이템이 나오면 시드를 1개만 쓰고, 마지막 뽑기(중복 판정)는
              바뀌지 않습니다.
            </li>
            <li>
              연뽑은 모든 자리의 특별 아이템 당첨을 먼저 정하고 나서 순서대로
              뽑습니다. 확정 특별 아이템은 시드를 쓰지 않습니다.
            </li>
            <li>
              특별 아이템 재고를 모두 소진하면 냥코뽑기와 같은 단순한 A·B열이
              됩니다. 재고를 먼저 소진하고 시드를 찾는 쪽이 간단합니다.
            </li>
            <li>
              특별 아이템이 나오는 위치는 알 수 있지만, 특별 아이템 안에서 무엇이
              나올지는 알 수 없습니다.
            </li>
          </ul>
        </li>
      </ul>
      <Typography variant="h6">설정</Typography>
      <Typography variant="subtitle2">이벤트</Typography>
      <div style={{ marginBottom: "4px" }}>
        <select
          value={gacha.key}
          onChange={(event) => switchEvent(event.target.value)}
        >
          {EVENT_GACHAS.map(({ key, name }) => (
            <option key={key} value={key}>
              {eventKo(name)}
            </option>
          ))}
        </select>
      </div>
      <Typography variant="subtitle2">현재 시드</Typography>
      <div style={{ marginBottom: "4px" }}>
        <input
          type="text"
          style={{ marginRight: "4px" }}
          value={seedInput}
          onChange={(event) => setSeedInput(event.target.value)}
        />
        <button type="button" onClick={() => setQueryParam("evSeed", seedInput)}>
          업데이트
        </button>
      </div>
      <Typography variant="subtitle2">마지막 뽑기</Typography>
      <div style={{ marginBottom: "4px" }}>
        <select
          value={rerollUnits.includes(initialState.lastRoll) ? initialState.lastRoll : ""}
          onChange={(event) => setQueryParam("evLast", event.target.value)}
        >
          <option value="">-- 없음 / 그 외 아이템 --</option>
          {rerollUnits.map((unit) => (
            <option key={unit} value={unit}>
              {unitKo(unit)}
            </option>
          ))}
        </select>
      </div>
      {gacha.guaranteed && (
        <>
          <Typography variant="subtitle2">확정까지 남은 횟수</Typography>
          <div style={{ marginBottom: "4px" }}>
            <select
              value={initialState.guaranteedLeft || gacha.guaranteed.step}
              onChange={(event) => setQueryParam("evGuar", event.target.value)}
            >
              {Array.from({ length: gacha.guaranteed.step }, (_, i) => i + 1).map(
                (left) => (
                  <option key={left} value={left}>
                    {left === 1 ? "1 (다음 뽑기가 확정)" : left}
                  </option>
                )
              )}
            </select>
          </div>
        </>
      )}
      {gacha.medama && (
        <>
          <Typography variant="subtitle2">남은 특별 아이템 재고</Typography>
          <div style={{ marginBottom: "4px" }}>
            <select
              value={initialState.medamaStock}
              onChange={(event) => setQueryParam("evStock", event.target.value)}
            >
              {Array.from({ length: gacha.medama.stock + 1 }, (_, i) => i).map(
                (stock) => (
                  <option key={stock} value={stock}>
                    {stock === 0 ? "0 (모두 소진)" : stock}
                  </option>
                )
              )}
            </select>
          </div>
          {initialState.medamaStock > 0 && (
            <>
              <Typography variant="subtitle2">
                특별 아이템 확정까지 남은 횟수
              </Typography>
              <div style={{ marginBottom: "4px" }}>
                <select
                  value={initialState.medamaLeft || 0}
                  onChange={(event) =>
                    setQueryParam("evMedama", event.target.value)
                  }
                >
                  <option value={0}>모름 / 확정 없음</option>
                  {Array.from(
                    { length: gacha.medama.guaranteedSteps },
                    (_, i) => i + 1
                  ).map((left) => (
                    <option key={left} value={left}>
                      {left === 1 ? "1 (다음 뽑기가 확정)" : left}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </>
      )}
      {hasMultiCol && (
        <>
          <Typography variant="subtitle2">연뽑 횟수 (보유 티켓 수)</Typography>
          <div style={{ marginBottom: "4px" }}>
            <select
              value={multiRollCount}
              onChange={(event) => setQueryParam("evMulti", event.target.value)}
            >
              {Array.from(
                { length: MULTI_ROLL_NUM - 1 },
                (_, i) => MULTI_ROLL_NUM - i
              ).map((count) => (
                <option key={count} value={count}>
                  {count}연뽑 ({count}장)
                </option>
              ))}
            </select>
          </div>
        </>
      )}
      <Typography variant="subtitle2">뽑기 횟수</Typography>
      <div style={{ marginBottom: "8px" }}>
        <select
          value={numRolls}
          onChange={(event) => setQueryParam("evRolls", event.target.value)}
        >
          {[100, 200, 300, 500, 999].map((count) => (
            <option key={count} value={count}>
              {count}
            </option>
          ))}
        </select>
      </div>
      <Table cellSpacing={0}>
        <thead>
          <tr>
            {TRACKS.slice(0, trackCount).map((track) => (
              <React.Fragment key={track}>
                <th>#</th>
                <th>{track}열</th>
                {hasMultiCol && (
                  <th>
                    {gacha.guaranteed ? (
                      <>
                        {track} 확정 ({multiRollCount}연)
                        <Small>
                          (남은 {initialState.guaranteedLeft ?? gacha.guaranteed.step}회)
                        </Small>
                      </>
                    ) : (
                      `${track} ${multiRollCount}연`
                    )}
                  </th>
                )}
              </React.Fragment>
            ))}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </Table>
    </>
  );
};

export default EventPage;
