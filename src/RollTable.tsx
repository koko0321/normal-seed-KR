import React from "react";
import { Roll, advanceSeed, generateAllRolls } from "./utils/seed";
import TrackTable from "./TrackTable";
import styled from "@emotion/styled";
import { getQueryParam } from "./utils/queryParams";
import { AllBanners } from "./utils/bannerData";
import { bannerKo, unitKo } from "./utils/i18n";

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

const RollTable = () => {
  const initialSeed = parseInt(getQueryParam("seed"), 10);
  const numRolls = parseInt(getQueryParam("rolls"), 10);
  // Buffer so that track switches near the end of numRolls can be processed
  const NUM_ROLLS_BUFFER = 10;
  const lastCatFromQueryParams = getQueryParam("lastCat");
  const [selectedType, selectedSeedStr, selectedBanner] =
    getQueryParam("selected").split(",");
  const selectedSeed = parseInt(selectedSeedStr, 10);

  const allRolls = generateAllRolls(initialSeed, numRolls + NUM_ROLLS_BUFFER);
  // Augment roll data with dupe track switch data
  // For this processing we'll identify each cell by its raritySeed
  allRolls.forEach(({ trackA, trackB }) => {
    // Find all cells that should dupe track switch
    const cellsWithDupeTrackSwitches: number[] = [];
    const findCellsWithDupeTrackSwitches = (lastCat: string, track: Roll[]) => {
      track.forEach((roll) => {
        if (roll.unitIfDupe && roll.unitIfDistinct.unitName === lastCat) {
          cellsWithDupeTrackSwitches.push(roll.raritySeed);
        }
        lastCat = roll.unitIfDistinct.unitName;
      });
    };
    findCellsWithDupeTrackSwitches(lastCatFromQueryParams, trackA);
    findCellsWithDupeTrackSwitches("", trackB);

    // Process all cells that should dupe track switch
    cellsWithDupeTrackSwitches.forEach((raritySeed) => {
      const findCell = (raritySeed: number) =>
        trackA.find((roll) => roll.raritySeed === raritySeed) ||
        trackB.find((roll) => roll.raritySeed === raritySeed);
      const findCellId = (raritySeed: number) => {
        const trackAIndex = trackA.findIndex(
          (roll) => roll.raritySeed === raritySeed
        );
        if (trackAIndex >= 0) {
          return `${trackAIndex + 1}A`;
        }
        const trackBIndex = trackB.findIndex(
          (roll) => roll.raritySeed === raritySeed
        );
        return `${trackBIndex + 1}B`;
      };

      let sourceCell = findCell(raritySeed)!;
      let prevUnit = sourceCell.unitIfDistinct.unitName;
      while (sourceCell.unitIfDistinct.unitName === prevUnit) {
        prevUnit = sourceCell.unitIfDupe!.unitName;
        const destinationRaritySeed = advanceSeed(
          sourceCell.unitIfDupe!.unitSeed
        );
        const destinationCell = findCell(destinationRaritySeed);
        if (!destinationCell) {
          break;
        }
        sourceCell.dupeInfo = {
          showDupe: true,
          targetCellId: findCellId(destinationRaritySeed),
          targetWillRerollAgain:
            sourceCell.unitIfDupe!.unitName ===
            destinationCell.unitIfDistinct.unitName,
        };
        sourceCell = destinationCell;
      }
    });
  });

  // Highlight the next 10 pulls from selected
  if (selectedType) {
    const selectedRolls = allRolls.find(
      ({ bannerShortName }) => bannerShortName === selectedBanner
    );
    const findCell = (raritySeed: number) =>
      selectedRolls?.trackA.find((roll) => roll.raritySeed === raritySeed) ||
      selectedRolls?.trackB.find((roll) => roll.raritySeed === raritySeed);
    if (selectedRolls) {
      const startingRoll = findCell(selectedSeed);

      // Weird edge case where the reroll is somehow removed
      const selectedRerollButStartingRollHasNone =
        selectedType === "r" && !startingRoll?.dupeInfo?.showDupe;

      if (startingRoll && !selectedRerollButStartingRollHasNone) {
        // If selectedType = "r", force the unitIfDupe path
        let prevUnit =
          selectedType === "c" ? "" : startingRoll.unitIfDistinct.unitName;
        let currentRoll = startingRoll;
        for (let i = 0; i < 11; i++) {
          let destinationRaritySeed = 0;
          if (
            currentRoll.unitIfDistinct.unitName === prevUnit &&
            currentRoll.unitIfDupe
          ) {
            // Go down the reroll path
            currentRoll.highlight = {
              top: false,
              bottom: true,
            };
            prevUnit = currentRoll.unitIfDupe.unitName;
            destinationRaritySeed = advanceSeed(
              currentRoll.unitIfDupe.unitSeed
            );
          } else {
            // Go down the canonical path
            currentRoll.highlight = {
              top: true,
              bottom: !currentRoll.dupeInfo?.showDupe,
            };
            prevUnit = currentRoll.unitIfDistinct.unitName;
            destinationRaritySeed = advanceSeed(
              currentRoll.unitIfDistinct.unitSeed
            );
          }
          if (i === 10) {
            currentRoll.highlight.isLast = true;
          }
          const destination = findCell(destinationRaritySeed);
          if (!destination) {
            break;
          }
          currentRoll = destination;
        }
      }
    }
  }

  // Find every position of the items picked in "find" within numRolls, and
  // mark the half of the cell that shows it
  const findResults = getFindUnits().map((unitName, findIndex) => {
    const color = findColor(findIndex);
    const banners = allRolls
      .filter(({ bannerShortName }) =>
        AllBanners.find(
          (banner) => banner.shortName === bannerShortName
        )?.pools.some((pool) => pool.units.includes(unitName))
      )
      .map(({ bannerName, bannerShortName, trackA, trackB }) => {
        const positions: FoundPosition[] = [];
        const scanTrack = (track: Roll[], trackLetter: "A" | "B") => {
          track.slice(0, numRolls).forEach((roll, i) => {
            const cellId = `${i + 1}${trackLetter}`;
            const showDupe = roll.dupeInfo?.showDupe;
            if (roll.unitIfDistinct.unitName === unitName) {
              roll.found = {
                ...roll.found,
                [showDupe ? "top" : "bottom"]: color,
              };
              positions.push({ sequence: i + 1, trackLetter, label: cellId });
            }
            if (showDupe && roll.unitIfDupe?.unitName === unitName) {
              roll.found = { ...roll.found, bottom: color };
              positions.push({
                sequence: i + 1,
                trackLetter,
                label: `${cellId}R`,
              });
            }
          });
        };
        scanTrack(trackA, "A");
        scanTrack(trackB, "B");
        positions.sort(
          (a, b) =>
            a.sequence - b.sequence ||
            a.trackLetter.localeCompare(b.trackLetter)
        );
        return { bannerName, bannerShortName, positions };
      });
    return { unitName, color, banners };
  });

  const trackARolls = allRolls.map((roll) => ({
    bannerName: roll.bannerName,
    bannerShortName: roll.bannerShortName,
    track: roll.trackA.slice(0, numRolls),
  }));
  const trackBRolls = allRolls.map((roll) => ({
    bannerName: roll.bannerName,
    bannerShortName: roll.bannerShortName,
    track: roll.trackB.slice(0, numRolls),
  }));
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
        <TrackTable rolls={trackARolls} track={"A"} />
        <TrackTable rolls={trackBRolls} track={"B"} />
      </Container>
    </>
  );
};

export default RollTable;
