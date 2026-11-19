const r = await fetch("http://127.0.0.1:4399/api/state");
const s = await r.json();
console.log(s.threads.slice(0,3).map(t => ({id:t.id, email:t.contact?.email, keys:Object.keys(t)})));
console.log("settings ai", s.settings.ai);
