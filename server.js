import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('.',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const env={};
try { for(const line of (await readFile(join(root,'.env'),'utf8')).split(/\r?\n/)){const m=line.match(/^\s*([\w]+)\s*=\s*(.*?)\s*$/);if(m)env[m[1]]=m[2].replace(/^['"]|['"]$/g,'')} } catch {}
const keys={GROQ_API_KEY:env.GROQ_API_KEY||process.env.GROQ_API_KEY,GEMINI_API_KEY:env.GEMINI_API_KEY||process.env.GEMINI_API_KEY};
const send=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data))};
async function readBody(req){let s='';for await(const c of req){s+=c;if(s.length>8_000_000)throw Object.assign(Error('Request too large. Choose a smaller image.'),{status:413})}return JSON.parse(s||'{}')}
function imageContent(messages){
  return messages.map(m=>{
    if(!m.image)return {role:m.role,content:m.content};
    if(typeof m.image!=='string'||!/^data:image\/(jpeg|png|webp);base64,[\w+/=]+$/.test(m.image)||m.image.length>5_500_000)throw Error('Image is invalid or too large. Please choose a smaller image.');
    return {role:m.role,content:[{type:'text',text:m.content||'Describe this image.'},{type:'image_url',image_url:{url:m.image}}]};
  });
}
async function main(req,res){
  const u=new URL(req.url,'http://localhost');
  if(req.method==='GET'&&u.pathname==='/api/config')return send(res,200,{groq:!!keys.GROQ_API_KEY,gemini:!!keys.GEMINI_API_KEY});
  if(req.method==='POST'&&['/api/chat','/api/voice','/api/vision'].includes(u.pathname)){
    try{
      const {messages=[]}=await readBody(req);
      if(!Array.isArray(messages)||!messages.length)return send(res,400,{error:'Add a message first.'});
      let response,data;
      if(u.pathname==='/api/chat'||u.pathname==='/api/vision'){
        if(!keys.GROQ_API_KEY)throw Error('Groq key missing. Add GROQ_API_KEY to .env and restart.');
        const vision=u.pathname==='/api/vision';
        response=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{authorization:'Bearer '+keys.GROQ_API_KEY,'content-type':'application/json'},body:JSON.stringify({model:vision?'qwen/qwen3.8-27b':'llama-3.3-70b-versatile',messages:vision?imageContent(messages):messages,temperature:.7,max_completion_tokens:1024})});
        data=await response.json();if(!response.ok)throw Error(data.error?.message||'Groq request failed');return send(res,200,{answer:data.choices?.[0]?.message?.content});
      }
      if(!keys.GEMINI_API_KEY)throw Error('Gemini key missing. Add GEMINI_API_KEY to .env and restart.');
      const system=messages[0]?.content||'You are a warm, concise voice assistant.';
      response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key='+encodeURIComponent(keys.GEMINI_API_KEY),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:messages.slice(1).map(x=>({role:x.role==='assistant'?'model':'user',parts:[{text:x.content}]})),generationConfig:{temperature:.7}})});
      data=await response.json();if(!response.ok)throw Error(data.error?.message||'Gemini request failed');return send(res,200,{answer:data.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('')});
    }catch(e){return send(res,e.status||400,{error:e.message||'Something went wrong.'})}
  }
  if(req.method==='GET'){const path=u.pathname==='/'?'index.html':u.pathname.slice(1);try{const data=await readFile(join(root,path));res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream'});return res.end(data)}catch{return res.writeHead(404).end('Not found')}}
  return send(res,404,{error:'Not found'});
}
const port=Number(process.env.PORT||env.PORT||3000);
http.createServer((req,res)=>main(req,res)).listen(port,()=>console.log('Mine AI ready at http://localhost:'+port));
