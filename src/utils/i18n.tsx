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

// Event gacha units use the Japanese names from utils/eventData.tsx as IDs
const EVENT_UNIT_NAMES_KO: Record<string, string> = {
  // Items
  目玉アイテム: "특별 아이템",
  XP2000: "2,000 XP",
  XP5000: "5,000 XP",
  XP1万: "10,000 XP",
  "XP2.5万": "25,000 XP",
  XP3万: "30,000 XP",
  XP10万: "100,000 XP",
  XP100万: "1,000,000 XP",
  XP200万: "2,000,000 XP",
  スピードアップ: "스피드 업",
  ニャンピュータ: "야옹컴",
  ネコボン: "고양이 도령",
  おかめはちもく: "고양이 박사",
  スニャイパー: "스냥이퍼",

  // Characters
  "おやじネコ(店主)": "두목 고양이",
  ネコメダル王: "고양이 메달왕",
  見習い武者ネコ: "졸병 고양이",
  "100万ドルのネコ": "백만 달러 고양이",
  石の上にも10年ネコ: "돌 위에서도 10년 고양이",
  記念ネコ: "기념 고양이",
  ねこ農家: "고양이 농부",
  "N208(アサルトザリガニネコ)": "N208(어설트 가재 고양이)",
  "N202(アーマードホタルネコ)": "N202(아머드 반딧불 고양이)",
  クワガタネコ: "사슴벌레 고양이",
  カブトネコ: "장수풍뎅이 고양이",
  ネコブリンキー: "고양이 블링키",
  ネコインキー: "고양이 잉키",
  ネコまねき: "고양이 마네키",
  ネココンサルタント: "고양이 컨설턴트",
  "N207(成金ネコ)": "N207(벼락부자 고양이)",
  透明にゃんこ: "투명 냥코",
  "N205(ネコ花嫁)": "N205(고양이 신부)",
  "N203(ネコピエロ)": "N203(고양이 피에로)",
  "N201(ネコソシスト)": "N201(고양이 엑소시스트)",
  にゃんこバーガー: "냥코 버거",
  スカーフにゃんこ: "스카프 냥코",
  幼馴染にゃん子: "소꿉친구 냥코",
  おてんばネコライオン: "말괄량이 고양이 라이온",
  ネコクバンケシ: "고양이 쿠반케시",
  ネコ委員長: "고양이 위원장",
  オカルトネコ: "오컬트 고양이",
  "N204(ねこシシマイ)": "N204(고양이 사자춤)",
  爆竹ネコ: "폭죽 고양이",
  ネコ小籠包: "고양이 샤오롱바오",
  タスマニアオオガニ: "태즈메이니아 왕게",
  "N206(ネコホタテ)": "N206(고양이 가리비)",
  イワシ: "정어리",
  イカ: "오징어",
  ネコの助: "고양이노스케",
  ネコデビル: "고양이 데빌",
  ネコ若神子: "고양이 와카미코",
  天子男ジャック: "천자남 잭",
  十字架天使: "십자가 천사",
};

const EVENT_NAMES_KO: Record<string, string> = {
  "1.2億DL記念": "1.2억 다운로드 기념",
  ハロウィン: "할로윈",
  "なつやすみ(リバイバル編)": "여름방학 (리바이벌)",
  パックマン: "팩맨",
  パラダイス: "파라다이스",
  ジューンブライド: "준브라이드",
  にゃんこレンジャー: "냥코 레인저",
  "1.11億DL記念": "1.11억 다운로드 기념",
  にゃんこ学園: "냥코 학원",
  春節: "춘절",
  "1.1億DL記念": "1.1억 다운로드 기념",
  サバイバル: "서바이벌",
  プレミアムフェア: "프리미엄 페어",
  ビックリマン: "비쿠리맨",
  なつやすみ: "여름방학",
};

// Falls back to the original name (e.g. units parsed from Godfat's site)
export const unitKo = (name: string | undefined): string =>
  name === undefined
    ? ""
    : UNIT_NAMES_KO[name] || EVENT_UNIT_NAMES_KO[name] || name;

export const bannerKo = (name: string): string =>
  name in BANNER_NAMES_KO
    ? BANNER_NAMES_KO[name]
    : name in EVENT_NAMES_KO
    ? `이벤트 뽑기 (${EVENT_NAMES_KO[name]})`
    : name;

// The tracker's lastCat URL param holds an internal (English) unit name. Old
// links from the first version of the site hold Korean names instead, and a
// shared link can pick up extra text after it (e.g. "<br>..."). Returns the
// internal name, or "" when the value isn't a known unit.
export const normalizeLastCat = (value: string): string => {
  const name = value.split("<")[0].trim();
  if (name === "" || name in UNIT_NAMES_KO) {
    return name;
  }
  const internal = Object.keys(UNIT_NAMES_KO).find(
    (key) => UNIT_NAMES_KO[key] === name
  );
  return internal || "";
};

export const eventKo = (name: string): string => EVENT_NAMES_KO[name] || name;
