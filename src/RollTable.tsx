import React, { useCallback, useMemo, useState } from "react";
import { Roll, advanceSeed, generateAllRolls } from "./utils/seed";
import TrackTable from "./TrackTable";
import styled from "@emotion/styled";
import { getQueryParam } from "./utils/queryParams";
import { AllBanners } from "./utils/bannerData";
import { bannerKo, normalizeLastCat, unitKo } from "./utils/i18n";
import { NormalPathStep } from "./utils/normalPathFinder";

export type BannerTrackRolls = {
  bannerName: string;
  bannerShortName: string;
  track: Roll[];
};

type FoundPosition = {
  sequence: number;
  trackLetter: "A" | "B";
  label: string;
};

// Items picked in "find", in the order they were added
export const getFindUnits = () =>
  getQueryParam("find").split(",").filter(Boolean);

// Each picked item gets its own outline color, avoiding the rarity colors
const FIND_COLORS = ["#8e24aa", "#1565c0", "#2e7d32", "#ef6c00", "#c2185b"];
export const findColor = (findIndex: number) =>
  FIND_COLORS[findIndex % FIND_COLORS.length];

// Background of cells holding a searched item (the outline keeps the item's
// own color). Light purple, to stand apart from the event page's light green
// special item cells.
export const FOUND_FILL = "#e1bee7";

export const cellElementId = (bannerShortName: string, cellId: string) =>
  `cell-${bannerShortName}-${cellId}`;

const Container = styled.div`
  display: flex;
  flex-direction: row;
`;

const FindList = styled.ul`
  margin-bottom: 8px;
  li {
    margin-bottom: 4px;
  }
  strong {
    font-weight: bold;
  }
`;

export const Swatch = styled.span<{ color: string }>`
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 4px;
  border: 3px solid ${(props) => props.color};
  vertical-align: middle;
`;

const PositionLink = styled.button`
  padding: 0;
  border: none;
  background: none;
  color: #0000ee;
  text-decoration: underline;
  cursor: pointer;
`;

const NUM_ROLLS_BUFFER = 10;

const RollTable = ({
  path,
  findUnits: findUnitsProp,
}: {
  path: NormalPathStep[] | null;
  findUnits?: string[];
}) => {
  const initialSeed = parseInt(getQueryParam("seed"), 10);
  const numRolls = parseInt(getQueryParam("rolls"), 10);
  const bannersParam = getQueryParam("banners");
  const lastCatFromQueryParams = normalizeLastCat(getQueryParam("lastCat"));

  const [selectedParam, setSelectedParam] = useState(() =>
    getQueryParam("selected")
  );

  const handleSelect = useCallback((clicked: string) => {
    setSelectedParam((prev) => {
      const next = prev === clicked ? "" : clicked;
      const urlParams = new URLSearchParams(window.location.search);
      if (next) {
        urlParams.set("selected", next);
      } else {
        urlParams.delete("selected");
      }
      const qs = urlParams.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`
      );
      return next;
    });
  }, []);

  // Memoize base roll generation and dupe track switch calculation
  const baseAllRolls = useMemo(() => {
    const generated = generateAllRolls(
      initialSeed,
      numRolls + NUM_ROLLS_BUFFER
    );
    return generated.map(({ bannerName, bannerShortName, trackA, trackB }) => {
      // O(1) lookup map by raritySeed
      const cellBySeed = new Map<
        number,
        { roll: Roll; id: string; track: "A" | "B"; index: number }
      >();
      trackA.forEach((roll, i) =>
        cellBySeed.set(roll.raritySeed, {
          roll,
          id: `${i + 1}A`,
          track: "A",
          index: i,
        })
      );
      trackB.forEach((roll, i) =>
        cellBySeed.set(roll.raritySeed, {
          roll,
          id: `${i + 1}B`,
          track: "B",
          index: i,
        })
      );

      const cellsWithDupeTrackSwitches: number[] = [];
      const findCellsWithDupeTrackSwitches = (
        lastCat: string,
        track: Roll[]
      ) => {
        for (let i = 0; i < track.length; i++) {
          const roll = track[i];
          if (roll.unitIfDupe && roll.unitIfDistinct.unitName === lastCat) {
            cellsWithDupeTrackSwitches.push(roll.raritySeed);
          }
          lastCat = roll.unitIfDistinct.unitName;
        }
      };
      findCellsWithDupeTrackSwitches(lastCatFromQueryParams, trackA);
      findCellsWithDupeTrackSwitches("", trackB);

      cellsWithDupeTrackSwitches.forEach((raritySeed) => {
        let sourceEntry = cellBySeed.get(raritySeed);
        if (!sourceEntry) {
          return;
        }
        let sourceCell = sourceEntry.roll;
        let prevUnit = sourceCell.unitIfDistinct.unitName;
        while (
          sourceCell.unitIfDupe?.unitName &&
          sourceCell.unitIfDistinct.unitName === prevUnit
        ) {
          prevUnit = sourceCell.unitIfDupe.unitName;
          const destinationRaritySeed = advanceSeed(
            sourceCell.unitIfDupe.unitSeed
          );
          const destEntry = cellBySeed.get(destinationRaritySeed);
          if (!destEntry) {
            break;
          }
          sourceCell.dupeInfo = {
            showDupe: true,
            targetCellId: destEntry.id,
            targetWillRerollAgain:
              sourceCell.unitIfDupe.unitName ===
              destEntry.roll.unitIfDistinct.unitName,
          };
          sourceCell = destEntry.roll;
        }
      });

      for (let i = 0; i < trackA.length; i++) {
        const roll = trackA[i];
        if (roll.unitIfDupe) {
          roll.dupeTargetCellId = cellBySeed.get(
            advanceSeed(roll.unitIfDupe.unitSeed)
          )?.id;
        }
      }
      for (let i = 0; i < trackB.length; i++) {
        const roll = trackB[i];
        if (roll.unitIfDupe) {
          roll.dupeTargetCellId = cellBySeed.get(
            advanceSeed(roll.unitIfDupe.unitSeed)
          )?.id;
        }
      }

      return { bannerName, bannerShortName, trackA, trackB, cellBySeed };
    });
  }, [initialSeed, numRolls, bannersParam, lastCatFromQueryParams]);

  const activeFindUnits = useMemo(
    () => findUnitsProp ?? getFindUnits(),
    [findUnitsProp]
  );

  // Apply overlays (10-pull highlight, optimal path, find items) immutably so
  // unchanged rows keep their exact Roll object references for React.memo
  const { trackARolls, trackBRolls, findResults } = useMemo(() => {
    const banners = baseAllRolls.map(
      ({ bannerName, bannerShortName, trackA, trackB, cellBySeed }) => ({
        bannerName,
        bannerShortName,
        baseTrackA: trackA,
        baseTrackB: trackB,
        trackA: trackA.slice(0, numRolls),
        trackB: trackB.slice(0, numRolls),
        clonedA: new Set<number>(),
        clonedB: new Set<number>(),
        cellBySeed,
      })
    );

    const getMutableRoll = (
      bObj: (typeof banners)[number],
      trackLetter: "A" | "B",
      index: number
    ): Roll | undefined => {
      if (index < 0 || index >= numRolls) {
        return undefined;
      }
      if (trackLetter === "A") {
        if (!bObj.clonedA.has(index)) {
          bObj.trackA[index] = { ...bObj.trackA[index] };
          bObj.clonedA.add(index);
        }
        return bObj.trackA[index];
      } else {
        if (!bObj.clonedB.has(index)) {
          bObj.trackB[index] = { ...bObj.trackB[index] };
          bObj.clonedB.add(index);
        }
        return bObj.trackB[index];
      }
    };

    const bannerByShort = new Map(
      banners.map((b) => [b.bannerShortName, b] as const)
    );

    // 1. Highlight the next 10 pulls from selected
    if (selectedParam) {
      const [selectedType, selectedSeedStr, selectedBanner] =
        selectedParam.split(",");
      const selectedSeed = parseInt(selectedSeedStr, 10);
      const selectedRolls = bannerByShort.get(selectedBanner);
      if (selectedRolls) {
        const startEntry = selectedRolls.cellBySeed.get(selectedSeed);
        const startingRoll = startEntry?.roll;
        const selectedRerollButStartingRollHasNone =
          selectedType === "r" && !startingRoll?.dupeInfo?.showDupe;

        if (
          startEntry &&
          startingRoll &&
          !selectedRerollButStartingRollHasNone
        ) {
          let prevUnit =
            selectedType === "c" ? "" : startingRoll.unitIfDistinct.unitName;
          let currentEntry = startEntry;
          for (let i = 0; i < 11; i++) {
            const currentRoll = currentEntry.roll;
            const mutable = getMutableRoll(
              selectedRolls,
              currentEntry.track,
              currentEntry.index
            );
            let destinationRaritySeed = 0;
            if (
              currentRoll.unitIfDistinct.unitName === prevUnit &&
              currentRoll.unitIfDupe
            ) {
              if (mutable) {
                mutable.highlight = {
                  top: false,
                  bottom: true,
                  isLast: i === 10 ? true : undefined,
                };
              }
              prevUnit = currentRoll.unitIfDupe.unitName;
              destinationRaritySeed = advanceSeed(
                currentRoll.unitIfDupe.unitSeed
              );
            } else {
              if (mutable) {
                mutable.highlight = {
                  top: true,
                  bottom: !currentRoll.dupeInfo?.showDupe,
                  isLast: i === 10 ? true : undefined,
                };
              }
              prevUnit = currentRoll.unitIfDistinct.unitName;
              destinationRaritySeed = advanceSeed(
                currentRoll.unitIfDistinct.unitSeed
              );
            }
            const nextEntry = selectedRolls.cellBySeed.get(
              destinationRaritySeed
            );
            if (!nextEntry) {
              break;
            }
            currentEntry = nextEntry;
          }
        }
      }
    }

    // 2. Mark the pulls of the best path on the half of the cell that shows them
    path?.forEach((step, i) => {
      const bObj = bannerByShort.get(step.bannerShortName);
      if (!bObj) {
        return;
      }
      const mutable = getMutableRoll(bObj, step.track, step.row);
      if (!mutable) {
        return;
      }
      const half = !step.dupe && mutable.dupeInfo?.showDupe ? "top" : "bottom";
      mutable.pathStep = { ...mutable.pathStep, [half]: i + 1 };
    });

    // 3. Find every position of the items picked in "find" within numRolls
    const computedFindResults = activeFindUnits.map((unitName, findIndex) => {
      const color = findColor(findIndex);
      const foundBanners = banners
        .filter(({ bannerShortName }) =>
          AllBanners.find(
            (banner) => banner.shortName === bannerShortName
          )?.pools.some((pool) => pool.units.includes(unitName))
        )
        .map((bObj) => {
          const { bannerName, bannerShortName, baseTrackA, baseTrackB } = bObj;
          const positions: FoundPosition[] = [];
          const scanTrack = (baseTrack: Roll[], trackLetter: "A" | "B") => {
            const limit = Math.min(numRolls, baseTrack.length);
            for (let i = 0; i < limit; i++) {
              const roll = baseTrack[i];
              const cellId = `${i + 1}${trackLetter}`;
              const showDupe = roll.dupeInfo?.showDupe;
              if (roll.unitIfDistinct.unitName === unitName) {
                const mutable = getMutableRoll(bObj, trackLetter, i);
                if (mutable) {
                  mutable.found = {
                    ...mutable.found,
                    [showDupe ? "top" : "bottom"]: color,
                  };
                }
                positions.push({
                  sequence: i + 1,
                  trackLetter,
                  label: cellId,
                });
              }
              if (showDupe && roll.unitIfDupe?.unitName === unitName) {
                const mutable = getMutableRoll(bObj, trackLetter, i);
                if (mutable) {
                  mutable.found = { ...mutable.found, bottom: color };
                }
                positions.push({
                  sequence: i + 1,
                  trackLetter,
                  label: `${cellId}R`,
                });
              }
            }
          };
          scanTrack(baseTrackA, "A");
          scanTrack(baseTrackB, "B");
          positions.sort(
            (a, b) =>
              a.sequence - b.sequence ||
              a.trackLetter.localeCompare(b.trackLetter)
          );
          return { bannerName, bannerShortName, positions };
        });
      return { unitName, color, banners: foundBanners };
    });

    return {
      trackARolls: banners.map((b) => ({
        bannerName: b.bannerName,
        bannerShortName: b.bannerShortName,
        track: b.trackA,
      })),
      trackBRolls: banners.map((b) => ({
        bannerName: b.bannerName,
        bannerShortName: b.bannerShortName,
        track: b.trackB,
      })),
      findResults: computedFindResults,
    };
  }, [baseAllRolls, numRolls, selectedParam, path, activeFindUnits]);

  return (
    <>
      {findResults.length > 0 && (
        <FindList>
          {findResults.map(({ unitName, color, banners }) => (
            <li key={unitName}>
              <Swatch color={color} />
              <strong>{unitKo(unitName)}</strong>
              {banners.length === 0 && " — 선택한 배너에 없는 아이템입니다."}
              {banners.map(({ bannerName, bannerShortName, positions }) => (
                <div key={bannerShortName}>
                  {bannerKo(bannerName)} · {positions.length}회
                  {positions.length === 0
                    ? ` — ${numRolls}번 안에 없습니다.`
                    : ": "}
                  {positions.map(({ label }, i) => (
                    <React.Fragment key={label}>
                      {i > 0 && ", "}
                      <PositionLink
                        type="button"
                        onClick={() =>
                          document
                            .getElementById(
                              cellElementId(
                                bannerShortName,
                                label.replace("R", "")
                              )
                            )
                            ?.scrollIntoView({ block: "center" })
                        }
                      >
                        {label}
                      </PositionLink>
                    </React.Fragment>
                  ))}
                </div>
              ))}
            </li>
          ))}
          <li style={{ listStyle: "none", color: "#555" }}>
            R은 직전 뽑기와 중복되어 재추첨될 때 나오는 경우입니다. 위치를
            클릭하면 해당 칸으로 이동합니다.
          </li>
        </FindList>
      )}
      <Container>
        <TrackTable rolls={trackARolls} track={"A"} onSelect={handleSelect} />
        <TrackTable rolls={trackBRolls} track={"B"} onSelect={handleSelect} />
      </Container>
    </>
  );
};

// Typing in the page's inputs re-renders the page; the table only changes
// with the path or findUnits
export default React.memo(RollTable);
