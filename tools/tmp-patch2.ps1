$p = "lib/search.mjs"
$s = Get-Content -Raw -Encoding utf8 $p
$s = $s.Replace("async function searchSearx(settings, query, limit, attempts = SEARX_ATTEMPTS_PER_QUERY) {", "async function searchSearx(settings, query, limit, attempts = SEARX_ATTEMPTS_PER_QUERY, strict = false) {")
$s = $s.Replace("const results = filterRelevantResults(query, parseSearxngResults(page.text, limit * 2)).slice(0, limit);", "const results = filterRelevantResults(query, parseSearxngResults(page.text, limit * 2), { strict }).slice(0, limit);")
$s = $s.Replace("async function searchDuckDuckGo(query, limit) {", "async function searchDuckDuckGo(query, limit, strict = false) {")
$s = $s.Replace("const results = filterRelevantResults(query, parseDuckDuckGo(first.text, limit * 2)).slice(0, limit);", "const results = filterRelevantResults(query, parseDuckDuckGo(first.text, limit * 2), { strict }).slice(0, limit);")
$s = $s.Replace("const results = filterRelevantResults(query, parseDuckDuckGoLite(lite.text, limit * 2)).slice(0, limit);", "const results = filterRelevantResults(query, parseDuckDuckGoLite(lite.text, limit * 2), { strict }).slice(0, limit);")
$s = $s.Replace("export async function searchWebDetailed(settings, query, { count, attempts } = {}) {", "export async function searchWebDetailed(settings, query, { count, attempts, strict = false } = {}) {")
$s = $s.Replace("const searx = await searchSearx(settings, clean, limit, attempts);", "const searx = await searchSearx(settings, clean, limit, attempts, strict);")
$s = $s.Replace("const ddg = await searchDuckDuckGo(clean, limit);", "const ddg = await searchDuckDuckGo(clean, limit, strict);")
$s = $s.Replace("export async function searchMany(settings, queries, { perQuery = 5, pages = 0, onProgress, searchAttempts, searchBudgetMs } = {}) {", "export async function searchMany(settings, queries, { perQuery = 5, pages = 0, onProgress, searchAttempts, searchBudgetMs, strict = false } = {}) {")
$s = $s.Replace("searchWebDetailed(settings, query, { count: perQuery, attempts: searchAttempts })", "searchWebDetailed(settings, query, { count: perQuery, attempts: searchAttempts, strict })")
Set-Content -Encoding utf8 -NoNewline $p $s
Write-Host "patched search"
