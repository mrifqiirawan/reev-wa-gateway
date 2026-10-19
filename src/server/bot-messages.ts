import {proto} from '@whiskeysockets/baileys';
import type {Choice} from './bot-engine.js';
export function selectedCommand(content:proto.IMessage):string{
 const native=content.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
 if(native){try{const p=JSON.parse(native);if(typeof p.id==='string'&&p.id.length<=100)return p.id;}catch{}}
 return content.buttonsResponseMessage?.selectedButtonId||content.templateButtonReplyMessage?.selectedId||content.listResponseMessage?.singleSelectReply?.selectedRowId||'';
}
export function interactiveContent(text:string,choices:Choice[]):proto.IMessage{
 return {viewOnceMessage:{message:{messageContextInfo:{deviceListMetadata:{},deviceListMetadataVersion:2},interactiveMessage:{body:{text},footer:{text:'Pilihan juga dapat diketik sebagai perintah.'},header:{hasMediaAttachment:false},nativeFlowMessage:{buttons:[{name:'single_select',buttonParamsJson:JSON.stringify({title:'Pilih menu',sections:[{title:'REEV WA',rows:choices.slice(0,10).map(x=>({id:x.id,title:x.title.slice(0,60),description:x.description?.slice(0,100)}))}]})}]}}}}};
}
