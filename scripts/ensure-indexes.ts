/** Run with: npm run ensure-indexes  (after setting env vars). */
import { ensureIndexes } from "@/data/indexes";

ensureIndexes()
  .then(() => {
    console.log("Indexes ensured.");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
