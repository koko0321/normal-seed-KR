import React, { useState } from "react";
import RollTable from "./RollTable";
import styled from "@emotion/styled";
import { Typography } from "@mui/material";
import { getQueryParam, setQueryParam } from "./utils/queryParams";
import { AllBanners } from "./utils/bannerData";
import { bannerKo, unitKo } from "./utils/i18n";

const Page = () => {
  // We'll just put all our controls here because we're lazy
  const [seedInput, setSeedInput] = useState(getQueryParam("seed"));
  const selectedBanners = getQueryParam("banners").split(",") || [];
  const lastCat = getQueryParam("lastCat");

  // Only units in rerollable pools can make 1A a dupe, so those are the only
  // useful choices for the last roll. Each unit is listed once.
  const lastRollUnits = new Set<string>();
  const lastRollGroups = AllBanners.filter((banner) =>
    selectedBanners.includes(banner.shortName)
  )
    .map((banner) => {
      const units = banner.pools
        .filter((pool) => pool.reroll)
        .flatMap((pool) => pool.units)
        .filter((unit) => {
          if (lastRollUnits.has(unit)) {
            return false;
          }
          lastRollUnits.add(unit);
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
          <strong>마지막 뽑기</strong>는 현재 시드 직전에 뽑은 아이템입니다.
          1A가 직전과 같은 아이템이라 중복 재추첨되는지 판단하는 데 쓰입니다.
          <ul>
            <li>유닛 이름을 클릭하면 자동으로 설정됩니다.</li>
            <li>
              시드를 직접 입력했다면 마지막으로 뽑은 아이템을 선택해 주세요.
              모르거나 목록에 없는 아이템이면 비워두면 됩니다.
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
              <strong>배너 간 열 이동을 유도하는 데에는 사용할 수 없습니다</strong>
              .
            </li>
            <li>
              이 추적기에서는 둘을 구분하기 위해 럭키티켓 G 전용 XP에 (β)
              표시를 붙였습니다.
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
      <Typography variant="subtitle2">마지막 뽑기</Typography>
      <div style={{ marginBottom: "4px" }}>
        <select
          title="1A가 중복 재추첨인지 판단하는 데 사용됩니다"
          style={{ maxWidth: "300px" }}
          onChange={(event) => setQueryParam("lastCat", event.target.value)}
        >
          <option value="" selected={lastCat === ""}>
            -- 없음 / 그 외 아이템 --
          </option>
          {lastRollGroups.map(({ bannerName, units }) => (
            <optgroup key={bannerName} label={bannerKo(bannerName)}>
              {units.map((unit) => (
                <option key={unit} value={unit} selected={lastCat === unit}>
                  {unitKo(unit)}
                </option>
              ))}
            </optgroup>
          ))}
          {lastCat !== "" && !lastRollUnits.has(lastCat) && (
            <option value={lastCat} selected>
              {unitKo(lastCat)}
            </option>
          )}
        </select>
      </div>
      <Typography variant="subtitle2">뽑기 횟수</Typography>
      <div style={{ marginBottom: "4px" }}>
        <select
          style={{ marginRight: "4px" }}
          onChange={(event) => setQueryParam("rolls", event.target.value)}
        >
          {[100, 200, 500, 999].map((numRolls) => (
            <option
              value={numRolls}
              selected={getQueryParam("rolls") === numRolls.toString()}
            >
              {numRolls}
            </option>
          ))}
        </select>
      </div>
      <Typography variant="subtitle2">배너</Typography>
      <div style={{ display: "flex", gap: "24px" }}>
        {AllBanners.map((banner) => {
          return (
            <label style={{ display: "flex", alignItems: "center" }}>
              <input
                type="checkbox"
                checked={selectedBanners.includes(banner.shortName)}
                onClick={(event) => {
                  let newSelectedBanners;
                  if ((event.target as HTMLInputElement).checked) {
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
      <Typography variant="body1">&nbsp;</Typography>
      <RollTable />
    </>
  );
};

export default Page;
