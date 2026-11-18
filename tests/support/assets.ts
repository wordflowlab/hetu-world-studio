import {managed} from "./creative.ts";
import {sha} from "./scenario.ts";
import {readFile} from "node:fs/promises";
import path from "node:path";
export async function importAsset(c:any,bytes:Buffer,filename:string,key:string){const inline={filename,base64:bytes.toString("base64"),sha256:sha(bytes)};
const scan=await c.ok("hetu_managed_assets_inspect",{management_ref:c.management,work_ref:c.work,inline_source:inline});
const v=await managed(c,"assets.import",{work_ref:c.work,inline_source:inline,expected_file:{sha256:scan.sha256,size_bytes:scan.size_bytes},title:filename,source:{source_type:"author_supplied",creator_statement:"本轮隔离验收原创绘画或本机系统语音样本"},rights_status:"unknown",redistribution_allowed:false,rights_statement:"",operation_key:key},key);
return {kind:"asset",work_ref:c.work,asset_id:v.asset.asset_id,revision:v.asset.revision,sha256:v.sha256};}
export async function prepareMedia(c:any,p:any,refs:any[],slug:string){
 if(slug==="art-direction"){
  const bytes=await readFile("tests/fixtures/rain-harbour.png");refs.push(await importAsset(c,bytes,"雨港原创参考.png","art"));
  p.references=[{id:"rain-reference",title:"雨港旧邮局",asset_source_index:refs.length-1,role:"reference",crop:null,notes:"雨幕与旧木，只作为气氛参考。"},{id:"coat-reference",title:"服装局部参考",asset_source_index:refs.length-1,role:"design",crop:{x:.25,y:.1,width:.65,height:.8},notes:"造型候选，与人物正式选用分开。"}];
  p.boards[0].reference_ids=p.references.map((r:any)=>r.id);for(const design of p.designs)design.reference_ids=["coat-reference"];
  p.notes=[{id:"region-note",reference_id:"rain-reference",asset_sha256:sha(bytes),region:{x:.45,y:.2,width:.3,height:.45},comment:"人物轮廓从雨幕中再清楚一点。",status:"open",resolution:""}];
 }
 if(slug==="subtitle-studio"){
  const bytes=await readFile("tests/fixtures/harbour-dialogue.mp4"),timing=JSON.parse(await readFile("tests/fixtures/media.json","utf8"));refs.push(await importAsset(c,bytes,"雨港对白预演.mp4","subtitles"));p.media={asset_source_index:refs.length-1,duration_ms:timing.duration_ms};
  for(const cue of p.cues){const n=cue.id.endsWith("one")?0:1;cue.start_ms=timing.lines[n].start_ms;cue.end_ms=timing.lines[n].end_ms;cue.alignment="manual";}
 }
 return refs;
}
