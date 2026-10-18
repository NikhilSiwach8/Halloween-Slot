/**
 * Picks example book ids per mode for the Stake review (bet replay must be shown for a loss, a
 * normal win, a big win, the max win and a bonus trigger, per mode).
 *
 *   npm run df:replay-examples   ->  stake-upload/replay-examples.json
 *
 * On Stake the replay `event` is the simulation (book) id: {rgs_url}/bet/replay/{game}/{version}/{MODE}/{id}.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { zstdDecompressSync } from 'node:zlib';

const root = fileURLToPath(new URL('../stake-upload', import.meta.url));
const index = JSON.parse(readFileSync(`${root}/math/index.json`, 'utf8')) as { modes: { name: string; cost: number; events: string }[] };
const out: Record<string, Record<string, { id: number; payoutX: number } | null>> = {};
for (const m of index.modes) {
  const books = zstdDecompressSync(readFileSync(`${root}/math/${m.events}`)).toString('utf8').trim().split('\n').map((l) => JSON.parse(l) as {
    id: number; payoutMultiplier: number; criteria: string; events: [{ bonuses: unknown[]; spin?: unknown }];
  });
  const pick = (f: (b: (typeof books)[number]) => boolean) => {
    const b = books.find(f);
    return b ? { id: b.id, payoutX: b.payoutMultiplier / 100 } : null;
  };
  const isSpinMode = !!books[0].events[0].spin;
  out[m.name.toUpperCase()] = {
    loss: pick((b) => b.payoutMultiplier === 0),
    normalWin: pick((b) => b.payoutMultiplier >= 100 * m.cost && b.payoutMultiplier <= 300 * m.cost && b.criteria !== 'wincap'),
    bigWin: pick((b) => b.payoutMultiplier >= 2000 * 100 && b.criteria !== 'wincap'),
    maxWin: pick((b) => b.criteria === 'wincap'),
    bonusTrigger: isSpinMode ? pick((b) => b.events[0].bonuses.length > 0 && b.criteria !== 'wincap') : null,
  };
}
writeFileSync(`${root}/replay-examples.json`, JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 2));
