import React, { useEffect, useState } from "react";
import RollTable, { Swatch, findColor, getFindUnits } from "./RollTable";
import styled from "@emotion/styled";
import { Typography } from "@mui/material";
import { getQueryParam, setQueryParam } from "./utils/queryParams";
import { AllBanners } from "./utils/bannerData";
import { bannerKo, unitKo } from "./utils/i18n";
import NormalPathPanel from "./NormalPathPanel";
import { NormalPathStep } from "./utils/normalPathFinder";

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

const Page = () => {
  useEffect(() => {
    document.title = "냥코뽑기 배열";
  }, []);
  // We'll just put all our controls here because we're lazy
  const [seedInput, setSeedInput] = useState(getQueryParam("seed"));
  const [path, setPath] = useState<NormalPathStep[] | null>(null);
  const [findUnits, setFindUnits] = useState<string[]>(getFindUnits);
  const selectedBanners = getQueryParam("banners").split(",") || [];

  const updateFindUnits = (nextUnits: string[]) => {
    setFindUnits(nextUnits);
    const urlParams = new URLSearchParams(window.location.search);
    const joined = nextUnits.join(",");
    if (joined) {
      urlParams.set("find", joined);
    } else {
      urlParams.delete("find");
    }
    const qs = urlParams.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`
    );
  };

  // Any item of the selected banners can be searched for, except ones
  // already picked. Each unit is listed once.
  const listedFindUnits = new Set<string>(findUnits);
  const findGroups = AllBanners.filter((banner) =>
    selectedBanners.includes(banner.shortName)
  )
    .map((banner) => {
      const units = banner.pools
        .flatMap((pool) => pool.units)
        .filter((unit) => {
          if (listedFindUnits.has(unit)) {
            return false;
          }
          listedFindUnits.add(unit);
          return true;
        });
      return { bannerName: banner.name, units };
    })
    .filter(({ units }) => units.length > 0);

  return (
    <>
      <Typography variant="h4">
        냥코뽑기 배열 <a href="#credits">[크레딧]</a>
      </Typography>
      <button
        type="button"
        style={{ margin: "4px 0" }}
        onClick={() => (window.location.hash = "#/event")}
      >
        이벤트 뽑기로 이동
      </button>
      <Typography variant="h6">이 도구에 대하여</Typography>
      <ul>
        <li>
          <strong>냥코뽑기는 레어뽑기와 시드를 공유하지 않습니다.</strong>{" "}
          시드는 각각 따로 찾아야 합니다.
        </li>
        <ul>
          <li>
            시드를 찾고 계신가요? <a href="#/finder">여기서</a> 찾을 수
            있습니다.
          </li>
        </ul>
        <li>
          열 이동은 레어뽑기와 똑같이 작동합니다. 뽑기를 전략적으로 해서 열
          이동을 유도하거나 피할 수 있습니다.
        </li>
        <li>
          <strong>유닛 이름</strong>을 클릭하면 시드가 업데이트됩니다.{" "}
          <strong>셀의 다른 부분</strong>을 클릭하면 다음 10번의 뽑기가
          하이라이트됩니다.
        </li>
        <li>
          칸에 마우스를 올리면 직전 뽑기와 중복되어 재추첨될 때 무엇이 나오고
          어디로 이동하는지 표시됩니다.
        </li>
        <li>
          <strong>아이템 검색</strong>에서 아이템을 고르면 뽑기 횟수 안에서 그
          아이템이 나오는 칸을 모두 표시합니다. 여러 개를 동시에 고를 수
          있습니다.
        </li>
        <li>
          <strong>최적 경로 찾기 (베타)</strong>에서 다크 캣츠아이, 고양이
          드링크 C·B, 트레저 레이더, 꼬맹이 캐릭터, 파란구슬의 우선순위를
          정하면, 위에서 선택한 배너로 가장 좋은 뽑기 순서를 찾아 표에 주황
          테두리와 순번으로 표시합니다.
          <ul>
            <li>
              우선순위는 순서(추천)나 점수로 정합니다. 순서는 ▲▼로 바꾸고, 필요
              없는 아이템은 제외합니다.
            </li>
            <li>
              뽑기 횟수는 표 끝까지 뽑거나, 냥코 티켓·럭키티켓·럭키티켓 G 보유
              수만큼 뽑습니다. 보유 티켓 수로 하면 티켓을 다 쓰는 곳에서 경로가
              끝납니다.
            </li>
            <li>
              <strong>이벤트 뽑기로 열이동</strong>을 켜면, 이벤트 뽑기에서 다음
              칸과 같은 아이템을 먼저 뽑아 냥코뽑기를 중복 재추첨시키고 열을
              옮기는 방법도 씁니다. 이벤트 시드를 넣으면 실제로 나오는 순서대로
              계산하고, 모르면 필요한 아이템이 나올 때까지 뽑는다고 봅니다.
            </li>
            <li>
              우선순위 목록에 이벤트뽑 열이동을 넣으면 그보다 위에 있는 아이템을
              위해서만 이벤트 뽑기로 열을 옮깁니다.
            </li>
          </ul>
        </li>
        <li>
          <strong>100,000 XP (β)</strong>는 무엇인가요?
          <ul>
            <li>
              럭키티켓 G 배너에서는 다른 배너의 100,000 XP와 ID가 다른 특수한
              100,000 XP 아이템이 나옵니다.
            </li>
            <li>
              게임 내에서는 차이가 없지만,{" "}
              <strong>
                배너 간 열 이동을 유도하는 데에는 사용할 수 없습니다
              </strong>
              .
            </li>
            <li>
              이 추적기에서는 둘을 구분하기 위해 럭키티켓 G 전용 XP에 (β) 표시를
              붙였습니다.
            </li>
          </ul>
        </li>
      </ul>
      <Typography variant="h6">설정</Typography>
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
          onClick={() => {
            setQueryParam("seed", seedInput);
          }}
        >
          업데이트
        </button>
      </div>
      <Typography variant="subtitle2">뽑기 횟수</Typography>
      <div style={{ marginBottom: "4px" }}>
        <select
          style={{ marginRight: "4px" }}
          value={getQueryParam("rolls")}
          onChange={(event) => setQueryParam("rolls", event.target.value)}
        >
          {[100, 200, 300, 500, 999].map((numRolls) => (
            <option key={numRolls} value={numRolls}>
              {numRolls}
            </option>
          ))}
        </select>
      </div>
      <Typography variant="subtitle2">배너</Typography>
      <div style={{ display: "flex", gap: "24px" }}>
        {AllBanners.map((banner) => {
          return (
            <label
              key={banner.shortName}
              style={{ display: "flex", alignItems: "center" }}
            >
              <input
                type="checkbox"
                checked={selectedBanners.includes(banner.shortName)}
                onChange={(event) => {
                  let newSelectedBanners;
                  if (event.target.checked) {
                    newSelectedBanners = [
                      ...selectedBanners,
                      banner.shortName,
                    ].sort();
                  } else {
                    newSelectedBanners = selectedBanners.filter(
                      (bannerName) => bannerName !== banner.shortName
                    );
                  }
                  setQueryParam("banners", newSelectedBanners.join(","));
                }}
                style={{ marginRight: "8px", width: "20px", height: "20px" }}
              ></input>
              <Typography variant="body1">{bannerKo(banner.name)}</Typography>
            </label>
          );
        })}
      </div>
      <NormalPathPanel selectedBanners={selectedBanners} onPath={setPath} />
      <Typography variant="subtitle2" style={{ marginTop: "4px" }}>
        아이템 검색
      </Typography>
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
              updateFindUnits([...findUnits, event.target.value]);
            }
          }}
        >
          <option value="">-- 찾을 아이템 추가 --</option>
          {findGroups.map(({ bannerName, units }) => (
            <optgroup key={bannerName} label={bannerKo(bannerName)}>
              {units.map((unit) => (
                <option key={unit} value={unit}>
                  {unitKo(unit)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {findUnits.map((unit, findIndex) => (
          <FindChip key={unit}>
            <Swatch color={findColor(findIndex)} />
            {unitKo(unit)}
            <button
              type="button"
              title="빼기"
              onClick={() =>
                updateFindUnits(
                  findUnits.filter((findUnit) => findUnit !== unit)
                )
              }
            >
              ×
            </button>
          </FindChip>
        ))}
        {findUnits.length > 1 && (
          <button type="button" onClick={() => updateFindUnits([])}>
            모두 지우기
          </button>
        )}
      </div>
      <RollTable path={path} findUnits={findUnits} />
    </>
  );
};

export default Page;
