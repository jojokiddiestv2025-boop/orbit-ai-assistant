import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configStatus, handleApi } from './lib/api.js';

const root=fileURLToPath(new URL('.',import.meta.url));
const staticRoot=join(root,'public');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
try{for(const line of (await readFile(join(root,'.env'),'utf8')).split(/\r?\n/)){const m=line.match(/^\s*([\w]+)\s*=\s*(.*?)\s*$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'')}}catch{}
const send=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data))};
async function readBody(req){let s='';for await(const c of req){s+=c;if(s.length>8_000_000)throw Object.assign(Error('Request too large. Choose a smaller image.'),{status:413})}return JSON.parse(s||'{}')}

async function main(req,res){
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/config'&&req.method==='GET')return send(res,200,configStatus());
  const route={'/api/chat':'chat','/api/voice':'voice','/api/vision':'vision'}[url.pathname];
  if(route&&req.method==='POST'){
    try{return await handleApi(req,res,route,await readBody(req))}
    catch(e){return send(res,e.status||400,{error:e.message||'Something went wrong.'})}
  }
  if(req.method==='GET'){
    const path=url.pathname==='/'?'index.html':url.pathname.slice(1);
    if(!['index.html','styles.css','app.js'].includes(path)){res.writeHead(404);return res.end('Not found')}
    try{const data=await readFile(join(staticRoot,path));res.writeHead(200,{'content-type':mime[extname(path)]});return res.end(data)}
    catch{res.writeHead(404);return res.end('Not found')}
  }
  return send(res,404,{error:'Not found'});
}

const port=Number(process.env.PORT||3000);
http.createServer((req,res)=>main(req,res)).listen(port,()=>console.log('Mine AI ready at http://localhost:'+port));
