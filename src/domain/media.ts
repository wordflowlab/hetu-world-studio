import {requireValue as need,data,canonical} from "../../vendor/project-store.ts";
import {hash,decode64} from "./artifact.ts";
export async function readBlob(source:any,request:any,limit=8*1024*1024){
 need(source?.kind==="asset","媒体必须是当前作品固定asset来源。");
 const chunks:Buffer[]=[];let offset=0,total:number|undefined,expected:string|undefined;
 do{const r=data(await request("hetu.extensions.sources.read_blob",{source_ref:source,offset,max_bytes:65536}));
 const b=decode64(r.base64,65536);need(r.offset===offset&&hash(b)===r.chunk_sha256,"媒体分块偏移或摘要不一致。");
 need(canonical(r.source_ref)===canonical(source)&&r.total_bytes<=limit&&(total===undefined||total===r.total_bytes)&&(expected===undefined||expected===r.sha256),"媒体固定引用、完整摘要、长度或预算不一致。");total=r.total_bytes;expected=r.sha256;chunks.push(b);offset+=b.length;
 if(r.next_offset===null)break;need(r.next_offset===offset&&b.length>0,"媒体分块不连续。");
 }while(offset<limit);
 const b=Buffer.concat(chunks);need(b.length===total&&hash(b)===expected,"媒体完整摘要不一致。");return b;
}
