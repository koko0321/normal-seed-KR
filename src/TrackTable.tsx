import React, { useMemo } from "react";
import { BannerTrackRolls, FOUND_FILL, cellElementId } from "./RollTable";
import styled from "@emotion/styled";
import { Roll } from "./utils/seed";
import { bannerKo, unitKo } from "./utils/i18n";
import { BLUE_ORBS, PATH_COLOR } from "./utils/normalPathFinder";

const BLUE_ORB_SET = new Set<string>(BLUE_ORBS);

const zip = (arr: Roll[][]): Roll[][] => {
  if (arr.length === 0) {
    return [];
  }
  const len = Math.min(...arr.map((a) => a.length));
  const out: Roll[][] = new Array(len);
  for (let i = 0; i < len; i++) {
    const row: Roll[] = new Array(arr.length);
    for (let j = 0; j < arr.length; j++) {
      row[j] = arr[j][i];
    }
    out[i] = row;
  }
  return out;
};

const Table = styled.table`
  border-collapse: collapse;
  th {
    border: 1px solid black;
    text-align: center;
    font-weight: bold;
  }
  td {
    white-space: nowrap;
    border: 1px solid black;
    text-align: center;
    cursor: pointer;
    padding: 0 8px;
    background-color: #eeeeee;
  }
  td.r-num {
    cursor: default;
  }
  td.spacer {
    cursor: default;
    background-color: #ffffff;
  }
  td.t {
    border-bottom: none;
  }
  td.b {
    border-top: none;
  }
  span.p-badge {
    display: inline-block;
    min-width: 14px;
    margin-right: 3px;
    padding: 0 2px;
    border-radius: 7px;
    background: ${PATH_COLOR};
    color: white;
    font-size: 11px;
    line-height: 14px;
  }
`;

const STATIC_BG_STYLES: Record<string, React.CSSProperties | undefined> = {
  "#FFFFFF": { backgroundColor: "#FFFFFF" },
  "#EEEEEE": undefined,
  "#c9e4ff": { backgroundColor: "#c9e4ff" },
  gold: { backgroundColor: "gold" },
  red: { backgroundColor: "red" },
  aqua: { backgroundColor: "aqua" },
};

const getBgColor = (
  rarity: number,
  unitName?: string,
  foundColor?: string
): string => {
  if (foundColor) {
    return FOUND_FILL;
  }
  if (unitName && BLUE_ORB_SET.has(unitName)) {
    return "#c9e4ff";
  }
  switch (rarity) {
    case 0:
      return "#FFFFFF";
    case 1:
      return "#EEEEEE";
    case 2:
      return "gold";
    case 3:
      return "red";
    case 4:
      return "aqua";
    default:
      return "#EEEEEE";
  }
};

const getCellStyle = (
  rarity: number,
  unitName: string | undefined,
  highlight: boolean | undefined,
  isLastHighlighted: boolean | undefined,
  foundColor: string | undefined,
  pathStep: number | undefined
): React.CSSProperties | undefined => {
  const bg = getBgColor(rarity, unitName, foundColor);
  if (!foundColor && !pathStep && !highlight) {
    return STATIC_BG_STYLES[bg];
  }
  const style: React.CSSProperties = {
    backgroundColor: bg,
  };
  if (foundColor) {
    style.boxShadow = `inset 0 0 0 3px ${foundColor}`;
    style.fontWeight = "bold";
  }
  if (pathStep) {
    style.outline = `3px solid ${PATH_COLOR}`;
    style.outlineOffset = "-3px";
    style.fontWeight = "bold";
  }
  if (highlight) {
    style.backgroundImage = isLastHighlighted
      ? "repeating-linear-gradient(90deg, #00000075 5px, #00000075 15px, #00000050 15px, #00000050 25px)"
      : "linear-gradient(#00000050, #00000050)";
  }
  return style;
};

// Hover text: what a dupe of the previous roll would give here, and where it
// leads
const dupeTitle = (unit: Roll) =>
  unit.unitIfDupe
    ? `중복 시: ${unitKo(unit.unitIfDupe.unitName)}${
        unit.dupeTargetCellId ? ` → ${unit.dupeTargetCellId}` : ""
      }`
    : undefined;

const makeRollHref = (
  baseQuery: string,
  seed: number | undefined,
  lastCat: string | undefined
) =>
  `?${baseQuery ? `${baseQuery}&` : ""}seed=${
    seed ?? ""
  }&lastCat=${encodeURIComponent(lastCat ?? "")}`;

type TrackRowPairProps = {
  rowIndex: number;
  track: "A" | "B";
  row: Roll[];
  bannerShortNames: string[];
  baseQuery: string;
  onSelect: (selected: string) => void;
};

const TrackRowPair = React.memo(
  ({
    rowIndex,
    track,
    row,
    bannerShortNames,
    baseQuery,
    onSelect,
  }: TrackRowPairProps) => {
    const rowNum = rowIndex + 1;
    const cellCoord = `${rowNum}${track}`;
    return (
      <>
        <tr>
          <td rowSpan={2} className="r-num">
            {cellCoord}
          </td>
          {row.map((unit: Roll, j) => {
            const showDupe = !!unit.dupeInfo?.showDupe;
            const bannerShort = bannerShortNames[j];
            const topStyle = getCellStyle(
              unit.rarity,
              unit.unitIfDistinct.unitName,
              unit.highlight?.top,
              unit.highlight?.isLast,
              unit.found?.top,
              unit.pathStep?.top
            );
            return (
              <td
                key={j}
                className="t"
                title={dupeTitle(unit)}
                id={cellElementId(bannerShort, cellCoord)}
                style={topStyle}
                onClick={(e) => {
                  if ((e.target as Node).nodeName === "A") {
                    return;
                  }
                  onSelect(`c,${unit.raritySeed},${bannerShort}`);
                }}
              >
                {unit.pathStep?.top && (
                  <span className="p-badge">{unit.pathStep.top}</span>
                )}
                {showDupe ? (
                  <a
                    href={makeRollHref(
                      baseQuery,
                      unit.unitIfDistinct.unitSeed,
                      unit.unitIfDistinct.unitName
                    )}
                  >
                    {unitKo(unit.unitIfDistinct.unitName)}
                  </a>
                ) : (
                  "\u00A0"
                )}
              </td>
            );
          })}
        </tr>
        <tr>
          {row.map((unit: Roll, j) => {
            const showDupe = !!unit.dupeInfo?.showDupe;
            const bannerShort = bannerShortNames[j];
            const bottomUnitName = showDupe
              ? unit.unitIfDupe?.unitName
              : unit.unitIfDistinct.unitName;
            const bottomStyle = getCellStyle(
              unit.rarity,
              bottomUnitName,
              unit.highlight?.bottom,
              unit.highlight?.isLast,
              unit.found?.bottom,
              unit.pathStep?.bottom
            );
            return (
              <td
                key={j}
                className="b"
                title={dupeTitle(unit)}
                style={bottomStyle}
                onClick={(e) => {
                  if ((e.target as Node).nodeName === "A") {
                    return;
                  }
                  onSelect(
                    `${showDupe ? "r" : "c"},${unit.raritySeed},${bannerShort}`
                  );
                }}
              >
                {unit.pathStep?.bottom && (
                  <span className="p-badge">{unit.pathStep.bottom}</span>
                )}
                {showDupe ? (
                  <a
                    href={makeRollHref(
                      baseQuery,
                      unit.unitIfDupe?.unitSeed,
                      unit.unitIfDupe?.unitName
                    )}
                  >
                    {track === "A"
                      ? `${unitKo(unit.unitIfDupe?.unitName)} -> ${
                          unit.dupeInfo?.targetCellId
                        }${unit.dupeInfo?.targetWillRerollAgain ? "R" : ""}`
                      : `<- ${unit.dupeInfo?.targetCellId}${
                          unit.dupeInfo?.targetWillRerollAgain ? "R" : ""
                        } ${unitKo(unit.unitIfDupe?.unitName)}`}
                  </a>
                ) : (
                  <a
                    href={makeRollHref(
                      baseQuery,
                      unit.unitIfDistinct.unitSeed,
                      unit.unitIfDistinct.unitName
                    )}
                  >
                    {unitKo(unit.unitIfDistinct.unitName)}
                  </a>
                )}
                {unit.eventDupeInfo && (
                  <div
                    style={{
                      fontWeight: "bold",
                      color: "#e65100",
                      fontSize: "0.85em",
                      marginTop: "2px",
                      lineHeight: "1.2",
                    }}
                  >
                    [이벤트뽑 열이동: {unitKo(unit.eventDupeInfo.unitName)} 먼저 뽑기]
                  </div>
                )}
              </td>
            );
          })}
        </tr>
      </>
    );
  },
  (prev, next) => {
    if (
      prev.rowIndex !== next.rowIndex ||
      prev.track !== next.track ||
      prev.baseQuery !== next.baseQuery ||
      prev.onSelect !== next.onSelect ||
      prev.row.length !== next.row.length
    ) {
      return false;
    }
    for (let j = 0; j < prev.row.length; j++) {
      if (
        prev.row[j] !== next.row[j] ||
        prev.bannerShortNames[j] !== next.bannerShortNames[j]
      ) {
        return false;
      }
    }
    return true;
  }
);

const TrackTable = ({
  rolls,
  track,
  onSelect,
}: {
  rolls: BannerTrackRolls[];
  track: "A" | "B";
  onSelect: (selected: string) => void;
}) => {
  const zippedRolls = useMemo(
    () => zip(rolls.map((roll) => roll.track)),
    [rolls]
  );
  const bannerShortNames = useMemo(
    () => rolls.map((roll) => roll.bannerShortName),
    [rolls]
  );
  const baseQuery = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    params.delete("seed");
    params.delete("lastCat");
    return params.toString();
  }, [rolls]);

  return (
    <Table cellSpacing={0}>
      <thead>
        <tr>
          <th>#</th>
          {rolls.map((roll) => (
            <th key={roll.bannerName}>{bannerKo(roll.bannerName)}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {track === "B" && (
          <tr>
            <td className="spacer" colSpan={rolls.length + 1}>
              &nbsp;
            </td>
          </tr>
        )}
        {zippedRolls.map((row, i) => (
          <TrackRowPair
            key={i}
            rowIndex={i}
            track={track}
            row={row}
            bannerShortNames={bannerShortNames}
            baseQuery={baseQuery}
            onSelect={onSelect}
          />
        ))}
        {track === "A" && (
          <tr>
            <td className="spacer" colSpan={rolls.length + 1}>
              &nbsp;
            </td>
          </tr>
        )}
      </tbody>
    </Table>
  );
};

export default React.memo(TrackTable);
