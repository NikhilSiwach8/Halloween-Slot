import { useEffect, type RefObject } from 'react';

/**
 * Stake.us (social casino) wording. With `social=true`, no restricted phrase may appear anywhere in
 * the game: rules, UI or images. The list is Stake's restricted-phrase table. A few lines of this
 * game get hand-written replacements first, so they still read naturally; the general table is
 * applied after them. Every replacement is free of restricted words, so applying it twice changes
 * nothing.
 */
const OWN_COPY: [RegExp, string][] = [
  [/You paid for this broadcast\. There are no refunds\./g, 'You asked for this broadcast. There is no turning back.'],
  [/Feature Spins & Bonus Buy/g, 'Feature Spins & Bonus Features'],
  [/Bonus Buy/g, 'Get Bonus'],
  [/Bonus bought\./g, 'Bonus instantly triggered.'],
  [/Bet replay/g, 'Replay'],
  [/no bets are placed/g, 'nothing is played'],
  [/Wins pay left to right/g, 'Wins count left to right'],
  [/Cash prize/g, 'Coin prize'],
  [/cash prize/g, 'coin prize'],
  [/demo credits only · not real money/g, 'demo coins only'],
];

const TABLE: [string, string][] = [
  ['place your bets', 'join in the game'],
  ["be awarded to player's accounts", "appear in player's accounts"],
  ['at the cost of', 'for'],
  ['cost of', 'can be played for'],
  ['paid out', 'won'],
  ['pays out', 'win'],
  ['pay out', 'win'],
  ['pay table', 'win table'],
  ['paytable', 'win table'],
  ['payouts', 'wins'],
  ['payout', 'win'],
  ['total bet', 'total play'],
  ['buy bonus', 'get bonus'],
  ['bonus buys', 'bonus features'],
  ['bonus buy', 'bonus feature'],
  ['win feature', 'play feature'],
  ['loss limit', 'stop limit'],
  ['loss streak', 'miss streak'],
  ['betting', 'playing'],
  ['bets', 'plays'],
  ['bet', 'play'],
  ['bought', 'instantly triggered'],
  ['buys', 'plays'],
  ['buy', 'play'],
  ['cash', 'coins'],
  ['credits', 'coins'],
  ['credit', 'coins'],
  ['currency', 'token'],
  ['deposit', 'get coins'],
  ['gamble', 'play'],
  ['money', 'coins'],
  ['payer', 'winner'],
  ['paid', 'won'],
  ['pays', 'wins'],
  ['pay', 'win'],
  ['profit', 'net gain'],
  ['purchases', 'plays'],
  ['purchase', 'play'],
  ['rebet', 'respin'],
  ['wager', 'play'],
  ['withdraw', 'redeem'],
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const GENERAL: [RegExp, string][] = [
  ...TABLE.map(([from, to]) => [new RegExp(`\\b${escape(from)}\\b`, 'gi'), to] as [RegExp, string]),
  // "stake" means the bet amount, but "Stake Engine" / "Stake.us" are the platform's name.
  [/\bstake\b(?!\s*Engine|\.us)/gi, 'play amount'],
];

/** Keeps the original's capitalisation: "BUY" -> "PLAY", "Buy" -> "Play", "buy" -> "play". */
function matchCase(original: string, replacement: string): string {
  if (original === original.toUpperCase() && /[A-Z]/.test(original)) return replacement.toUpperCase();
  if (original[0] === original[0].toUpperCase()) return replacement[0].toUpperCase() + replacement.slice(1);
  return replacement;
}

export function socialize(text: string): string {
  let out = text;
  for (const [re, to] of OWN_COPY) out = out.replace(re, to);
  for (const [re, to] of GENERAL) out = out.replace(re, (m) => matchCase(m, to));
  return out;
}

const ATTRS = ['aria-label', 'title', 'placeholder'];

function rewrite(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const v = node.nodeValue ?? '';
    const s = socialize(v);
    if (s !== v) node.nodeValue = s;
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as Element;
  if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (v) {
      const s = socialize(v);
      if (s !== v) el.setAttribute(a, s);
    }
  }
  el.childNodes.forEach(rewrite);
}

/**
 * Applies the social wording to everything rendered inside `root`, now and whenever React changes
 * it. MutationObserver callbacks run before the browser paints, so restricted text never shows.
 */
export function useSocialText(root: RefObject<HTMLElement>, enabled: boolean) {
  useEffect(() => {
    const el = root.current;
    if (!enabled || !el) return;
    rewrite(el);
    const obs = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'characterData') rewrite(r.target);
        else if (r.type === 'attributes') rewrite(r.target);
        else r.addedNodes.forEach(rewrite);
      }
    });
    obs.observe(el, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    return () => obs.disconnect();
  }, [root, enabled]);
}
