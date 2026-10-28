import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "@emotion/styled";
import { Typography } from "@mui/material";
import { getQueryParam, setQueryParam } from "./utils/queryParams";
import {
  EVENT_GACHAS,
  EventGacha,
  EventPoolColor,
  MEDAMA,
  MULTI_ROLL_NUM,
} from "./utils/eventData";
import {
  GachaState,
  PullOutcome,
  RollResult,
  SeedList,
  medamaActive,
  multiPull,
  singlePull,
} from "./utils/eventEngine";
import { eventKo, unitKo } from "./utils/i18n";
import { PathResult, PathStep } from "./utils/eventPathFinder";
import { FOUND_FILL, Swatch, findColor } from "./RollTable";
import type { PathFinderRequest } from "./eventPathFinderWorker";

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
      const plainResult =
        plain.outcome.results[plain.outcome.results.length - 1];
      const canDupe =
        !plainResult.isMedama && gacha.pools[plainResult.pool].reroll;
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

// Fixed column widths and cell heights, like the 냥코뽑기 table: longer text
// wraps inside its cell instead of widening the column
// Height of a cell with 3 tracks (special items left) and with 2
const CELL_HEIGHT = { 3: 60, 2: 58 } as Record<number, number>;
const COL_WIDTHS = { label: 44, single: 220, multi: 215 };
const Table = styled.table`
  border-collapse: collapse;
  table-layout: fixed;
  td {
    border: 1px solid black;
    text-align: center;
    padding: 0 4px;
    line-height: 1.2;
    font-size: 13px;
    word-break: keep-all;
    overflow-wrap: anywhere;
  }
  /* The page sets its own font on divs; cells use the one above */
  td > div,
  td a {
    font-size: inherit;
    line-height: inherit;
  }
  th {
    border: 1px solid black;
    font-weight: bold;
  }
`;

// Step number of the shortest path on a cell
const StepBadge = styled.span`
  display: inline-block;
  min-width: 14px;
  margin-right: 3px;
  padding: 0 2px;
  border-radius: 7px;
  background: #ff6d00;
  color: white;
  font-size: 11px;
  line-height: 14px;
  text-align: center;
`;

const stepBadges = (numbers?: number[]) =>
  numbers?.map((number) => <StepBadge key={number}>{number}</StepBadge>);

// Order of a roll within a highlighted 10-pull
const OrderBadge = styled.span`
  display: inline-block;
  min-width: 14px;
  margin-right: 3px;
  padding: 0 2px;
  border-radius: 3px;
  background: #1565c0;
  color: white;
  font-size: 11px;
  line-height: 14px;
  text-align: center;
`;

// One roll of a 10-pull, for its order line
const rollText = (r: RollResult) =>
  r.isMedama
    ? r.isGuaranteedMedama
      ? "특별 아이템(확정)"
      : "특별 아이템"
    : `${unitKo(r.unit)}${r.rerolled ? " (중복)" : ""}`;

const orderLines = (rolls?: { order: number; text: string }[]) =>
  rolls?.map(({ order, text }) => (
    <div
      key={order}
      title={`10연의 ${order}번째`}
      style={{ fontSize: "11px", color: "#0d47a1", fontWeight: "bold" }}
    >
      <OrderBadge>{order}</OrderBadge>
      {text}
    </div>
  ));

const Small = styled.div`
  font-size: 0.75rem !important;
  color: #333;
  a,
  span {
    font-size: 0.75rem !important;
  }
`;

const eventCellId = (index: number) => `ev-cell-${index}`;

const FindChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 2px 1px 6px;
  border: 1px solid #999;
  border-radius: 12px;
  button {
    padding: 0 4px;
    border: none;
    background: none;
    cursor: pointer;
  }
`;

const PositionLink = styled.button`
  padding: 0;
  border: none;
  background: none;
  color: #0000ee;
  text-decoration: underline;
  cursor: pointer;
`;

const PathBox = styled.div`
  border: 1px solid #ccc;
  border-radius: 6px;
  padding: 8px 12px;
  margin-bottom: 10px;
  max-width: 720px;
  background: #fafafa;
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
  // Shortest path: how many of each event character to get, and the result
  const [pathCounts, setPathCounts] = useState<Record<string, number>>({});
  const [pathResult, setPathResult] = useState<PathResult | null>(null);
  const [pathComputing, setPathComputing] = useState(false);
  const [pathProgress, setPathProgress] = useState<number | null>(null);
  const pathWorkerRef = useRef<Worker | null>(null);
  const stopPathWorker = () => {
    pathWorkerRef.current?.terminate();
    pathWorkerRef.current = null;
  };
  useEffect(() => stopPathWorker, []);
  // Normal ticket banners to mix in, and the ticket budget (null: get all)
  const [pathBudget, setPathBudget] = useState<number | null>(null);
  const [useLuckyTickets, setUseLuckyTickets] = useState(true);
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

  // The table depends only on these settings (all from the URL), and building
  // it is the heaviest part of the page, so it's built once rather than on
  // every re-render (e.g. each progress update of a path search)
  const initialStateKey = JSON.stringify(initialState);
  const seeds = useMemo(() => new SeedList(seed), [seed]);
  const { trackCount, cells } = useMemo(
    () =>
      // Extra buffer so a multi-pull near the bottom can still highlight its
      // destination
      buildCells(gacha, seeds, numRolls + 12, initialState, multiRollCount),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gacha.key, seeds, numRolls, initialStateKey, multiRollCount]
  );

  type CellHighlight = {
    inPath?: boolean;
    isLanding?: boolean;
    usedDupe?: boolean;
    isGuaranteedStep?: boolean;
    multiSelected?: boolean;
    // Path step numbers starting here, in the single and 10-pull columns
    stepNumbers?: number[];
    multiStepNumbers?: number[];
    // Which roll(s) of a highlighted 10-pull read this cell (1 to 10), and
    // what they give: with special items that's not the cell's single pull
    pullOrder?: { order: number; text: string }[];
    luckyPull?: {
      unit: string;
      rerolled: boolean;
      dest: number;
      dupeAction?: "create" | "avoid";
    };
  };
  const highlights = useMemo(() => {
    const highlights = new Map<number, CellHighlight>();
    const markCell = (index: number, mark: CellHighlight) =>
      highlights.set(index, { ...highlights.get(index), ...mark });
    if (pathResult?.found) {
      // The shortest path: every pull's starting cell, the cells a 10-pull goes
      // through, and where it ends
      pathResult.steps.forEach((step, i) => {
        const inMultiCol =
          step.kind === "multi" &&
          !step.banner &&
          (!!gacha.guaranteed || medamaActive(gacha, initialState));
        const key = inMultiCol ? "multiStepNumbers" : "stepNumbers";
        markCell(step.index, {
          [key]: [...(highlights.get(step.index)?.[key] || []), i + 1],
        });
      });
      for (const step of pathResult.steps) {
        if (step.banner) {
          const r = step.outcome.results[step.outcome.results.length - 1];
          markCell(step.index, {
            inPath: true,
            luckyPull: {
              unit: r.unit,
              rerolled: r.rerolled,
              dest: step.index + step.outcome.consumed,
              dupeAction: step.dupeAction,
            },
          });
        } else if (step.kind === "single") {
          markCell(step.index, {
            inPath: true,
            usedDupe: step.outcome.results.some((r) => r.rerolled),
          });
        } else {
          markCell(step.index, { multiSelected: true });
          step.outcome.results.forEach((r, order) => {
            if (r.cellIndex !== undefined) {
              markCell(r.cellIndex, {
                pullOrder: [
                  ...(highlights.get(r.cellIndex)?.pullOrder || []),
                  { order: order + 1, text: rollText(r) },
                ],
              });
            }
          });
          for (const r of step.outcome.results) {
            if (r.cellIndex !== undefined) {
              markCell(r.cellIndex, {
                inPath: true,
                usedDupe: highlights.get(r.cellIndex)?.usedDupe || r.rerolled,
                isGuaranteedStep:
                  highlights.get(r.cellIndex)?.isGuaranteedStep ||
                  r.isGuaranteed,
              });
            }
          }
        }
      }
      markCell(pathResult.endIndex, { inPath: true, isLanding: true });
    } else if (selectedPull) {
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
          chosen.outcome.results.forEach((r, order) => {
            if (r.cellIndex !== undefined) {
              const prev = highlights.get(r.cellIndex) || {};
              highlights.set(r.cellIndex, {
                ...prev,
                pullOrder: [
                  ...(prev.pullOrder || []),
                  { order: order + 1, text: rollText(r) },
                ],
              });
            }
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
    return highlights;
  }, [cells, pathResult, selectedPull]);

  // 아이템 검색: where each picked item comes out within the rows shown, as a
  // single pull (with "R" when it's the dupe reroll result shown in the cell)
  // and, separately, as the guaranteed character of a single pull
  const findUnits = getQueryParam("evFind").split(",").filter(Boolean);
  const findKey = findUnits.join(",");
  const findFound = useMemo(() => {
    const colors = new Map<number, string>();
    const items = findUnits.map((unit, findIndex) => {
      const color = findColor(findIndex);
      const positions: { label: string; index: number }[] = [];
      const guaranteedPositions: { label: string; index: number }[] = [];
      const lastIndex = numRolls * trackCount + trackCount - 1;
      for (let index = 1; index <= lastIndex; index++) {
        const cell = cells.get(index);
        if (!cell || Math.floor((index - 1) / trackCount) >= numRolls) {
          continue;
        }
        const has = (destination?: Destination) =>
          !!destination &&
          destination.outcome.results.some((r) => r.unit === unit);
        if (has(cell.plain)) {
          positions.push({ label: cell.label, index });
          colors.set(index, colors.get(index) || color);
        }
        if (cell.showDupe && has(cell.dupe)) {
          positions.push({ label: `${cell.label}R`, index });
          colors.set(index, colors.get(index) || color);
        }
        if (has(cell.guaranteed)) {
          guaranteedPositions.push({ label: cell.label, index });
        }
      }
      return { unit, color, positions, guaranteedPositions };
    });
    return { items, colors };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, findKey, numRolls, trackCount]);

  const findOptions = [
    ...new Set([
      ...gacha.pools.flatMap((pool) => pool.units),
      ...(gacha.medama ? [MEDAMA] : []),
    ]),
  ].filter((unit) => !findUnits.includes(unit));

  const scrollToCell = (index: number) =>
    document
      .getElementById(eventCellId(index))
      ?.scrollIntoView({ block: "center", inline: "nearest" });

  // At most this many positions are listed per line; the rest are counted
  const FIND_LIST_LIMIT = 100;
  const renderPositions = (positions: { label: string; index: number }[]) => (
    <>
      {positions.slice(0, FIND_LIST_LIMIT).map(({ label, index }, i) => (
        <React.Fragment key={label}>
          {i > 0 && ", "}
          <PositionLink type="button" onClick={() => scrollToCell(index)}>
            {label}
          </PositionLink>
        </React.Fragment>
      ))}
      {positions.length > FIND_LIST_LIMIT &&
        ` …외 ${positions.length - FIND_LIST_LIMIT}개`}
    </>
  );

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
        const suffix = r.isGuaranteed ? " (확정)" : r.rerolled ? " (중복)" : "";
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

  // The browser's own tooltip: the table has thousands of cells, and a tooltip
  // component per cell made rendering it far slower
  const wrapTooltip = (
    title: string | undefined,
    children: React.ReactElement
  ) => (title ? React.cloneElement(children, { title }) : children);

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
    setPathResult(null);
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
      ? `중복 시: ${resultText(cell.dupe.outcome)} → ${destLabel(
          cell.dupe.dest
        )}`
      : undefined;
    const hl = highlights.get(cell.index);
    const bgImage = highlightBackground(hl);
    const showDupeLine = (cell.showDupe || hl?.usedDupe) && cell.dupe;
    const foundColor = findFound.colors.get(cell.index);
    return (
      <React.Fragment key={cell.index}>
        <td rowSpan={trackCount}>{cell.label}</td>
        {wrapTooltip(
          singleTooltip,
          <td
            id={eventCellId(cell.index)}
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
              backgroundImage: bgImage,
              cursor: "pointer",
              borderBottom:
                cell.dupe && !showDupeLine ? "1px dotted #1976d2" : undefined,
              // Items picked in 아이템 검색: light green fill, outlined in
              // the item's color
              backgroundColor: foundColor ? FOUND_FILL : background,
              boxShadow: foundColor
                ? `inset 0 0 0 3px ${foundColor}`
                : undefined,
              fontWeight: foundColor ? "bold" : undefined,
            }}
          >
            <div
              style={{
                opacity: hl?.inPath && !hl.isLanding && hl.usedDupe ? 0.55 : 1,
              }}
            >
              {stepBadges(hl?.stepNumbers)}
              <a href={hrefFor(cell.plain)}>{resultText(cell.plain.outcome)}</a>
              {jumps && ` → ${destLabel(cell.plain.dest)}`}
            </div>
            {orderLines(hl?.pullOrder)}
            {showDupeLine && cell.dupe && (
              <div
                style={{
                  fontWeight: hl?.usedDupe ? "bold" : undefined,
                  fontSize: "11px",
                }}
              >
                <a href={hrefFor(cell.dupe)}>
                  ({resultText(cell.dupe.outcome)} → {destLabel(cell.dupe.dest)}
                  )
                </a>
              </div>
            )}
            {hl?.luckyPull && (
              <div
                style={{
                  fontWeight: "bold",
                  color:
                    hl.luckyPull.dupeAction === "avoid" ? "#1b5e20" : "#bf360c",
                  fontSize: "0.9em",
                }}
              >
                {hl.luckyPull.dupeAction === "avoid"
                  ? "[럭티 중복 회피]"
                  : `[럭티 열이동: ${unitKo(hl.luckyPull.unit)} 먼저 뽑기]`}
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
        {/* Keep the columns lined up where there's no 10-pull */}
        {hasMultiCol && !cell.multi && <td rowSpan={trackCount} />}
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
                {stepBadges(hl?.multiStepNumbers)}
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
                      fontSize: "11px",
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
  // starts t seeds later. Only rebuilt when the table or its highlights
  // change, not on every re-render of the page (e.g. path search progress).
  const rows = useMemo(() => {
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
      rows.push(
        <tr
          key={index}
          style={{ height: CELL_HEIGHT[trackCount] / trackCount }}
        >
          {tds}
        </tr>
      );
    }
    return rows;
    // renderCell reads only these (plus values derived from the URL)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, highlights, selectedPull, trackCount, numRolls, findFound]);

  // Changing the event resets everything that depends on it
  const switchEvent = (key: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set("ev", key);
    ["evLast", "evGuar", "evStock", "evMedama", "evMulti"].forEach((k) =>
      params.delete(k)
    );
    window.location.href = `?${params.toString()}#/event`;
  };

  // Event characters that can be picked as shortest path targets, plus the
  // special item while any is left
  const pathCharacters = [
    ...new Set(
      gacha.pools.filter((p) => p.color === "special").flatMap((p) => p.units)
    ),
    ...(initialState.medamaStock > 0 ? [MEDAMA] : []),
  ];
  // Most of one target a path can ask for
  const maxPathCount = (unit: string) =>
    unit === MEDAMA ? Math.min(10, initialState.medamaStock) : 10;
  const pathTargets = pathCharacters
    .filter((unit) => (pathCounts[unit] || 0) > 0)
    .map((unit) => ({ unit, count: pathCounts[unit] }));

  // Every event character a path actually rolls (targets can come out more
  // often than asked), targets first in the order picked
  const pathCharactersRolled = (steps: PathStep[]) => {
    const counts = new Map<string, number>();
    for (const step of steps) {
      for (const result of step.outcome.results) {
        if (pathCharacters.includes(result.unit)) {
          counts.set(result.unit, (counts.get(result.unit) || 0) + 1);
        }
      }
    }
    return pathCharacters
      .filter((unit) => counts.has(unit))
      .map((unit) => ({
        unit,
        count: counts.get(unit)!,
        goal: pathTargets.find((t) => t.unit === unit)?.count,
      }))
      .sort((a, b) => (b.goal ? 1 : 0) - (a.goal ? 1 : 0));
  };

  // e.g. "이벤트 티켓 13장 (단발 3번 · 10연 1번)"
  const ticketSummary = (steps: PathStep[], tickets: number) => {
    const singles = steps.filter(
      (s) => !s.banner && s.kind === "single"
    ).length;
    const multis = steps.filter((s) => !s.banner && s.kind === "multi").length;
    const luckySteps = steps.filter((s) => s.banner);
    const luckyCreates = luckySteps.filter(
      (s) => s.dupeAction !== "avoid"
    ).length;
    const luckyAvoids = luckySteps.filter(
      (s) => s.dupeAction === "avoid"
    ).length;
    let luckyDesc = "";
    if (luckySteps.length > 0) {
      const parts = [];
      if (luckyCreates > 0) parts.push(`열이동 ${luckyCreates}번`);
      if (luckyAvoids > 0) parts.push(`중복 회피 ${luckyAvoids}번`);
      luckyDesc = ` + 럭키티켓 ${luckySteps.length}장 (${parts.join(" · ")})`;
    }
    return `이벤트 티켓 ${tickets}장 (단발 ${singles}번 · ${MULTI_ROLL_NUM}연 ${multis}번)${luckyDesc}`;
  };

  return (
    <>
      <Typography variant="h4">
        이벤트 뽑기 배열 <a href="#credits">[크레딧]</a>
      </Typography>
      <div style={{ display: "flex", gap: "6px", margin: "4px 0" }}>
        <button type="button" onClick={() => (window.location.hash = "#/")}>
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
          <strong>확정 뽑기</strong>: 확정 캐릭터가 포함된 연뽑은 첫 시드를 확정
          캐릭터의 등급을 정하는 데 먼저 쓰고 시작합니다. 그래서 단일 뽑기를
          여러 번 하는 것과 연뽑의 결과가 다릅니다.
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
              도착 위치(빗금)가 하이라이트됩니다(첫 칸이 중복 가능한 칸이면 한
              번 더 클릭해 첫 칸 중복 경로도 볼 수 있습니다).
            </li>
            <li>
              <strong>일반열</strong>에서 중복 재추첨이 일어날 수 있는 칸에
              마우스를 올리면 중복 시 무엇이 나오고 어디로 이동하는지
              표시됩니다.
            </li>
          </ul>
        </li>
        <li>
          <strong>특별 아이템</strong>(다운로드 기념 등의 한정 보상)이 남아 있는
          뽑기는 뽑기마다 특별 아이템 당첨을 정하는 시드를 하나 더 써서
          A·B·C열이 됩니다.
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
              특별 아이템이 나오는 위치는 알 수 있지만, 특별 아이템 안에서
              무엇이 나올지는 알 수 없습니다.
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
        <button
          type="button"
          onClick={() => setQueryParam("evSeed", seedInput)}
        >
          업데이트
        </button>
      </div>
      {gacha.guaranteed && (
        <>
          <Typography variant="subtitle2">확정까지 남은 횟수</Typography>
          <div style={{ marginBottom: "4px" }}>
            <select
              value={initialState.guaranteedLeft || gacha.guaranteed.step}
              onChange={(event) => setQueryParam("evGuar", event.target.value)}
            >
              {Array.from(
                { length: gacha.guaranteed.step },
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
      <Typography variant="h6">
        최단 경로 찾기{" "}
        <span style={{ color: "#e65100", fontSize: "0.7em" }}>(베타)</span>
      </Typography>
      <PathBox>
        <div style={{ marginBottom: "6px", color: "#555" }}>
          원하는 이벤트 캐릭터와 개수를 고르면, 지금 위치(1A)와 설정에서 시작해{" "}
          <strong>이벤트 티켓</strong>을 가장 적게 쓰는 경로를 찾습니다. 이벤트
          뽑기는 단발과 {MULTI_ROLL_NUM}연만 섞어서 쓰고(위의 연뽑 횟수 설정과
          상관없음), 확정으로 나오는 캐릭터도 개수에 포함합니다. 뽑기 횟수(
          {numRolls}행) 안에서만 찾습니다.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
          {pathCharacters.map((unit) => (
            <label
              key={unit}
              style={{ display: "flex", alignItems: "center", gap: "4px" }}
            >
              {unitKo(unit)}
              <select
                value={pathCounts[unit] || 0}
                onChange={(event) =>
                  setPathCounts((prev) => ({
                    ...prev,
                    [unit]: parseInt(event.target.value, 10),
                  }))
                }
              >
                {Array.from(
                  { length: maxPathCount(unit) + 1 },
                  (_, count) => count
                ).map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div style={{ marginTop: "8px" }}>
          <label style={{ marginRight: "12px" }}>
            <input
              type="radio"
              checked={pathBudget === null}
              onChange={() => setPathBudget(null)}
            />
            목표를 모두 얻는 최소 이벤트 티켓
          </label>
          <label>
            <input
              type="radio"
              checked={pathBudget !== null}
              onChange={() => setPathBudget(30)}
            />
            이벤트 티켓{" "}
            <input
              type="number"
              min={1}
              max={999}
              style={{ width: "56px" }}
              value={pathBudget ?? 30}
              disabled={pathBudget === null}
              onChange={(event) =>
                setPathBudget(
                  Math.max(1, parseInt(event.target.value, 10) || 1)
                )
              }
            />
            장 안에서 최대한 많이
          </label>
        </div>
        <div style={{ marginTop: "6px" }}>
          <label
            style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
          >
            <input
              type="checkbox"
              checked={useLuckyTickets}
              onChange={(e) => setUseLuckyTickets(e.target.checked)}
            />
            럭키티켓 섞어서 열이동 유도 / 중복 회피
          </label>
        </div>
        <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
          <button
            type="button"
            disabled={pathTargets.length === 0 || pathComputing}
            onClick={() => {
              setSelectedPull(null);
              setPathResult(null);
              setPathProgress(null);
              setPathComputing(true);
              // The search runs in a worker so the page doesn't freeze
              stopPathWorker();
              const worker = new Worker(
                new URL("./eventPathFinderWorker.ts", import.meta.url)
              );
              pathWorkerRef.current = worker;
              worker.onmessage = (event: {
                data:
                  | { type: "progress"; tickets: number; states: number }
                  | { type: "result"; result: PathResult };
              }) => {
                if (event.data.type === "progress") {
                  setPathProgress(event.data.tickets);
                } else {
                  setPathResult(event.data.result);
                  setPathComputing(false);
                  stopPathWorker();
                }
              };
              const request: PathFinderRequest = {
                gachaKey: gacha.key,
                seed,
                startState: initialState,
                targets: pathTargets,
                maxIndex: numRolls * trackCount + 1,
                // Paths use single pulls and full 10-pulls only, whatever the
                // table's multi-pull setting is
                multiCount: MULTI_ROLL_NUM,
                budget: pathBudget,
                useLuckyTickets,
              };
              worker.postMessage(request);
            }}
          >
            최단 경로 찾기
          </button>
          {pathComputing && (
            <button
              type="button"
              onClick={() => {
                stopPathWorker();
                setPathComputing(false);
              }}
            >
              계산 중지
            </button>
          )}
          {pathResult && (
            <button type="button" onClick={() => setPathResult(null)}>
              경로 지우기
            </button>
          )}
        </div>
        {pathComputing && (
          <div style={{ marginTop: "8px" }}>
            계산 중...
            {pathProgress !== null && ` (${pathProgress}장까지 확인)`}
          </div>
        )}
        {pathResult && !pathResult.found && (
          <div style={{ marginTop: "8px", color: "#b00020" }}>
            {pathResult.reason === "out-of-range"
              ? `뽑기 횟수(${numRolls}행) 안에서는 모두 뽑을 수 없습니다. 뽑기 횟수를 늘려 보세요.`
              : "경우의 수가 너무 많아 계산을 멈췄습니다. 목표 개수나 뽑기 횟수를 줄여 보세요."}
          </div>
        )}
        {pathResult?.found && (
          <div style={{ marginTop: "8px" }}>
            {!pathResult.complete && (
              <div>
                <strong>
                  이벤트 티켓 {pathBudget}장 안에서 최대{" "}
                  {pathResult.collected.reduce((a, b) => a + b, 0)}개
                </strong>
                {": "}
                {pathTargets
                  .map(
                    (t, i) =>
                      `${unitKo(t.unit)} ${pathResult.collected[i]}/${t.count}`
                  )
                  .join(", ")}
              </div>
            )}
            <strong>
              {ticketSummary(pathResult.steps, pathResult.tickets)}
            </strong>
            {" → "}마지막 위치 {destLabel(pathResult.endIndex)}
            {pathCharactersRolled(pathResult.steps).length > 0 && (
              <div>
                뽑히는 캐릭터:{" "}
                {pathCharactersRolled(pathResult.steps).map(
                  ({ unit, count, goal }, i) => (
                    <React.Fragment key={unit}>
                      {i > 0 && ", "}
                      {goal ? (
                        <strong style={{ color: "#b00020" }}>
                          {unitKo(unit)} {count}개 (목표 {goal})
                        </strong>
                      ) : (
                        `${unitKo(unit)} ${count}개`
                      )}
                    </React.Fragment>
                  )
                )}
              </div>
            )}
            {pathResult.checkedUpTo !== undefined && (
              <div style={{ color: "#b00020" }}>
                경우의 수가 많아 {pathResult.checkedUpTo}장까지만 끝까지
                확인했습니다. 그보다 많은 예산에서는 더 좋은 경로가 있을 수
                있습니다.
              </div>
            )}
            {pathResult.steps.length === 0 && (
              <div>예산 안에서는 목표 캐릭터를 얻을 수 없습니다.</div>
            )}
            <ol style={{ margin: "4px 0 0", paddingLeft: "24px" }}>
              {pathResult.steps.map((step, i) => (
                <li key={i}>
                  {labelFor(step.index, trackCount)}{" "}
                  {step.banner ? (
                    <strong
                      style={{
                        color:
                          step.dupeAction === "avoid" ? "#2e7d32" : "#e65100",
                      }}
                    >
                      {step.dupeAction === "avoid"
                        ? "럭키티켓 (중복 회피): "
                        : "럭키티켓 (열이동 유도): "}
                    </strong>
                  ) : step.kind === "single" ? (
                    "단발: "
                  ) : (
                    `${MULTI_ROLL_NUM}연: `
                  )}
                  {step.banner ? (
                    <span>
                      {step.dupeAction === "avoid"
                        ? "다른 아이템 먼저 뽑아서 중복 방지"
                        : `${unitKo(
                            step.outcome.results[0].unit
                          )} 먼저 뽑아서 ${labelFor(
                            step.index,
                            trackCount
                          )} 중복 열이동`}
                    </span>
                  ) : (
                    step.outcome.results.map((r, j) => (
                      <React.Fragment key={j}>
                        {j > 0 && ", "}
                        <span
                          style={{
                            fontWeight: pathTargets.some(
                              (t) => t.unit === r.unit
                            )
                              ? "bold"
                              : undefined,
                            color: pathTargets.some((t) => t.unit === r.unit)
                              ? "#b00020"
                              : undefined,
                          }}
                        >
                          {r.isMedama ? "특별 아이템" : unitKo(r.unit)}
                          {r.isGuaranteed
                            ? "(확정)"
                            : r.rerolled
                            ? "(중복)"
                            : ""}
                        </span>
                      </React.Fragment>
                    ))
                  )}
                </li>
              ))}
            </ol>
            <div style={{ color: "#555" }}>
              표에서 경로가 하이라이트되고, 마지막 위치는 빗금으로 표시됩니다.
            </div>
          </div>
        )}
      </PathBox>
      <Typography variant="subtitle2">아이템 검색</Typography>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "6px",
          marginBottom: "4px",
        }}
      >
        <select
          style={{ maxWidth: "300px" }}
          value=""
          onChange={(event) => {
            if (event.target.value) {
              setQueryParam(
                "evFind",
                [...findUnits, event.target.value].join(",")
              );
            }
          }}
        >
          <option value="">-- 찾을 아이템 추가 --</option>
          {findOptions.map((unit) => (
            <option key={unit} value={unit}>
              {unit === MEDAMA ? "특별 아이템" : unitKo(unit)}
            </option>
          ))}
        </select>
        {findUnits.map((unit, findIndex) => (
          <FindChip key={unit}>
            <Swatch color={findColor(findIndex)} />
            {unit === MEDAMA ? "특별 아이템" : unitKo(unit)}
            <button
              type="button"
              title="빼기"
              onClick={() =>
                setQueryParam(
                  "evFind",
                  findUnits.filter((findUnit) => findUnit !== unit).join(",")
                )
              }
            >
              ×
            </button>
          </FindChip>
        ))}
        {findUnits.length > 1 && (
          <button type="button" onClick={() => setQueryParam("evFind", "")}>
            모두 지우기
          </button>
        )}
      </div>
      {findFound.items.length > 0 && (
        <ul style={{ marginBottom: "8px" }}>
          {findFound.items.map(
            ({ unit, color, positions, guaranteedPositions }) => (
              <li key={unit} style={{ marginBottom: "4px" }}>
                <Swatch color={color} />
                <strong>
                  {unit === MEDAMA ? "특별 아이템" : unitKo(unit)}
                </strong>
                {" · "}
                {positions.length}회
                {positions.length === 0
                  ? ` — ${numRolls}번 안에 없습니다.`
                  : ": "}
                {renderPositions(positions)}
                {guaranteedPositions.length > 0 && (
                  <div style={{ color: "#555" }}>
                    확정이면 {guaranteedPositions.length}곳:{" "}
                    {renderPositions(guaranteedPositions)}
                  </div>
                )}
              </li>
            )
          )}
          <li style={{ listStyle: "none", color: "#555" }}>
            R은 직전 뽑기와 중복되어 재추첨될 때 나오는 경우입니다. 위치를
            클릭하면 해당 칸으로 이동합니다.
          </li>
        </ul>
      )}
      <Table
        cellSpacing={0}
        style={{
          width:
            trackCount *
            (COL_WIDTHS.label +
              COL_WIDTHS.single +
              (hasMultiCol ? COL_WIDTHS.multi : 0)),
        }}
      >
        <colgroup>
          {TRACKS.slice(0, trackCount).map((track) => (
            <React.Fragment key={track}>
              <col style={{ width: COL_WIDTHS.label }} />
              <col style={{ width: COL_WIDTHS.single }} />
              {hasMultiCol && <col style={{ width: COL_WIDTHS.multi }} />}
            </React.Fragment>
          ))}
        </colgroup>
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
                          (남은{" "}
                          {initialState.guaranteedLeft ?? gacha.guaranteed.step}
                          회)
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
