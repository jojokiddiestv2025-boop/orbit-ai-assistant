import { configStatus } from '../lib/api.js';
export default function handler(req,res){
  res.setHeader('content-type','application/json; charset=utf-8');
  res.setHeader('cache-control','no-store');
  if(req.method!=='GET'){
    res.statusCode=405;
    return res.end(JSON.stringify({error:'Method not allowed.'}));
  }
  res.statusCode=200;
  return res.end(JSON.stringify(configStatus()));
}
