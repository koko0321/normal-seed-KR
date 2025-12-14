export type BannerData = {
  name: string;
  shortName: string;
  rateCumSum: number[];
  pools: {
    rate: number;
    units: string[];
    reroll: boolean;
  }[];
};

export const NormalBannerData: BannerData = {
  name: "냥코뽑기",
  shortName: "n",
  rateCumSum: [10000],
  pools: [
    {
      rate: 10000,
      units: [
        "고양이",
        "탱크 고양이",
        "배틀 고양이",
        "징글 고양이",
        "황소 고양이",
        "고양이 새",
        "고양이 피쉬",
        "고양이 도마뱀",
        "거신 고양이",
        "냥코 대포 공격력",
        "냥코 대포 충전",
        "일 고양이의 일 효율",
        "일 고양이의 지갑",
        "성 체력",
        "연구력",
        "회계력",
        "공부력",
        "통솔력",
      ],
      reroll: true,
    },
  ],
};

export const NormalBannerPlusData: BannerData = {
  name: "냥코뽑기+",
  shortName: "np",
  rateCumSum: [10000],
  pools: [
    {
      rate: 10000,
      units: [
        "고양이",
        "탱크 고양이",
        "배틀 고양이",
        "징글 고양이",
        "황소 고양이",
        "고양이 새",
        "고양이 피쉬",
        "고양이 도마뱀",
        "거신 고양이",
        "고양이 초인",
        "냥코 대포 공격력",
        "냥코 대포 충전",
        "일 고양이의 일 효율",
        "일 고양이의 지갑",
        "성 체력",
        "연구력",
        "회계력",
        "공부력",
        "통솔력",
      ],
      reroll: true,
    },
  ],
};

export const CatfruitBannerData: BannerData = {
  name: "개다래",
  shortName: "cf",
  rateCumSum: [400, 2400, 9400, 10000],
  pools: [
    {
      rate: 400,
      units: ["5,000 XP"],
      reroll: false,
    },
    {
      rate: 2000,
      units: [
        "스피드 업",
        "야옹컴",
        "10,000 XP",
        "30,000 XP",
        "50,000 XP",
        "보라 개다래 씨앗",
        "빨강 개다래 씨앗",
        "파랑 개다래 씨앗",
        "초록 개다래 씨앗",
        "노랑 개다래 씨앗",
      ],
      reroll: true,
    },
    {
      rate: 7000,
      units: [
        "고양이 도령",
        "고양이 박사",
        "스냥이퍼",
        "100,000 XP",
        "200,000 XP",
        "보라 개다래 열매",
        "빨강 개다래 열매",
        "파랑 개다래 열매",
        "초록 개다래 열매",
        "노랑 개다래 열매",
      ],
      reroll: false,
    },
    {
      rate: 600,
      units: ["트레저 레이더", "500,000 XP", "무지개 개다래 열매"],
      reroll: false,
    },
  ],
};

export const CatseyeBannerData: BannerData = {
  name: "캣츠아이",
  shortName: "ce",
  rateCumSum: [500, 7400, 9400, 9900, 10000],
  pools: [
    {
      rate: 500,
      units: ["5,000 XP"],
      reroll: false,
    },
    {
      rate: 6900,
      units: ["10,000 XP", "30,000 XP", "EX 캣츠아이", "레어 캣츠아이"],
      reroll: true,
    },
    {
      rate: 2000,
      units: ["100,000 XP", "슈퍼레어 캣츠아이"],
      reroll: false,
    },
    {
      rate: 500,
      units: ["울슈레 캣츠아이"],
      reroll: false,
    },
    {
      rate: 100,
      units: ["다크 캣츠아이"],
      reroll: false,
    },
  ],
};

export const LuckyTicketBannerData: BannerData = {
  name: "럭키티켓",
  shortName: "lt",
  rateCumSum: [0, 7400, 9500, 10000],
  pools: [
    {
      rate: 0,
      units: [],
      reroll: false,
    },
    {
      rate: 7400,
      units: [
        "꼬맹이 거신 고양이",
        "꼬맹이 고양이 도마뱀",
        "꼬맹이 고양이 피쉬",
        "꼬맹이 고양이 새",
        "꼬맹이 황소 고양이",
        "꼬맹이 징글 고양이",
        "꼬맹이 배틀 고양이",
        "꼬맹이 탱크 고양이",
        "꼬맹이 고양이",
        "스피드 업",
        "스피드 업",
        "스피드 업",
        "야옹컴",
        "야옹컴",
        "10,000 XP",
        "10,000 XP",
        "10,000 XP",
        "30,000 XP",
        "30,000 XP",
        "30,000 XP",
      ],
      reroll: true,
    },
    {
      rate: 2100,
      units: ["고양이 도령", "고양이 박사", "스냥이퍼"],
      reroll: false,
    },
    {
      rate: 500,
      units: ["트레저 레이더"],
      reroll: false,
    },
  ],
};

export const LuckyTicketGBannerData: BannerData = {
  name: "럭키티켓 G",
  shortName: "ltg",
  rateCumSum: [0, 5100, 8600, 10000],
  pools: [
    {
      rate: 0,
      units: [],
      reroll: false,
    },
    {
      rate: 5100,
      units: [
        "고양이 드링크 A",
        "고양이 드링크 A",
        "고양이 드링크 A",
        "100,000 XP (β)",
        "100,000 XP (β)",
        "100,000 XP (β)",
      ],
      reroll: true,
    },
    {
      rate: 3500,
      units: ["고양이 드링크 B", "고양이 드링크 B", "고양이 드링크 B", "500,000 XP"],
      reroll: false,
    },
    {
      rate: 1400,
      units: ["고양이 드링크 C", "고양이 드링크 C", "고양이 드링크 C", "1,000,000 XP"],
      reroll: false,
    },
  ],
};

export const AllBanners = [
  NormalBannerData,
  NormalBannerPlusData,
  CatfruitBannerData,
  CatseyeBannerData,
  LuckyTicketBannerData,
  LuckyTicketGBannerData,
];
