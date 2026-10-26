import { AllBanners } from "./bannerData";
import { EventGacha } from "./eventData";

// Event gachas use the same seed and the same last roll (for dupes) as the
// normal ticket banners: tbc-roll's event table explains its dupe line as
// "single-roll e.g. Speed Up in the Lucky Gacha first". So a normal banner
// pull can be part of an event gacha path.
//
// The normal banners name units in English and the event gachas in Japanese;
// items that are the same in both get the event name, so a dupe carries over.
// ("100K XP (β)" from Lucky Ticket G is a different item and stays apart.)
const SAME_ITEM_AS_EVENT: Record<string, string> = {
  "Speed Up": "スピードアップ",
  "Cat CPU": "ニャンピュータ",
  "5K XP": "XP5000",
  "10K XP": "XP1万",
  "30K XP": "XP3万",
  "100K XP": "XP10万",
  "1M XP": "XP100万",
  "Rich Cat": "ネコボン",
  "Cat Jobs": "おかめはちもく",
  "Sniper the Cat": "スニャイパー",
};

export type SharedBanner = {
  key: string; // the banner's shortName
  name: string; // the banner's name, see bannerKo
  gacha: EventGacha;
};

export const SHARED_BANNERS: SharedBanner[] = AllBanners.map((banner) => ({
  key: banner.shortName,
  name: banner.name,
  gacha: {
    key: banner.shortName,
    name: banner.name,
    pools: banner.pools.map((pool) => ({
      rate: pool.rate,
      units: pool.units.map((unit) => SAME_ITEM_AS_EVENT[unit] || unit),
      reroll: pool.reroll,
      color: "common" as const,
    })),
  },
}));
