const groqKey=()=>process.env.GROQ_API_KEY;
const geminiKey=()=>process.env.GEMINI_API_KEY;

function send(res,status,data){
  if(typeof res.status==='function')return res.status(status).json(data);
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
  res.end(JSON.stringify(data));
}

export function configStatus(){return {groq:!!groqKey(),gemini:!!geminiKey()}}

function withVisionImages(messages){
  return messages.map(m=>{
    if(!m.image)return {role:m.role,content:m.content};
    if(typeof m.image!=='string'||!/^data:image\/(jpeg|png|webp);base64,[\w+/=]+$/.test(m.image)||m.image.length>3_700_000)throw Error('Image is invalid or too large. Please choose a smaller image.');
    return {role:m.role,content:[{type:'text',text:m.content||'Describe this image.'},{type:'image_url',image_url:{url:m.image}}]};
  });
}

export async function handleApi(req,res,kind,body=req.body){
  if(req.method!=='POST')return send(res,405,{error:'Method not allowed.'});
  const messages=body?.messages;
  if(!Array.isArray(messages)||!messages.length)return send(res,400,{error:'Add a message first.'});
  try{
    let response,data;
    if(kind==='chat'||kind==='vision'){
      if(!groqKey())throw Error('Groq key missing. Add GROQ_API_KEY to your environment variables.');
      const vision=kind==='vision';
      response=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{authorization:'Bearer '+groqKey(),'content-type':'application/json'},body:JSON.stringify({model:vision?'qwen/qwen3.8-27b':'llama-3.3-70b-versatile',messages:vision?withVisionImages(messages):messages,temperature:.7,max_completion_tokens:1024})});
      data=await response.json();if(!response.ok)throw Error(data.error?.message||'Groq request failed.');
      return send(res,200,{answer:data.choices?.[0]?.message?.content});
    }
    if(kind!=='voice')return send(res,404,{error:'Not found.'});
    if(!geminiKey())throw Error('Gemini key missing. Add GEMINI_API_KEY to your environment variables.');
    const system=messages[0]?.content||'You are a warm, concise voice assistant.';
    response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key='+encodeURIComponent(geminiKey()),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:messages.slice(1).map(x=>({role:x.role==='assistant'?'model':'user',parts:[{text:x.content}]})),generationConfig:{temperature:.7}})});
    data=await response.json();if(!response.ok)throw Error(data.error?.message||'Gemini request failed.');
    return send(res,200,{answer:data.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('')});
  }catch(e){return send(res,400,{error:e.message||'Something went wrong.'})}
}
