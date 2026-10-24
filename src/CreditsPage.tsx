import React from "react";
import { Typography } from "@mui/material";

const CreditsPage = () => {
  return (
    <>
      <Typography variant="body2" style={{ marginBottom: "8px" }}>
        이 사이트는{" "}
        <a href="https://github.com/ampuri/bc-normal-seed-tracking">
          ampuri/bc-normal-seed-tracking
        </a>
        의 한국어 번역판입니다.
      </Typography>
      <Typography variant="h4">냥코뽑기 배열</Typography>
      <Typography variant="h6">감사의 말:</Typography>
      <Typography variant="body1">
        <ul style={{ marginTop: 0 }}>
          <li>
            추적기 형식을 만든 <a href="https://www.godfat.org/">Godfat</a>.
            이 사이트의 대부분은 Godfat의 사이트에서 영감을 받았습니다.
          </li>
          <li>
            <a href="https://www.reddit.com/user/JulietCat/">/u/JulietCat</a>:
            <ul>
              <li>
                <a href="https://old.reddit.com/r/battlecats/comments/64geym/tutorial_cheating_almost_everything_you_could/">
                  시드 추적 시스템을 자세히 설명한 Reddit 글
                </a>
              </li>
              <li>
                <a href="https://old.reddit.com/r/battlecats/comments/6c8gsy/cheating_forecasting_silver_draws/">
                  레어 티켓도 추적할 수 있음을 확인하고 각 냥코뽑기의 등급별
                  확률을 정리한 Reddit 글
                </a>
              </li>
            </ul>
          </li>
        </ul>
      </Typography>
    </>
  );
};

export default CreditsPage;
