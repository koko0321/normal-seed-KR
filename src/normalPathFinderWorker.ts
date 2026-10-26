// Runs the best pull order search for the normal banners off the main thread
import {
  NormalPathRequest,
  findBestNormalPath,
} from "./utils/normalPathFinder";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctx = self as any;

ctx.onmessage = (event: { data: NormalPathRequest }) => {
  let lastProgress = 0;
  const result = findBestNormalPath(event.data, (done, total) => {
    const now = Date.now();
    if (now - lastProgress >= 250) {
      lastProgress = now;
      ctx.postMessage({ type: "progress", done, total });
    }
  });
  ctx.postMessage({ type: "result", result });
};
