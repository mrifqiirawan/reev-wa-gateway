import {belajarConfigured} from './belajar-client.js';
import type {Express,Request,Response} from 'express';
import {validateConfig,defaultBotConfig} from '../shared/bot.js';
import {BotStore} from './bot-store.js';
import {BotEngine,normalizePhone,categoryReply} from './bot-engine.js';
export function installBotApi(app:Express,store:BotStore,engine:BotEngine){
 const route=(fn:(req:Request,res:Response)=>Promise<any>)=>async(req:Request,res:Response)=>{try{await fn(req,res)}catch(e){res.status(400).json({success:false,error:e instanceof Error?e.message:'Permintaan gagal.'})}};
 app.get('/api/bot',route(async(_req,res)=>{
  const integrationConfigured=belajarConfigured();
  if(!store.configured)return res.json({success:true,configured:false,integrationConfigured,config:defaultBotConfig,revision:0});
  res.json({success:true,configured:true,integrationConfigured,...await store.config()});
 }));
 app.put('/api/bot/config',route(async(req,res)=>{
  const c=validateConfig(req.body.config);if(!Number.isInteger(req.body.revision))throw Error('Revisi wajib.');
  const revision=await store.rpc('gw_save_config',{p_config:c,p_revision:req.body.revision});engine.invalidate();res.json({success:true,revision});
 }));
 app.post('/api/bot/preview',route(async(req,res)=>{const c=validateConfig(req.body.config);const tier=['standard','premium','vip'].includes(req.body.tier)?req.body.tier:'standard';res.json({success:true,reply:categoryReply(c,{plan:c.plans[tier],remaining:c.plans[tier].points},req.body.category||undefined)})}));
 app.get('/api/bot/members',route(async(req,res)=>{const search=String(req.query.search||'').replace(/[^0-9+]/g,'').slice(0,20),offset=Math.max(0,Math.min(100000,Number(req.query.offset)||0));res.json({success:true,...await store.rpc('gw_members_page',{p_search:search,p_offset:offset})})}));
 app.post('/api/bot/members',route(async(req,res)=>{
  const b=req.body;if(!['standard','premium','vip'].includes(b.tier)||typeof b.blocked!=='boolean'||!Number.isInteger(b.adjust)||Math.abs(b.adjust)>1000000||typeof b.reason!=='string'||b.reason.trim().length<3||b.reason.length>300||!/^[-0-9a-f]{36}$/i.test(b.requestId))throw Error('Pengaturan anggota tidak valid.');
  if(b.tier!=='standard'&&(!Number.isFinite(Date.parse(b.expiresAt))||Date.parse(b.expiresAt)<=Date.now()))throw Error('Masa aktif harus di masa depan.');
  await store.rpc('gw_member_edit',{p_phone:normalizePhone(b.phone),p_tier:b.tier,p_expires:b.tier==='standard'?null:b.expiresAt,p_blocked:b.blocked,p_adjust:b.adjust,p_reason:b.reason,p_request:b.requestId});res.json({success:true});
 }));
 app.get('/api/bot/runs',route(async(req,res)=>{const offset=Math.max(0,Math.min(100000,Number(req.query.offset)||0));const rows=await store.request(`gw_runs?select=event_key,phone,command,cost,charged,state,delivery,created_at,provider_id&order=created_at.desc&limit=25&offset=${offset}`);res.json({success:true,rows})}));
 app.post('/api/bot/resolve',route(async(req,res)=>{if(!['failed','delivered'].includes(req.body.status)||typeof req.body.reason!=='string'||req.body.reason.trim().length<3)throw Error('Status/alasan wajib.');await store.rpc('gw_resolve',{p_event:req.body.event,p_status:req.body.status,p_reason:req.body.reason});res.json({success:true})}));
 app.get('/api/bot/audit',route(async(req,res)=>{const offset=Math.max(0,Math.min(100000,Number(req.query.offset)||0));res.json({success:true,rows:await store.request(`gw_audit?select=id,action,phone,detail,created_at&order=id.desc&limit=25&offset=${offset}`)})}));
}
