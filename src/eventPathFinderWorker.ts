// Runs the shortest path search off the main thread so the page stays
// responsive; posts progress now and then and the result at the end.
import { EVENT_GACHAS } from "./utils/eventData";
import { GachaState, SeedList } from "./utils/eventEngine";
import { PathTarget, findShortestPath } from "./utils/eventPathFinder";
import { SHARED_BANNERS } from "./utils/sharedBanners";

export type PathFinderRequest = {
  gachaKey: string;
  seed: number;
  startState: GachaState;
  targets: PathTarget[];
  maxIndex: number;
  multiCount: number;
  budget: number | null;
  useLuckyTickets?: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctx = self as any;

ctx.onmessage = (event: { data: PathFinderRequest }) => {
  const request = event.data;
  const gacha = EVENT_GACHAS.find(({ key }) => key === request.gachaKey)!;
  let lastProgress = 0;
  const ltBanner = request.useLuckyTickets
    ? SHARED_BANNERS.filter((b) => b.key === "lt")
    : [];
  const result = findShortestPath(
    gacha,
    new SeedList(request.seed),
    1,
    request.startState,
    request.targets,
    request.maxIndex,
    {
      multiCount: request.multiCount,
      budget: request.budget,
      sharedBanners: ltBanner,
      maxNormalTickets: Infinity,
      // The page stays responsive and can stop the worker, so the search may
      // go much further than on the main thread
      maxStates: 2_000_000,
      // Each message re-renders part of the page, so a few per second is enough
      onProgress: (progress) => {
        const now = Date.now();
        if (now - lastProgress >= 250) {
          lastProgress = now;
          ctx.postMessage({ type: "progress", ...progress });
        }
      },
    }
  );
  ctx.postMessage({ type: "result", result });
};
