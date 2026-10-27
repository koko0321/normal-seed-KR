import React, { useEffect, useRef, useState } from "react";
import styled from "@emotion/styled";
import { Typography } from "@mui/material";
import { getQueryParam } from "./utils/queryParams";
import { AllBanners } from "./utils/bannerData";
import { EVENT_GACHAS } from "./utils/eventData";
import { bannerKo, eventKo, normalizeLastCat, unitKo } from "./utils/i18n";
import { cellElementId } from "./RollTable";
import {
  ITEM_GROUPS,
  ItemGroupKey,
  NormalPathRequest,
  PATH_COLOR,
  NormalPathResult,
  NormalPathStep,
  TICKET_OF_BANNER,
  TICKET_TYPES,
  TicketType,
  groupOfUnit,
} from "./utils/normalPathFinder";

const TICKET_LABELS: Record<TicketType, string> = {
  cat: "냥코 티켓",
  lucky: "럭키티켓",
  luckyG: "럭키티켓 G",
  event: "이벤트 티켓",
};

type Settings = {
  banners: string[];
  budgetMode: NormalPathRequest["budgetMode"];
  limits: Record<TicketType, number>;
  totalLimit: number;
  scoreMode: NormalPathRequest["scoreMode"];
  points: Record<ItemGroupKey, number>;
  order: Record<ItemGroupKey, number>;
  includeEventDupe: boolean;
  eventGachaKey: string;
};

// Each user's own settings stay in their browser
const STORAGE_KEY = "normalPathSettings_v2";

const defaultSettings = (): Settings => ({
  banners: getQueryParam("banners").split(",").filter(Boolean),
  budgetMode: "tickets",
  limits: { cat: 30, lucky: 100, luckyG: 10, event: 10 },
  totalLimit: 50,
  scoreMode: "order",
  points: {
    darkCatseye: 10,
    cataminC: 6,
    radar: 5,
    cataminB: 3,
    lil: 1,
    orbs: 1,
  },
  order: {
    darkCatseye: 1,
    cataminC: 2,
    radar: 3,
    cataminB: 4,
    lil: 5,
    orbs: 6,
  },
  includeEventDupe: false,
  eventGachaKey: getQueryParam("ev") || EVENT_GACHAS[0].key,
});

const loadSettings = (): Settings => {
  const defaults = defaultSettings();
  const currentTableBanners = getQueryParam("banners").split(",").filter(Boolean);
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved) {
      return {
        ...defaults,
        ...saved,
        banners:
          currentTableBanners.length > 0 ? currentTableBanners : defaults.banners,
        limits: { ...defaults.limits, ...saved.limits },
        points: { ...defaults.points, ...saved.points, darkCatseye: 10 },
        order: { ...defaults.order, ...saved.order, darkCatseye: 1 },
        includeEventDupe: saved.includeEventDupe ?? false,
        eventGachaKey:
          saved.eventGachaKey || getQueryParam("ev") || EVENT_GACHAS[0].key,
      };
    }
  } catch {
    // Storage blocked or broken: use the defaults
  }
  return defaults;
};

const Panel = styled.details`
  margin: 4px 0 8px;
  padding: 4px 8px;
  border: 1px solid #999;
  border-radius: 4px;
  max-width: 900px;
  summary {
    cursor: pointer;
    font-weight: bold;
  }
  input[type="number"] {
    width: 60px;
  }
`;

const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 16px;
  margin-bottom: 4px;
  label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
`;

const Steps = styled.ol`
  margin: 4px 0;
  padding-left: 32px;
  max-height: 300px;
  overflow-y: auto;
`;

const CellLink = styled.button`
  padding: 0;
  border: none;
  background: none;
  color: #0000ee;
  text-decoration: underline;
  cursor: pointer;
`;

const PathSwatch = styled.span`
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 4px;
  border: 3px solid ${PATH_COLOR};
  vertical-align: middle;
`;

const cellLabel = (step: NormalPathStep) => `${step.row + 1}${step.track}`;

const NormalPathPanel = ({
  selectedBanners,
  onPath,
}: {
  selectedBanners?: string[];
  onPath: (steps: NormalPathStep[] | null) => void;
}) => {
  const currentTableBanners =
    selectedBanners ?? getQueryParam("banners").split(",").filter(Boolean);
  const bannersKey = currentTableBanners.join(",");

  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<NormalPathResult | null>(null);
  // Item values the shown result was computed with
  const [resultValues, setResultValues] = useState<
    Record<ItemGroupKey, number>
  >(settings.points);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    setSettings((current) => ({
      ...current,
      banners: currentTableBanners,
    }));
  }, [bannersKey]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Not saved; fine for this visit
    }
  }, [settings]);
  useEffect(() => () => workerRef.current?.terminate(), []);

  const update = (change: Partial<Settings>) =>
    setSettings((current) => ({ ...current, ...change }));

  const tableBanners = getQueryParam("banners").split(",");
  const numRolls = parseInt(getQueryParam("rolls"), 10);
  const usedTickets = new Set(
    settings.banners.map((banner) => TICKET_OF_BANNER[banner])
  );

  const stop = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setRunning(false);
  };

  const start = () => {
    stop();
    const values =
      settings.scoreMode === "points"
        ? settings.points
        : { ...settings.order, darkCatseye: 1 };
    const request: NormalPathRequest = {
      seed: parseInt(getQueryParam("seed"), 10),
      lastCat: normalizeLastCat(getQueryParam("lastCat")),
      numRolls,
      // Keep the table's banner order
      banners: AllBanners.map(({ shortName }) => shortName).filter(
        (shortName) => settings.banners.includes(shortName)
      ),
      budgetMode: settings.budgetMode,
      limits: settings.limits,
      totalLimit: settings.totalLimit,
      scoreMode: settings.scoreMode,
      values,
      includeEventDupe: settings.includeEventDupe,
      eventGachaKey: settings.eventGachaKey,
    };
    const worker = new Worker(
      new URL("./normalPathFinderWorker.ts", import.meta.url)
    );
    workerRef.current = worker;
    setRunning(true);
    setProgress(0);
    setResult(null);
    setResultValues(values);
    // The old path stays on the table until the new one is ready: redrawing
    // a big table takes a while
    worker.onmessage = (event) => {
      if (event.data.type === "progress") {
        setProgress(event.data.done / event.data.total);
        return;
      }
      const found: NormalPathResult = event.data.result;
      stop();
      setResult(found);
      onPath(found.found ? found.steps : null);
    };
    worker.postMessage(request);
  };

  const clear = () => {
    stop();
    setResult(null);
    onPath(null);
  };

  const numberInput = (value: number, onChange: (value: number) => void) => (
    <input
      type="number"
      min={0}
      value={value}
      onChange={(event) =>
        onChange(Math.max(0, parseInt(event.target.value, 10) || 0))
      }
    />
  );

  const hiddenBanners =
    result?.found &&
    Array.from(new Set(result.steps.map((step) => step.bannerShortName)))
      .filter(
        (shortName) => shortName !== "ev" && !tableBanners.includes(shortName)
      )
      .map((shortName) =>
        bannerKo(AllBanners.find((b) => b.shortName === shortName)!.name)
      );

  return (
    <Panel>
      <summary>
        최적 경로 찾기 (아이템 우선순위){" "}
        <span style={{ color: "#e65100", fontWeight: "bold" }}>(베타)</span>
      </summary>
      <Typography variant="body2" style={{ margin: "4px 0" }}>
        원하는 아이템에 점수나 순위를 주면, 가진 티켓 안에서 그 아이템을 가장
        많이 얻는 뽑기 순서를 찾아 표에{" "}
        <PathSwatch />
        주황 테두리와 순번으로 표시합니다. 모든 배너가 시드와 마지막 뽑기를
        공유하므로 어느 배너에서 뽑느냐에 따라 다음 칸이 바뀝니다. 설정은 이
        브라우저에 저장됩니다.
      </Typography>

      <Typography variant="subtitle2">사용할 배너</Typography>
      <Row>
        {AllBanners.map((banner) => (
          <label key={banner.shortName}>
            <input
              type="checkbox"
              checked={settings.banners.includes(banner.shortName)}
              onChange={(event) =>
                update({
                  banners: event.target.checked
                    ? [...settings.banners, banner.shortName]
                    : settings.banners.filter(
                        (shortName) => shortName !== banner.shortName
                      ),
                })
              }
            />
            {bannerKo(banner.name)}
            <span style={{ color: "#777" }}>
              ({TICKET_LABELS[TICKET_OF_BANNER[banner.shortName]]})
            </span>
          </label>
        ))}
      </Row>

      <Typography variant="subtitle2">뽑을 수 있는 만큼</Typography>
      <Row>
        <label>
          <input
            type="radio"
            checked={settings.budgetMode === "tickets"}
            onChange={() => update({ budgetMode: "tickets" })}
          />
          보유 티켓 수
        </label>
        <label>
          <input
            type="radio"
            checked={settings.budgetMode === "total"}
            onChange={() => update({ budgetMode: "total" })}
          />
          총 뽑기 횟수
        </label>
        <label>
          <input
            type="radio"
            checked={settings.budgetMode === "rows"}
            onChange={() => update({ budgetMode: "rows" })}
          />
          제한 없음 (표 끝까지)
        </label>
      </Row>
      {settings.budgetMode === "tickets" && (
        <Row>
          {(
            (settings.includeEventDupe
              ? ["cat", "luckyG", "event"]
              : ["cat", "luckyG"]) as TicketType[]
          ).map((type) => (
            <label
              key={type}
              style={{
                opacity:
                  type === "event" || usedTickets.has(type) ? 1 : 0.4,
              }}
            >
              {TICKET_LABELS[type]}
              {numberInput(settings.limits[type] ?? 10, (value) =>
                update({ limits: { ...settings.limits, [type]: value } })
              )}
              장
            </label>
          ))}
          <span style={{ color: "#555" }}>
            (우선순위 없는 나머지 칸은 럭키티켓으로 자동 채움)
          </span>
        </Row>
      )}
      {settings.budgetMode === "total" && (
        <Row>
          <label>
            총
            {numberInput(settings.totalLimit, (value) =>
              update({ totalLimit: value })
            )}
            번
          </label>
        </Row>
      )}

      <Typography variant="subtitle2">이벤트 뽑기 열이동</Typography>
      <Row>
        <label style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <input
            type="checkbox"
            checked={settings.includeEventDupe}
            onChange={(e) => update({ includeEventDupe: e.target.checked })}
          />
          이벤트 뽑기로 열이동 포함
        </label>
        {settings.includeEventDupe && (
          <select
            value={settings.eventGachaKey}
            onChange={(e) => update({ eventGachaKey: e.target.value })}
            style={{ maxWidth: "250px" }}
          >
            {EVENT_GACHAS.map((ev) => (
              <option key={ev.key} value={ev.key}>
                {eventKo(ev.name)}
              </option>
            ))}
          </select>
        )}
      </Row>

      <Typography variant="subtitle2">우선순위</Typography>
      <Row>
        <label>
          <input
            type="radio"
            checked={settings.scoreMode === "points"}
            onChange={() => update({ scoreMode: "points" })}
          />
          점수 (점수 합이 가장 큰 경로)
        </label>
        <label>
          <input
            type="radio"
            checked={settings.scoreMode === "order"}
            onChange={() => update({ scoreMode: "order" })}
          />
          순서 (1순위를 가장 많이, 같으면 2순위…)
        </label>
      </Row>
      <Row>
        {ITEM_GROUPS.map(({ key, label }) => (
          <label key={key}>
            {label}
            {settings.scoreMode === "points" ? (
              <select
                value={settings.points[key]}
                onChange={(event) =>
                  update({
                    points: {
                      ...settings.points,
                      [key]: parseInt(event.target.value, 10),
                    },
                  })
                }
              >
                {Array.from({ length: 11 }, (_, value) => (
                  <option key={value} value={value}>
                    {value}점
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={key === "darkCatseye" ? 1 : settings.order[key]}
                disabled={key === "darkCatseye"}
                onChange={(event) =>
                  update({
                    order: {
                      ...settings.order,
                      [key]: parseInt(event.target.value, 10),
                    },
                  })
                }
              >
                {key !== "darkCatseye" && <option value={0}>제외</option>}
                {ITEM_GROUPS.map((_, rank) => (
                  <option key={rank} value={rank + 1}>
                    {rank + 1}순위
                  </option>
                ))}
              </select>
            )}
          </label>
        ))}
      </Row>

      <Row>
        <button type="button" onClick={start}>
          {running ? "다시 계산" : "계산"}
        </button>
        {running && (
          <>
            <button type="button" onClick={stop}>
              중지
            </button>
            <span>계산 중… {Math.round(progress * 100)}%</span>
          </>
        )}
        {result && (
          <button type="button" onClick={clear}>
            경로 지우기
          </button>
        )}
        <span style={{ color: "#777" }}>
          표의 뽑기 횟수({numRolls}행) 안에서 찾습니다.
        </span>
      </Row>

      {result && !result.found && (
        <Typography variant="body2" style={{ color: "#c62828" }}>
          {result.reason}
        </Typography>
      )}
      {result?.found && (
        <>
          <Typography variant="body2">
            <strong>
              총 {result.steps.length}번 뽑기 ·{" "}
              {TICKET_TYPES.filter((type) => result.tickets[type] > 0)
                .map((type) => `${TICKET_LABELS[type]} ${result.tickets[type]}장`)
                .join(", ") || "뽑기 없음"}
            </strong>
          </Typography>
          <Typography variant="body2">
            얻는 아이템:{" "}
            {ITEM_GROUPS.filter(({ key }) => result.collected[key])
              .map(({ key, label }) => `${label} ${result.collected[key]}개`)
              .join(", ") || "없음"}
          </Typography>
          {result.approximate && (
            <Typography variant="body2" style={{ color: "#e65100" }}>
              경우의 수가 너무 많아 빠른 근사 계산으로 찾은 경로입니다. 가장
              좋은 경로가 아닐 수 있습니다. 티켓 수나 뽑기 횟수를 줄이면 정확히
              계산합니다.
            </Typography>
          )}
          {hiddenBanners && hiddenBanners.length > 0 && (
            <Typography variant="body2" style={{ color: "#e65100" }}>
              표에 없는 배너({hiddenBanners.join(", ")})의 칸은 표시되지
              않습니다. 위 배너 설정에서 체크하면 표에 함께 나옵니다.
            </Typography>
          )}
          <Steps>
            {result.steps.map((step, i) => {
              const eventGacha =
                step.bannerShortName === "ev"
                  ? EVENT_GACHAS.find((g) => g.key === settings.eventGachaKey) ||
                    EVENT_GACHAS[0]
                  : null;
              const banner = eventGacha
                ? { name: eventGacha.name, shortName: "ev" }
                : AllBanners.find((b) => b.shortName === step.bannerShortName) || {
                    name: step.bannerShortName,
                    shortName: step.bannerShortName,
                  };
              const label = cellLabel(step);
              const target = groupOfUnit(step.unitName);
              return (
                <li key={i}>
                  <CellLink
                    type="button"
                    onClick={() => {
                      const nextStep = result.steps[i + 1];
                      const targetBanner =
                        step.bannerShortName === "ev" && nextStep
                          ? nextStep.bannerShortName
                          : step.bannerShortName;
                      document
                        .getElementById(cellElementId(targetBanner, label))
                        ?.scrollIntoView({ block: "center" });
                    }}
                  >
                    {label}
                    {step.dupe ? "R" : ""}
                  </CellLink>{" "}
                  {step.bannerShortName === "ev" ? (
                    <span>
                      <strong style={{ color: "#e65100" }}>
                        [이벤트뽑 열이동] {bannerKo(banner.name)}:
                      </strong>{" "}
                      {unitKo(step.unitName)} 먼저 뽑기 (다음 {label} 칸 중복 열이동 유도)
                    </span>
                  ) : (
                    <>
                      {bannerKo(banner.name)} →{" "}
                      {target && resultValues[target] ? (
                        <strong>{unitKo(step.unitName)}</strong>
                      ) : (
                        unitKo(step.unitName)
                      )}
                      {step.isEventDupeSwitch ? (
                        <strong style={{ color: "#e65100" }}>
                          {" "}
                          (이벤트뽑 열이동)
                        </strong>
                      ) : (
                        step.dupe && " (중복 재추첨)"
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </Steps>
        </>
      )}
    </Panel>
  );
};

export default NormalPathPanel;
