const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const q = "Avanluce Barcelona iluminación";
const r = await fetch(`https://www.google.com/search?q=${encodeURIComponent(q)}&hl=es&num=10`, { headers:{"user-agent":ua,"accept":"text/html","accept-language":"es-ES,es;q=0.9"}, signal:AbortSignal.timeout(20000) });
const t = await r.text();
const i = t.toLowerCase().indexOf("avanluce");
console.log("GOOGLE ctx:", t.slice(Math.max(0,i-600), i+600).replace(/\s+/g," "));
console.log("google url patterns:", ["/url?q=","url?esrc","href=\"https://www.avanluce","AF_initDataCallback","data-ved"].map(p=>p+":"+((t.match(new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"g"))||[]).length)));
