// Display-only Korean names. Internal logic (seed calc, dupe detection, URL
// params) keeps using the original English names from bannerData.
const UNIT_NAMES_KO: Record<string, string> = {
  // Normal
  Cat: "고양이",
  "Tank Cat": "탱크 고양이",
  "Axe Cat": "배틀 고양이",
  "Gross Cat": "징글 고양이",
  "Cow Cat": "황소 고양이",
  "Bird Cat": "고양이 새",
  "Fish Cat": "고양이 피쉬",
  "Lizard Cat": "고양이 도마뱀",
  "Titan Cat": "거신 고양이",
  Superfeline: "고양이 초인",
  "Cat Cannon Attack": "냥코 대포 공격력",
  "Cat Cannon Charge": "냥코 대포 충전",
  "Worker Cat Rate": "일 고양이의 일 효율",
  "Worker Cat Wallet": "일 고양이의 지갑",
  "Base Defense": "성 체력",
  Research: "연구력",
  Accounting: "회계력",
  Study: "공부력",
  "Cat Energy": "통솔력",

  // Items
  "Speed Up": "스피드 업",
  "Cat CPU": "야옹컴",
  "Rich Cat": "고양이 도령",
  "Cat Jobs": "고양이 박사",
  "Sniper the Cat": "스냥이퍼",
  "Treasure Radar": "트레저 레이더",
  "5K XP": "5,000 XP",
  "10K XP": "10,000 XP",
  "30K XP": "30,000 XP",
  "50K XP": "50,000 XP",
  "100K XP": "100,000 XP",
  "100K XP (β)": "100,000 XP (β)",
  "200K XP": "200,000 XP",
  "500K XP": "500,000 XP",
  "1M XP": "1,000,000 XP",

  // Catfruit
  "Purple Catfruit Seed": "보라 개다래 씨앗",
  "Red Catfruit Seed": "빨강 개다래 씨앗",
  "Blue Catfruit Seed": "파랑 개다래 씨앗",
  "Green Catfruit Seed": "초록 개다래 씨앗",
  "Yellow Catfruit Seed": "노랑 개다래 씨앗",
  "Purple Catfruit": "보라 개다래 열매",
  "Red Catfruit": "빨강 개다래 열매",
  "Blue Catfruit": "파랑 개다래 열매",
  "Green Catfruit": "초록 개다래 열매",
  "Yellow Catfruit": "노랑 개다래 열매",
  "Epic Catfruit": "무지개 개다래 열매",

  // Catseye
  "Special Catseye": "EX 캣츠아이",
  "Rare Catseye": "레어 캣츠아이",
  "Super Rare Catseye": "슈퍼레어 캣츠아이",
  "Uber Rare Catseye": "울슈레 캣츠아이",
  "Dark Catseye": "다크 캣츠아이",

  // Lucky Ticket
  "Li'l Cat": "꼬맹이 고양이",
  "Li'l Tank Cat": "꼬맹이 탱크 고양이",
  "Li'l Axe Cat": "꼬맹이 배틀 고양이",
  "Li'l Gross Cat": "꼬맹이 징글 고양이",
  "Li'l Cow Cat": "꼬맹이 황소 고양이",
  "Li'l Bird Cat": "꼬맹이 고양이 새",
  "Li'l Fish Cat": "꼬맹이 고양이 피쉬",
  "Li'l Lizard Cat": "꼬맹이 고양이 도마뱀",
  "Li'l Titan Cat": "꼬맹이 거신 고양이",
  "Catamin A": "고양이 드링크 A",
  "Catamin B": "고양이 드링크 B",
  "Catamin C": "고양이 드링크 C",
};

const BANNER_NAMES_KO: Record<string, string> = {
  Normal: "냥코뽑기",
  "Normal+": "냥코뽑기+",
  Catfruit: "개다래",
  Catseye: "캣츠아이",
  "Lucky Ticket": "럭키티켓",
  "Lucky Ticket G": "럭키티켓 G",
  Custom: "사용자 지정",
};

// Falls back to the original name (e.g. units parsed from Godfat's site)
export const unitKo = (name: string | undefined): string =>
  name === undefined ? "" : UNIT_NAMES_KO[name] || name;

export const bannerKo = (name: string): string => BANNER_NAMES_KO[name] || name;
