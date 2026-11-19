import path from "node:path";
import { Store } from "../lib/store.mjs";
import { seedDemo, clearDemo } from "../lib/demo.mjs";
const store = new Store(path.join(process.env.TEMP, "lumbre-cleartest"));
await store.init();
await seedDemo(store);
try { await clearDemo(store); console.log("CLEAR OK"); } catch (e) { console.error("ERR", e.stack); }
