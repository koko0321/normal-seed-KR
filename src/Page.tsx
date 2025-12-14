import React, { useState } from "react";
import RollTable from "./RollTable";
import styled from "@emotion/styled";
import { Typography } from "@mui/material";
import { getQueryParam, setQueryParam } from "./utils/queryParams";
import { AllBanners } from "./utils/bannerData";

const Page = () => {
  // We'll just put all our controls here because we're lazy
  const [seedInput, setSeedInput] = useState(getQueryParam("seed"));
  const selectedBanners = getQueryParam("banners").split(",") || [];

  return (
    <>
      <Typography variant="h4">
        냥코뽑기 배열 <a href="#credits">[Credits]</a>
      </Typography>
      <Typography variant="h6">이 도구에 대하여</Typography>
      <ul>
        <li>
          {" "}
          <strong>
            냥코뽑기는 레어뽑기와 시드를 공유하지 않습니다. 
          </strong>{" "}
          각각 시드를 별도로 찾아야 합니다.
        </li>
        <ul>
          <li>
            시드를 찾고 계신가요? <a href="#/finder">여기서 찾을 수 있습니다.</a>.
          </li>
        </ul>
        <li>
          열 이동은 레어뽑기와 동일하게 작동합니다. 전략적으로 뽑기를 해 열 이동을 유도하거나 피할 수 있습니다. 
        </li>
        <li>
          <strong>유닛 이름</strong>을 클릭하면 시드가 업데이트됩니다.{" "}
          <strong>셀 내부의 다른 부분</strong>을 클릭하면 다음 10번의 뽑기가 하이라이트됩니다.

        </li>
        <li>
          <strong>100,000 XP (β)</strong>는 무엇인가요?
          <ul>
            <li>
              럭키 티켓 G 배너는 다른 배너에서 사용되는 것과는 다른 ID를 가진 특수한 100,000 XP 아이템을 사용합니다.
            </li>
            <li>
              게임 내에서는 차이가 없지만, {" "}
              <strong>
                배너 간 열 이동을 강제로 유도하는 데에는 사용할 수 없습니다.
              </strong>
            </li>
            <li>
               이 추적기에서는 이를 구분하기 위해 럭키 티켓 G 전용 XP에 (β) 표시를 붙였습니다.
            </li>
          </ul>
        </li>
      </ul>
      <Typography variant="h6">Controls</Typography>
      <Typography variant="subtitle2">Current seed</Typography>
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
          Update
        </button>
      </div>
      <Typography variant="subtitle2">Rolls</Typography>
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
      <Typography variant="subtitle2">Banners</Typography>
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
              <Typography variant="body1">{banner.name}</Typography>
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
