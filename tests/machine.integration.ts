import assert from "node:assert/strict";
import {test} from "node:test";
import {mkdir,writeFile} from "node:fs/promises";
import path from "node:path";
import manifest from "../contracts/plugin-manifest.json" with {type:"json"};
import {newProject,clone} from "../src/domain/model.ts";
import {config} from "../src/domain/config.ts";
import {scenario,original,sha,base,selection} from "./support/scenario.ts";
import {start} from "./support/machine.ts";
import {importText} from "./support/import.ts";
import {prepareMedia} from "./support/assets.ts";
const slug=manifest.id.replace("org.wordflowlab.","");
const error=(r:any)=>r.error?.code??r.data?.result?.error?.code;
test("正式机器入口全动作、固定成果、恢复与热插拔",{timeout:1200000},async t=>{
 const c=await start();let serial=0;const key=()=>"machine-"+(++serial);const files:any[]=[];
 const artifact=async(action:string,r:any,args:any={})=>{let offset=0,expected:string|undefined,total:number|undefined;const chunks:Buffer[]=[];
 do{const v=await c.invoke(action,{...selection(r),...args,offset,max_bytes:8192});const b=Buffer.from(v.base64,"base64");assert.equal(v.offset,offset);assert.equal(sha(b),v.chunk_sha256);expected??=v.sha256;total??=v.total_bytes;assert.equal(v.sha256,expected);chunks.push(b);if(v.next_offset===null)break;assert.equal(v.next_offset,offset+b.length);offset=v.next_offset;}while(offset<32*1024*1024);
 const bytes=Buffer.concat(chunks);assert.equal(bytes.length,total);assert.equal(sha(bytes),expected);return bytes;};
 try{
 t.diagnostic(c.directory);assert.equal(c.cap.access_mode,"open");
 for(const resource of [undefined,"references/operations.md","references/workflows.md"]){const v=await c.invoke("skills.read",{skill_id:slug,...(resource?{resource}:{})});assert.ok(v.content.length>100);}
 const refs=await importText(c,[original]),p=scenario(c.work);await prepareMedia(c,p,refs,slug);
 let r=await c.invoke("save_project",{content:p,source_refs:refs,expected_revision:0,expected_sha256:"",operation_key:"seed"});const initial=r;

 if(slug==="world-studio"){
  const date=await c.invoke("convert_date",{...selection(r),calendar_id:"harbour",date:p.markers[0].date});assert.equal(date.leap_year,true);
  assert.equal((await c.invoke("compare_dates",{...selection(r),from_marker_id:"arrival",to_marker_id:"departure"})).difference_days,1);
  assert.equal((await c.invoke("check_rules",selection(r))).hypotheses.length,1);
  assert.equal((await c.invoke("simulate_resources",{...selection(r),scenario_id:"closed-port"})).balances[0].balance,-3);
  assert.deepEqual((await c.invoke("preview_impact",{...selection(r),rule_id:"tide"})).scenario_ids,["closed-port"]);
 }
 if(slug==="mystery-lab"){
  const view=await c.invoke("reader_view",{...selection(r),stage_id:"opening"});assert.equal(view.clues.length,1);assert.ok(!JSON.stringify(view).includes("旧钥匙压痕"));
  assert.equal((await c.invoke("evaluate_hypotheses",{...selection(r),stage_id:"opening"})).hypotheses[1].status,"undetermined");
  assert.equal((await c.invoke("check_mystery",selection(r))).author_conflicts.length,0);
  assert.equal((await c.invoke("compare_stages",{...selection(r),from_stage_id:"opening",to_stage_id:"second-scene"})).newly_visible.length,1);
  assert.equal((await c.invoke("locate_clue",{...selection(r),clue_id:"seal"})).ranges[0].quote,original);
 }
 if(slug==="art-direction"){
  const report=await c.invoke("check_designs",selection(r));assert.equal(report.images.length,2);assert.deepEqual(report.stale_notes,[]);
  assert.equal((await c.invoke("palette_contrast",{...selection(r),palette_id:"rain"})).pairs.length,3);
  for(const action of ["render_board","export_board"]){const bytes=await artifact(action,r,{board_id:"harbour-board"});assert.match(bytes.toString(),/data:image\/png;base64/);if(action==="export_board")files.push({name:"美术参考板.html",bytes});}
  assert.ok((await c.invoke("compare_designs",{...selection(r),from_design_id:"coat-one",to_design_id:"coat-two"})).changes.includes("requirements"));
  assert.equal((await c.invoke("locate_reference",{...selection(r),reference_id:"rain-reference"})).notes.length,1);
 }
 if(slug==="subtitle-studio"){
  const text="1\n00:00:00,100 --> 00:00:01,900\n雨港来信\n",bytes=Buffer.from(text),file={filename:"字幕.srt",base64:bytes.toString("base64"),sha256:sha(bytes)};
  assert.equal((await c.invoke("preview_import",{file,format:"srt"})).imported,false);
  r=await c.invoke("import_subtitles",{...base(r,key()),file,format:"srt",track:{id:"imported",title:"导入试验",language:"zh-CN",source_track_id:null}});
  const d=await c.invoke("cue_digest",{...selection(r),cue_id:"zh-one"});r=await c.invoke("put_note",{...base(r,key()),note:{id:"fixed-note",cue_id:"zh-one",cue_sha256:d.cue_sha256,comment:"保留原字幕意见",status:"open",resolution:""}});
  r=await c.invoke("shift_track",{...base(r,key()),track_id:"zh",offset_ms:50});assert.deepEqual((await c.invoke("check_subtitles",selection(r))).stale_note_ids,["fixed-note"]);
  assert.equal((await c.invoke("locate_time",{...selection(r),track_id:"zh",time_ms:r.object.content.cues[0].start_ms})).cues.length,1);
  for(const format of ["srt","vtt","ass"]){const bytes=await artifact("export_subtitles",r,{track_id:"zh",format});assert.ok(bytes.length>30);files.push({name:"字幕."+format,bytes});}
 }
 for(const [item,field] of Object.entries(config.fields))for(const row of r.object.content[field as string])r=await c.invoke("put_"+item,{...base(r,key()),[item]:row});
 assert.equal((await c.invoke("list_projects",{query:"雨港"})).objects.length,1);
 assert.equal((await c.invoke("get_source",{...selection(r),source_index:0})).source.content,original);
 const before=r;const edit={...base(r,key()),content:{...r.object.content,title:"雨港来信 第二版"}};r=await c.invoke("save_project",edit);assert.equal((await c.invoke("save_project",edit)).sha256,r.sha256);
 assert.equal(error(await c.raw("save_project",{...edit,content:{...edit.content,title:"同键异参"}})),"idempotency_conflict");
 assert.equal(error(await c.raw("save_project",{...edit,operation_key:key()})),"revision_conflict");
 assert.equal((await c.invoke("get_operation",{operation_key:edit.operation_key})).sha256,r.sha256);
 r=await c.invoke("save_project",{...base(r,key()),content:{...r.object.content,basis_refs:[{owner_plugin_id:manifest.id,object_id:initial.object.object_id,revision:initial.object.revision,sha256:initial.sha256}]}});
 assert.equal((await c.invoke("get_basis",{...selection(r),basis_index:0})).basis.sha256,initial.sha256);
 const fixed=selection(r),finalSHA=r.sha256;
 await c.invoke("build_context",{...fixed,goal:"沿固定依据继续创作",max_chars:12000});
 assert.equal((await c.invoke("create_handoff",{...fixed,goal:"准备下一阶段候选"})).basis_ref.sha256,finalSHA);
 await c.invoke("compare_versions",{object_id:r.object.object_id,from_revision:before.object.revision,to_revision:r.object.revision});
 for(const format of ["json","markdown","html"]){const v=await c.invoke("export_project",{...fixed,format,max_bytes:48000});assert.ok(v.total_bytes>100);}
 const read=c.cli("hetu.plugins.invoke",{...c.binding,capabilities_sha256:c.cap.capabilities_sha256,action:"get_project",arguments:fixed});assert.equal(read.status,"succeeded");
 const scratch=clone(r.object.content);if(slug==="reader-review"){scratch.submissions=[];scratch.decisions=[];}
 let remove=await c.invoke("save_project",{content:{...scratch,title:"独立移除用例"},source_refs:refs,expected_revision:0,expected_sha256:"",operation_key:key()});
 for(const [item,field] of Object.entries(config.fields).reverse())for(const row of [...remove.object.content[field as string]].reverse())if(manifest.contributions.actions.some(a=>a.id==="remove_"+item))remove=await c.invoke("remove_"+item,{...base(remove,key()),[item+"_id"]:row.id});
 assert.equal((await c.invoke("get_project",fixed)).sha256,finalSHA);
 await c.apply("disable");assert.ok(error(await c.raw("get_project",fixed)));await c.apply("enable");await c.discover();assert.equal((await c.invoke("get_project",fixed)).sha256,finalSHA);
 await c.apply("uninstall");assert.ok(error(await c.raw("get_project",fixed)));await c.apply("install");await c.discover();assert.equal((await c.invoke("get_project",fixed)).sha256,finalSHA);
 assert.deepEqual(manifest.contributions.actions.map(a=>a.id).filter(a=>!c.actions.has(a)),[]);
 const dir=process.env.HETU_RECEIPT_DIRECTORY??"docs/research";await mkdir(dir,{recursive:true});for(const f of files)await writeFile(path.join(dir,f.name),f.bytes);
 await writeFile(path.join(dir,"runtime-acceptance.json"),JSON.stringify({recorded_at:new Date().toISOString(),plugin_id:manifest.id,package_sha256:c.pkg.package_sha256,host_version:c.coreVersion,platform:process.platform,architecture:process.arch,actions:[...c.actions],skill_resources:3,lifecycle:["install","disable","enable","uninstall","install"],fixed_history:true,CAS:true,original_key_recovery:true,artifact_sha256_verified:true,limits:["没有付费模型、作者采纳、定稿或Windows/Linux专业运行验收"]},null,2)+"\n");
 }finally{await c.client.close();}
});
