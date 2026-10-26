// Event gacha pools and rules. Unit names are internal IDs; Korean names are
// display-only (see utils/i18n.tsx).

export type EventPoolColor = "common" | "rare" | "super" | "special" | "xp";

export type EventPool = {
  rate: number; // out of 10000
  units: string[];
  reroll: boolean; // dupes of the previous roll are rerolled
  color: EventPoolColor;
};

export type EventGacha = {
  key: string;
  name: string;
  pools: EventPool[];
  // Every `step`-th roll is a guaranteed character from these pools
  guaranteed?: { step: number; pools: number[] };
  // Special items with a limited stock, rolled before the regular draw
  medama?: { stock: number; rate: number; guaranteedSteps: number };
};

const RARE_ITEMS = ["スピードアップ", "ニャンピュータ", "XP1万", "XP3万"];
const SUPER_RARE_ITEMS = ["ネコボン", "おかめはちもく", "スニャイパー", "XP10万"];

const pool = (
  rate: number,
  units: string[],
  color: EventPoolColor,
  reroll = false
): EventPool => ({ rate, units, reroll, color });

const rareItems = (rate: number) => pool(rate, RARE_ITEMS, "rare", true);
const superRareItems = (rate: number) => pool(rate, SUPER_RARE_ITEMS, "super");

// Newest first
export const EVENT_GACHAS: EventGacha[] = [
  {
    key: "120MDL",
    name: "1.2億DL記念",
    pools: [
      pool(1000, ["XP5000"], "common"),
      rareItems(4500),
      superRareItems(3000),
      pool(1500, ["おやじネコ(店主)", "ネコメダル王", "見習い武者ネコ"], "special"),
    ],
    medama: { stock: 5, rate: 500, guaranteedSteps: 30 },
  },
  {
    key: "halloween",
    name: "ハロウィン",
    pools: [
      pool(2000, ["XP5000"], "common"),
      rareItems(4900),
      superRareItems(3000),
      pool(100, ["XP200万"], "xp"),
    ],
    medama: { stock: 9, rate: 500, guaranteedSteps: 30 },
  },
  {
    key: "revival",
    name: "なつやすみ(リバイバル編)",
    pools: [
      pool(250, ["XP5000"], "common"),
      rareItems(6250),
      superRareItems(2300),
      pool(
        1000,
        [
          "N208(アサルトザリガニネコ)",
          "N202(アーマードホタルネコ)",
          "クワガタネコ",
          "カブトネコ",
        ],
        "special"
      ),
      pool(200, ["XP100万"], "xp"),
    ],
    guaranteed: { step: 10, pools: [3] },
  },
  {
    key: "pacMan",
    name: "パックマン",
    pools: [
      pool(1300, ["XP5000"], "common"),
      rareItems(5000),
      superRareItems(3000),
      pool(500, ["ネコブリンキー", "ネコインキー"], "special"),
      pool(200, ["XP100万"], "xp"),
    ],
    guaranteed: { step: 10, pools: [3] },
  },
  {
    key: "paradise",
    name: "パラダイス",
    pools: [
      pool(3400, ["XP5000", "XP2000"], "common", true),
      pool(3800, ["スピードアップ", "ニャンピュータ", "XP1万", "XP2.5万"], "rare", true),
      pool(2000, ["ネコボン", "おかめはちもく", "スニャイパー"], "super"),
      pool(
        800,
        ["ネコまねき", "記念ネコ", "ネココンサルタント", "N207(成金ネコ)"],
        "special"
      ),
    ],
    guaranteed: { step: 50, pools: [3] },
  },
  {
    key: "jundeBride",
    name: "ジューンブライド",
    pools: [
      pool(800, ["XP5000"], "common"),
      rareItems(5000),
      superRareItems(3000),
      pool(
        1000,
        ["透明にゃんこ", "N205(ネコ花嫁)", "N203(ネコピエロ)", "N201(ネコソシスト)"],
        "special"
      ),
      pool(200, ["XP100万"], "xp"),
    ],
    guaranteed: { step: 10, pools: [3] },
  },
  {
    key: "ranger",
    name: "にゃんこレンジャー",
    pools: [
      rareItems(6500),
      superRareItems(2300),
      pool(1000, ["にゃんこバーガー", "ネコメダル王", "スカーフにゃんこ"], "special"),
      pool(200, ["XP100万"], "xp"),
    ],
    guaranteed: { step: 10, pools: [2] },
  },
  {
    key: "111MDL",
    name: "1.11億DL記念",
    pools: [
      pool(1000, ["XP5000"], "common"),
      rareItems(4500),
      superRareItems(3000),
      pool(
        1500,
        ["100万ドルのネコ", "石の上にも10年ネコ", "見習い武者ネコ"],
        "special"
      ),
    ],
    medama: { stock: 10, rate: 1000, guaranteedSteps: 30 },
  },
  {
    key: "school",
    name: "にゃんこ学園",
    pools: [
      pool(1000, ["XP5000"], "common"),
      rareItems(5000),
      superRareItems(2500),
      pool(
        1500,
        [
          "幼馴染にゃん子",
          "おてんばネコライオン",
          "ネコクバンケシ",
          "ネコ委員長",
          "オカルトネコ",
        ],
        "special"
      ),
    ],
    guaranteed: { step: 10, pools: [3] },
  },
  {
    key: "chinese",
    name: "春節",
    pools: [
      pool(800, ["XP5000"], "common"),
      rareItems(5000),
      superRareItems(3000),
      pool(1000, ["N204(ねこシシマイ)", "爆竹ネコ", "ネコ小籠包"], "special"),
      pool(200, ["XP100万"], "xp"),
    ],
    guaranteed: { step: 10, pools: [3] },
  },
  {
    key: "millionDL",
    name: "1.1億DL記念",
    pools: [
      pool(1000, ["XP5000"], "common"),
      rareItems(5000),
      superRareItems(3000),
      pool(1000, ["記念ネコ", "ねこ農家", "石の上にも10年ネコ"], "special"),
    ],
    medama: { stock: 10, rate: 500, guaranteedSteps: 30 },
  },
  {
    key: "survival",
    name: "サバイバル",
    pools: [
      pool(1000, ["XP5000"], "common"),
      rareItems(5000),
      superRareItems(3000),
      pool(
        1000,
        ["タスマニアオオガニ", "N206(ネコホタテ)", "イワシ", "イカ"],
        "special"
      ),
    ],
    guaranteed: { step: 10, pools: [3] },
  },
  {
    key: "premium",
    name: "プレミアムフェア",
    pools: [
      pool(1800, ["XP5000"], "common"),
      rareItems(5000),
      superRareItems(3000),
      pool(200, ["XP100万"], "xp"),
    ],
    medama: { stock: 6, rate: 500, guaranteedSteps: 30 },
  },
  {
    key: "bikkuri",
    name: "ビックリマン",
    pools: [
      pool(800, ["XP5000"], "common"),
      rareItems(4000),
      superRareItems(2000),
      pool(2000, ["ネコの助", "ネコデビル", "ネコ若神子"], "special"),
      pool(1200, ["天子男ジャック", "十字架天使"], "special"),
    ],
    guaranteed: { step: 10, pools: [3, 4] },
  },
  {
    key: "summer",
    name: "なつやすみ",
    pools: [
      pool(250, ["ねこ農家"], "common"),
      rareItems(6250),
      superRareItems(2300),
      pool(
        1000,
        ["N202(アーマードホタルネコ)", "クワガタネコ", "カブトネコ"],
        "special"
      ),
      pool(200, ["XP100万"], "xp"),
    ],
    guaranteed: { step: 10, pools: [3] },
  },
];

export const MEDAMA = "目玉アイテム";
export const MULTI_ROLL_NUM = 10;
