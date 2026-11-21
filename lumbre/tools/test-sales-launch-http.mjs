import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = await mkdtemp(path.join(os.tmpdir(), 'lucian-supervised-'));
const port = 46000 + Math.floor(Math.random() * 10000);
const base = `http://127.0.0.1:${port}`;
const proc = spawn(process.execPath, ['server.mjs'], {cwd:root,env:{...process.env,PORT:String(port),LUCIAN_DATA_DIR:data,LUCIAN_NO_OPEN:'1',LUCIAN_HOST:'127.0.0.1'},stdio:'ignore'});
async function call(route, body, expect) {
  const res = await fetch(base+route,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const j = await res.json();
  assert.equal(res.status,expect,`${route}: ${JSON.stringify(j)}`);
  return j;
}
try{
  let okay=false;
  for(let i=0;i<90;i++){try{if((await fetch(base+'/api/health')).ok){okay=true;break}}catch{};await new Promise(r=>setTimeout(r,120))}
  assert.ok(okay,'Servidor local iniciado');
  const before=await call('/api/state',undefined,200);
  assert.equal(before.salesLaunch.canStart,false,'Sin IA real configurada no debe correr');
  await call('/api/sales/prepare-one',{productId:'x'},400);
  await call('/api/sales/prepare-one',{confirm:true,productId:'x'},409);
  const after=await call('/api/state',undefined,200);
  assert.equal(after.counts.missions,before.counts.missions,'No se crean misiones por solicitudes rechazadas');
  console.log('OK HTTP: preflight visible, rechazo de inicio sin configuracion, y sin misiones creadas.');
}finally{proc.kill();await new Promise(r=>{if(proc.exitCode!==null)return r();proc.once('exit',r);setTimeout(r,1200)});await rm(data,{recursive:true,force:true})}
