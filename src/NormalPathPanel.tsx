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
  // Cost of one event pull track switch, 0 = free
  eventSwitchPoints: number;
  eventSwitchOrder: number;
  // Where the event gacha is now
  eventSeedUnknown: boolean;
  eventSeed: number;
  eventLast: string;
  eventStock: number;
  eventMedamaLeft: number;
  eventGuarLeft: number;
};

const urlInt = (
  key: "evSeed" | "evStock" | "evMedama" | "evGuar",
  fallback: number
) => {
  const value = parseInt(getQueryParam(key), 10);
  return Number.isNaN(value) ? fallback : value;
};

// Start of the event gacha, from the URL when it's the same event
const eventDefaults = (key: string) => {
  const gacha = EVENT_GACHAS.find((g) => g.key === key) || EVENT_GACHAS[0];
  const fromUrl = getQueryParam("ev") === gacha.key;
  return {
    eventSeed: urlInt("evSeed", 1),
    eventLast: fromUrl ? getQueryParam("evLast") : "",
    eventStock: gacha.medama
      ? fromUrl
        ? urlInt("evStock", gacha.medama.stock)
        : gacha.medama.stock
      : 0,
    eventMedamaLeft: gacha.medama
      ? fromUrl
        ? urlInt("evMedama", gacha.medama.guaranteedSteps)
        : gacha.medama.guaranteedSteps
      : 0,
    eventGuarLeft: gacha.guaranteed
      ? fromUrl
        ? urlInt("evGuar", gacha.guaranteed.step)
        : gacha.guaranteed.step
      : 0,
  };
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
  eventSwitchPoints: 0,
  eventSwitchOrder: 0,
  eventSeedUnknown: !getQueryParam("evSeed"),
  ...eventDefaults(getQueryParam("ev") || EVENT_GACHAS[0].key),
});

const loadSettings = (): Settings => {
  const defaults = defaultSettings();
  const currentTableBanners = getQueryParam("banners")
    .split(",")
    .filter(Boolean);
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved) {
      return {
        ...defaults,
        ...saved,
        banners:
          currentTableBanners.length > 0
            ? currentTableBanners
            : defaults.banners,
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

const EVENT_SWITCH_KEY = "eventSwitch";
type RankKey = ItemGroupKey | typeof EVENT_SWITCH_KEY;

const rankLabel = (key: RankKey) =>
  key === EVENT_SWITCH_KEY
    ? "이벤트뽑 열이동"
    : ITEM_GROUPS.find((group) => group.key === key)!.label;

// Ranked keys in order; saved ranks may repeat or skip, so they're only
// used to sort
const rankedKeys = (settings: Settings): RankKey[] => {
  const ranks: [RankKey, number][] = ITEM_GROUPS.map(({ key }) => [
    key,
    key === "darkCatseye" ? 1 : settings.order[key] || 0,
  ]);
  if (settings.includeEventDupe) {
    ranks.push([EVENT_SWITCH_KEY, settings.eventSwitchOrder]);
  }
  return ranks
    .filter(([, rank]) => rank > 0)
    .sort(([keyA, a], [keyB, b]) =>
      a !== b
        ? a - b
        : keyA === "darkCatseye"
        ? -1
        : keyB === "darkCatseye"
        ? 1
        : 0
    )
    .map(([key]) => key);
};

const rankValues = (ranked: RankKey[]) =>
  Object.fromEntries(
    ITEM_GROUPS.map(({ key }) => [key, ranked.indexOf(key) + 1])
  ) as Record<ItemGroupKey, number>;

const RankList = styled.ol`
  margin: 4px 0;
  padding-left: 0;
  list-style: none;
  li {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 2px 0;
  }
  .rank {
    width: 44px;
    color: #555;
  }
  .name {
    min-width: 150px;
  }
`;

// Event pull and priority settings, grouped
const SettingsBox = styled.div`
  margin: 6px 0;
  padding: 4px 8px;
  border: 1px solid #bbb;
  border-radius: 4px;
`;

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
  // Whether the shown result was computed without the event seed
  const [resultEventUnknown, setResultEventUnknown] = useState(false);
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

  const eventGacha =
    EVENT_GACHAS.find((g) => g.key === settings.eventGachaKey) ||
    EVENT_GACHAS[0];

  // Strict order as a list: dark catseye stays first, every rank is used once
  const ranked = rankedKeys(settings);
  const unranked = (
    [
      ...ITEM_GROUPS.map(({ key }) => key),
      ...(settings.includeEventDupe ? [EVENT_SWITCH_KEY] : []),
    ] as RankKey[]
  ).filter((key) => !ranked.includes(key));
  const setRanked = (list: RankKey[]) =>
    update({
      order: Object.fromEntries(
        ITEM_GROUPS.map(({ key }) => [key, list.indexOf(key) + 1])
      ) as Record<ItemGroupKey, number>,
      ...(settings.includeEventDupe
        ? { eventSwitchOrder: list.indexOf(EVENT_SWITCH_KEY) + 1 }
        : {}),
    });
  const moveRank = (index: number, by: number) => {
    const list = [...ranked];
    [list[index], list[index + by]] = [list[index + by], list[index]];
    setRanked(list);
  };
  const removeRank = (index: number) =>
    setRanked(ranked.filter((_, i) => i !== index));
  const addRank = (key: RankKey) => setRanked([...ranked, key]);

  const stop = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setRunning(false);
  };

  const start = () => {
    stop();
    const values =
      settings.scoreMode === "points" ? settings.points : rankValues(ranked);
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
      eventSwitchValue:
        settings.scoreMode === "points"
          ? settings.eventSwitchPoints
          : ranked.indexOf(EVENT_SWITCH_KEY) + 1,
      eventSeed: settings.eventSeedUnknown ? undefined : settings.eventSeed,
      eventState: {
        lastRoll: settings.eventLast,
        guaranteedLeft: eventGacha.guaranteed ? settings.eventGuarLeft : null,
        medamaStock: eventGacha.medama ? settings.eventStock : 0,
        medamaLeft: eventGacha.medama ? settings.eventMedamaLeft : null,
      },
    };
    const worker = new Worker(
      new URL("./normalPathFinderWorker.ts", import.meta.url)
    );
    workerRef.current = worker;
    setRunning(true);
    setProgress(0);
    setResult(null);
    setResultValues(values);
    setResultEventUnknown(settings.eventSeedUnknown);
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
        많이 얻는 뽑기 순서를 찾아 표에 <PathSwatch />
        주황 테두리와 순번으로 표시합니다. 모든 배너가 시드와 마지막 뽑기를
        공유하므로 어느 배너에서 뽑느냐에 따라 다음 칸이 바뀝니다. 설정은 이
        브라우저에 저장됩니다. 배너는 표에서 선택한 배너를 쓰고, 럭키티켓은 표에
        없어도 씁니다.
      </Typography>

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
              ? ["cat", "lucky", "luckyG", "event"]
              : ["cat", "lucky", "luckyG"]) as TicketType[]
          ).map((type) => (
            <label
              key={type}
              style={{
                opacity:
                  type === "event" || type === "lucky" || usedTickets.has(type)
                    ? 1
                    : 0.4,
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
            (모든 티켓을 다 쓸 때까지만 경로를 표시)
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

      <SettingsBox>
        <Typography variant="subtitle2">이벤트 뽑기 열이동</Typography>
        <Row>
          <label
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
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
              onChange={(e) =>
                update({
                  eventGachaKey: e.target.value,
                  ...eventDefaults(e.target.value),
                  eventSeed: settings.eventSeed,
                })
              }
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
        {settings.includeEventDupe && (
          <>
            <Row>
              <label>
                이벤트 시드
                <input
                  type="text"
                  inputMode="numeric"
                  style={{ width: "110px" }}
                  disabled={settings.eventSeedUnknown}
                  value={settings.eventSeed}
                  onChange={(event) =>
                    update({
                      eventSeed: parseInt(event.target.value, 10) || 0,
                    })
                  }
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={settings.eventSeedUnknown}
                  onChange={(event) =>
                    update({ eventSeedUnknown: event.target.checked })
                  }
                />
                모름
              </label>
            </Row>
            {!settings.eventSeedUnknown && (
              <Row>
                <label>
                  마지막 뽑기
                  <select
                    value={settings.eventLast}
                    onChange={(event) =>
                      update({ eventLast: event.target.value })
                    }
                  >
                    <option value="">모름</option>
                    {Array.from(
                      new Set(eventGacha.pools.flatMap((pool) => pool.units))
                    ).map((unit) => (
                      <option key={unit} value={unit}>
                        {unitKo(unit)}
                      </option>
                    ))}
                  </select>
                </label>
                {eventGacha.medama && (
                  <>
                    <label>
                      특별 아이템 재고
                      <select
                        value={Math.min(
                          settings.eventStock,
                          eventGacha.medama.stock
                        )}
                        onChange={(event) =>
                          update({
                            eventStock: parseInt(event.target.value, 10),
                          })
                        }
                      >
                        {Array.from(
                          { length: eventGacha.medama.stock + 1 },
                          (_, count) => count
                        ).map((count) => (
                          <option key={count} value={count}>
                            {count}
                          </option>
                        ))}
                      </select>
                    </label>
                    {settings.eventStock > 0 && (
                      <label>
                        특별 아이템 확정까지
                        {numberInput(settings.eventMedamaLeft, (value) =>
                          update({ eventMedamaLeft: Math.max(1, value) })
                        )}
                      </label>
                    )}
                  </>
                )}
                {eventGacha.guaranteed && (
                  <label>
                    확정까지
                    {numberInput(settings.eventGuarLeft, (value) =>
                      update({ eventGuarLeft: Math.max(1, value) })
                    )}
                  </label>
                )}
              </Row>
            )}
            <Typography variant="body2" style={{ color: "#555" }}>
              {settings.eventSeedUnknown
                ? "이벤트 시드를 모르면, 열이동마다 필요한 아이템이 이벤트 배너에서 나올 때까지 뽑는다고 보고 이벤트 티켓을 1장씩만 셉니다. 실제로는 더 들 수 있습니다."
                : "이벤트 뽑기는 이 시드에서 실제로 나오는 순서대로 단발로 뽑습니다. 열이동 한 번에 필요한 아이템이 나올 때까지 뽑고, 그 사이 냥코뽑기는 하지 않습니다."}
            </Typography>
          </>
        )}
      </SettingsBox>

      <Typography variant="subtitle2">우선순위</Typography>
      <Row>
        <label>
          <input
            type="radio"
            checked={settings.scoreMode === "order"}
            onChange={() => update({ scoreMode: "order" })}
          />
          순서 (추천: 1순위를 가장 많이, 같으면 2순위…)
        </label>
        <label>
          <input
            type="radio"
            checked={settings.scoreMode === "points"}
            onChange={() => update({ scoreMode: "points" })}
          />
          점수 (점수 합이 가장 큰 경로)
        </label>
      </Row>
      {settings.scoreMode === "points" ? (
        <Row>
          {ITEM_GROUPS.map(({ key, label }) => (
            <label key={key}>
              {label}
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
            </label>
          ))}
          {settings.includeEventDupe && (
            <label>
              이벤트뽑 열이동
              <select
                value={settings.eventSwitchPoints}
                onChange={(event) =>
                  update({
                    eventSwitchPoints: parseInt(event.target.value, 10),
                  })
                }
              >
                <option value={0}>감점 없음</option>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => (
                  <option key={value} value={value}>
                    -{value}점
                  </option>
                ))}
              </select>
            </label>
          )}
        </Row>
      ) : (
        <>
          <RankList>
            {ranked.map((key, index) => (
              <li key={key}>
                <span className="rank">{index + 1}순위</span>
                <span className="name">{rankLabel(key)}</span>
                {key !== "darkCatseye" && (
                  <>
                    <button
                      type="button"
                      title="위로"
                      disabled={index <= 1}
                      onClick={() => moveRank(index, -1)}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      title="아래로"
                      disabled={index === ranked.length - 1}
                      onClick={() => moveRank(index, 1)}
                    >
                      ▼
                    </button>
                    <button type="button" onClick={() => removeRank(index)}>
                      제외
                    </button>
                  </>
                )}
              </li>
            ))}
          </RankList>
          {unranked.length > 0 && (
            <Row>
              <span style={{ color: "#555" }}>제외됨:</span>
              {unranked.map((key) => (
                <button key={key} type="button" onClick={() => addRank(key)}>
                  + {rankLabel(key)}
                </button>
              ))}
            </Row>
          )}
        </>
      )}
      {settings.includeEventDupe && (
        <Typography variant="body2" style={{ color: "#555" }}>
          {settings.scoreMode === "points"
            ? "이벤트뽑 열이동 한 번마다 이 점수를 빼고 계산합니다. 빼는 점수보다 더 얻을 때만 열이동합니다."
            : "이벤트뽑 열이동은 그보다 위에 있는 아이템을 더 얻을 때만 합니다. 예: 3순위면 1·2순위를 위해서만 합니다. 제외하면 제한 없이 합니다. 결과가 같으면 열이동이 적은 경로를 고릅니다."}
        </Typography>
      )}

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
                .map(
                  (type) => `${TICKET_LABELS[type]} ${result.tickets[type]}장`
                )
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
              않습니다. 표 위 배너 선택에서 체크하면 표에 함께 나옵니다.
            </Typography>
          )}
          <Steps>
            {result.steps.map((step, i) => {
              const eventGacha =
                step.bannerShortName === "ev"
                  ? EVENT_GACHAS.find(
                      (g) => g.key === settings.eventGachaKey
                    ) || EVENT_GACHAS[0]
                  : null;
              const banner = eventGacha
                ? { name: eventGacha.name, shortName: "ev" }
                : AllBanners.find(
                    (b) => b.shortName === step.bannerShortName
                  ) || {
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
                      {resultEventUnknown
                        ? `이벤트 배너에서 ${unitKo(
                            step.unitName
                          )} 나올 때까지 뽑기`
                        : `이벤트 단발 ${
                            step.eventPulls || 1
                          }번, 마지막에 ${unitKo(step.unitName)}`}{" "}
                      (다음 {label} 칸 중복 열이동 유도)
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
