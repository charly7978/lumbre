import fs from "node:fs";
const p = "lib/search.mjs";
let s = fs.readFileSync(p, "utf8");
const pairs = [
  ["async function searchSearx(settings, query, limit, attempts = SEARX_ATTEMPTS_PER_QUERY) {", "async function searchSearx(settings, query, limit, attempts = SEARX_ATTEMPTS_PER_QUERY, strict = false) {"],
  ["const results = filterRelevantResults(query, parseSearxngResults(page.text, limit * 2)).slice(0, limit);", "const results = filterRelevantResults(query, parseSearxngResults(page.text, limit * 2), { strict }).slice(0, limit);"],
  ["async function searchDuckDuckGo(query, limit) {", "async function searchDuckDuckGo(query, limit, strict = false) {"],
  ["const results = filterRelevantResults(query, parseDuckDuckGo(first.text, limit * 2)).slice(0, limit);", "const results = filterRelevantResults(query, parseDuckDuckGo(first.text, limit * 2), { strict }).slice(0, limit);"],
  ["const results = filterRelevantResults(query, parseDuckDuckGoLite(lite.text, limit * 2)).slice(0, limit);", "const results = filterRelevantResults(query, parseDuckDuckGoLite(lite.text, limit * 2), { strict }).slice(0, limit);"],
  ["export async function searchWebDetailed(settings, query, { count, attempts } = {}) {", "export async function searchWebDetailed(settings, query, { count, attempts, strict = false } = {}) {"],
  ["const searx = await searchSearx(settings, clean, limit, attempts);", "const searx = await searchSearx(settings, clean, limit, attempts, strict);"],
  ["const ddg = await searchDuckDuckGo(clean, limit);", "const ddg = await searchDuckDuckGo(clean, limit, strict);"],
  ["export async function searchMany(settings, queries, { perQuery = 5, pages = 0, onProgress, searchAttempts, searchBudgetMs } = {}) {", "export async function searchMany(settings, queries, { perQuery = 5, pages = 0, onProgress, searchAttempts, searchBudgetMs, strict = false } = {}) {"],
  ["searchWebDetailed(settings, query, { count: perQuery, attempts: searchAttempts })", "searchWebDetailed(settings, query, { count: perQuery, attempts: searchAttempts, strict })"],
];
for (const [from, to] of pairs) {
  const before = s;
  s = s.replaceAll(from, to);
  console.log(before === s ? "NO MATCH" : "OK", from.slice(0, 70));
}
fs.writeFileSync(p, s);
