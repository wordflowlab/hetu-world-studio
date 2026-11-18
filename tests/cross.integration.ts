import assert from 'node:assert/strict';
import {test} from 'node:test';
import {cp,readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {start} from './support/machine.ts';
import {importText} from './support/import.ts';
import {candidate,blueprint} from './support/creative.ts';
import {scenario,original,selection,base} from './support/scenario.ts';
const root=process.env.HETU_GH_ROOT??path.resolve('..');
const peers=JSON.parse(await readFile(new URL('../peer-lock.json',import.meta.url),'utf8')).peers;
const fixed=(record:any,slug:string)=>({owner_plugin_id:'org.wordflowlab.'+slug,object_id:record.object.object_id,revision:record.object.revision,sha256:record.sha256});
test('世界规则到悬疑返工、美术与双语字幕，并接续下一章',{timeout:1800000},async t=>{
 const c=await start(),stages:string[]=[],snapshots:any[]=[],handles=new Map<string,any>();
 async function connect(slug:string){
  if(slug==='world-studio')return {...c,directory:path.resolve('.'),scenario};
  const directory=path.join(root,'hetu-'+slug),pkgdir=path.join(c.directory,'cross-'+slug);await cp(path.join(directory,'dist'),pkgdir,{recursive:true});
  const pkg=await c.ok('hetu_plugins_inspect_package',{package_directory:pkgdir});
  assert.equal(pkg.package_sha256,peers.find((p:any)=>p.slug===slug)?.package_sha256,'联合验收必须使用固定同批包：'+slug);
  await c.ok('hetu_plugins_apply',{action:'install',plugin_id:pkg.manifest.id,package_directory:pkgdir,package_sha256:pkg.package_sha256,expected_sha256:(await c.ok('hetu_plugins_inspect')).state_sha256,operation_key:'cross-install-'+slug,authorization_note:'用户要求本批完整验收，安装固定同批插件，仅用于隔离示例'});
  const binding={management_ref:c.management,work_ref:c.work,plugin_id:pkg.manifest.id,package_sha256:pkg.package_sha256},cap=await c.ok('hetu_plugins_capabilities',binding);
  const invoke=async(action:string,args:any)=>{const r=await c.ok('hetu_plugins_invoke',{...binding,capabilities_sha256:cap.capabilities_sha256,action,arguments:args});assert.equal(r.result.status,'succeeded',JSON.stringify(r));return r.result.data;};
  const mod=await import(pathToFileURL(path.join(directory,'tests/support/scenario.ts')).href);return {pkg,binding,invoke,directory,scenario:mod.scenario};
 }
 const save=(h:any,p:any,refs:any[],key:string)=>h.invoke('save_project',{content:p,source_refs:refs,expected_revision:0,expected_sha256:'',operation_key:key});
 async function media(handle:any,context:any,p:any,refs:any[],slug:string){const mod=await import(pathToFileURL(path.join(handle.directory,'tests/support/assets.ts')).href);const cwd=process.cwd();process.chdir(handle.directory);try{await mod.prepareMedia(context,p,refs,slug);}finally{process.chdir(cwd);}}
 try{
  const refs=await importText(c,[original]),canon=await blueprint(c);refs.push(canon);
  const before=await c.ok('hetu_read_work',{management_ref:c.management,work_ref:c.work});
  const world=await save(c,scenario(c.work),refs,'cross-world');const resources=await c.invoke('simulate_resources',{...selection(world),scenario_id:'closed-port'});assert.equal(resources.balances[0].balance,-3);assert.equal(resources.assumptions[0].status,'hypothesis');
  stages.push('固定正文与设定，明确历法和封港假设，资源不足如实报告');
  const mystery=await connect('mystery-lab');handles.set('mystery-lab',mystery);const mp=mystery.scenario(c.work);mp.basis_refs=[fixed(world,'world-studio')];const mysteryRecord=await save(mystery,mp,refs,'cross-mystery');
  const early=await mystery.invoke('reader_view',{...selection(mysteryRecord),stage_id:'opening'}),later=await mystery.invoke('reader_view',{...selection(mysteryRecord),stage_id:'second-scene'});assert.equal(early.clues.length,1);assert.equal(later.clues.length,2);assert.ok(!JSON.stringify(early).includes('旧钥匙压痕'));assert.ok(!JSON.stringify(early).includes('author_truth'));
  stages.push('区分作者真相与读者可见线索，按揭示阶段核对假说');
  const first=await candidate(c,'第三章 封港\n\n林溪数过剩下的口粮，又把无名来信翻回正面。她还不知道钥匙的来历。\n','cross-first-candidate');
  const next=await c.invoke('put_rule',{...base(world,'cross-world-update'),rule:{...world.object.content.rules[1],statement:'配给只足两日，第三日需要新的补给来源。'}});
  assert.equal((await mystery.invoke('get_basis',{...selection(mysteryRecord),basis_index:0})).basis.sha256,world.sha256);
  assert.deepEqual((await c.invoke('preview_impact',{...selection(next),rule_id:'tide'})).scenario_ids,['closed-port']);
  stages.push('形成宿主参考稿，规则更新先看影响，旧跨插件依据保持');
  const art=await connect('art-direction');handles.set('art-direction',art);const ap=art.scenario(c.work),artRefs=[...refs];ap.basis_refs=[fixed(world,'world-studio'),fixed(mysteryRecord,'mystery-lab')];await media(art,c,ap,artRefs,'art-direction');ap.designs[0].entity_ref='character_11111111-1111-4111-8111-111111111111';ap.designs[0].entity_source_index=1;
  const artRecord=await save(art,ap,artRefs,'cross-art'),artCheck=await art.invoke('check_designs',selection(artRecord));assert.deepEqual(artCheck.stale_notes,[]);assert.equal(artCheck.images.length,2);
  stages.push('实际参考图、色板与服装方案关联固定人物，区域意见绑定图像摘要');
  const subtitles=await connect('subtitle-studio');handles.set('subtitle-studio',subtitles);const sp=subtitles.scenario(c.work),subRefs=[...refs,first.source_ref];sp.basis_refs=[fixed(artRecord,'art-direction'),fixed(mysteryRecord,'mystery-lab')];await media(subtitles,c,sp,subRefs,'subtitle-studio');let subtitleRecord=await save(subtitles,sp,subRefs,'cross-subtitles');
  const digest=await subtitles.invoke('cue_digest',{...selection(subtitleRecord),cue_id:'zh-one'});subtitleRecord=await subtitles.invoke('put_note',{...base(subtitleRecord,'cross-subtitle-note'),note:{id:'local-note',cue_id:'zh-one',cue_sha256:digest.cue_sha256,comment:'第一句应与信封画面一起出现。',status:'open',resolution:''}});
  const oldSubtitle=subtitleRecord;subtitleRecord=await subtitles.invoke('shift_track',{...base(subtitleRecord,'cross-shift'),track_id:'zh',offset_ms:40});assert.deepEqual((await subtitles.invoke('check_subtitles',selection(subtitleRecord))).stale_note_ids,['local-note']);assert.equal((await subtitles.invoke('get_project',selection(oldSubtitle))).sha256,oldSubtitle.sha256);
  for(const format of ['srt','vtt','ass']){const exportResult=await subtitles.invoke('export_subtitles',{...selection(subtitleRecord),track_id:'zh',format,max_bytes:65536});assert.equal(exportResult.next_offset,null);assert.ok(exportResult.total_bytes>30);}
  stages.push('实际对白媒体与双语字幕同源，偏移后旧意见保留并提示过期，三种格式完整交付');
  await candidate(c,'第四章 渡口\n\n第三日的配给已经不足。林溪收好钥匙，决定在封港前去见守站人。\n','cross-next-chapter');
  assert.equal((await c.invoke('get_source',{...selection(next),source_index:0})).source.content,original);const after=await c.ok('hetu_read_work',{management_ref:c.management,work_ref:c.work});assert.equal(after.sha256,before.sha256);
  stages.push('独立下一章候选接续，原著正文与旧专业修订保持，无采纳定稿');
  for(const [slug,record] of [['world-studio',next],['mystery-lab',mysteryRecord],['art-direction',artRecord],['subtitle-studio',subtitleRecord]] as const)snapshots.push({slug,ref:fixed(record,slug),package_sha256:slug==='world-studio'?c.pkg.package_sha256:handles.get(slug).pkg.package_sha256});
  const begin=await c.ok('hetu_begin_creation',{brief:'独立原创剧本中的G/H专业工程验收',locale:'zh-CN',operation_key:'target-begin'});
  const target=await c.ok('hetu_create_drama_from_project',{management_ref:begin.management_ref,project_id:begin.project.project_id,expected:{revision:begin.revision,sha256:begin.sha256},target_path:begin.target_path,profile:{title:'雨港 独立剧本',description:'不借用原著权限',mode:'original',language_tag:'zh-CN'},operation_key:'target-create'}),management=target.workspace_management_ref,work={workspace_id:management.scope_ref.id,kind:'drama',object_id:target.created_workspace_ref.drama_project_id};
  assert.notEqual((await c.call('hetu_read_work',{management_ref:c.management,work_ref:work})).status,'succeeded');
  for(const slug of ['world-studio','mystery-lab','art-direction','subtitle-studio']){const handle=slug==='world-studio'?c:handles.get(slug),binding={management_ref:management,work_ref:work,plugin_id:handle.pkg.manifest.id,package_sha256:handle.pkg.package_sha256},cap=await c.ok('hetu_plugins_capabilities',binding),mod=await import(pathToFileURL(slug==='world-studio'?path.resolve('src/domain/model.ts'):path.join(root,'hetu-'+slug,'src/domain/model.ts')).href);const r=await c.ok('hetu_plugins_invoke',{...binding,capabilities_sha256:cap.capabilities_sha256,action:'save_project',arguments:{content:mod.newProject('独立剧本专业工程'),source_refs:[],expected_revision:0,expected_sha256:'',operation_key:'target-'+slug}});assert.equal(r.result.status,'succeeded',JSON.stringify(r));assert.equal(r.result.data.object.work_ref.object_id,work.object_id);}
  stages.push('四包分别在独立剧本保存工程，单端读取另一作品被拒绝');
  const vb=await c.ok('hetu_begin_creation',{brief:'独立视频专业工程验收，不创建小说或剧本',locale:'zh-CN',operation_key:'video-begin'});
  const vp=await c.ok('hetu_save_creation_project',{management_ref:vb.management_ref,project_id:vb.project.project_id,expected:{revision:vb.revision,sha256:vb.sha256},brief:'独立雨港视频',selected_fields:{},work_profile:{work_type:'video',language_tag:'zh-CN',drama_mode:null},operation_key:'video-profile'});
  const vc=await c.ok('hetu_create_video_from_project',{management_ref:vb.management_ref,project_id:vb.project.project_id,expected:{revision:vp.revision,sha256:vp.sha256},target_path:vb.target_path,profile:{title:'雨港 独立视频',brief:'对白及美术专业工程验收',language_tag:'zh-CN'},operation_key:'video-create'});
  const vm=vc.workspace_management_ref,vw=vc.video_project.work_ref,videoSnapshots:any[]=[];
  assert.equal(vw.kind,'video');assert.notEqual((await c.call('hetu_read_work',{management_ref:c.management,work_ref:vw})).status,'succeeded');
  for(const slug of ['art-direction','subtitle-studio']){
   const h=handles.get(slug),binding={management_ref:vm,work_ref:vw,plugin_id:h.pkg.manifest.id,package_sha256:h.pkg.package_sha256},cap=await c.ok('hetu_plugins_capabilities',binding);
   const ctx={...c,management:vm,work:vw},content=h.scenario(vw),sources:any[]=[];
   await media(h,ctx,content,sources,slug);
   const saved=await c.ok('hetu_plugins_invoke',{...binding,capabilities_sha256:cap.capabilities_sha256,action:'save_project',arguments:{content,source_refs:sources,expected_revision:0,expected_sha256:'',operation_key:'video-'+slug}});
   assert.equal(saved.result.status,'succeeded',JSON.stringify(saved));const r=saved.result.data;assert.equal(r.object.work_ref.object_id,vw.object_id);
   const checked=await c.ok('hetu_plugins_invoke',{...binding,capabilities_sha256:cap.capabilities_sha256,action:slug==='art-direction'?'check_designs':'check_subtitles',arguments:selection(r)});assert.equal(checked.result.status,'succeeded',JSON.stringify(checked));
   videoSnapshots.push({slug,ref:fixed(r,slug)});
  }
  stages.push('独立视频分别保存实际参考板和实际媒体双语字幕，单端跨作品读取拒绝');

  const dir=process.env.HETU_RECEIPT_DIRECTORY??'docs/research';await mkdir(dir,{recursive:true});await writeFile(path.join(dir,'cross-acceptance.json'),JSON.stringify({recorded_at:new Date().toISOString(),host_version:c.coreVersion,platform:process.platform,architecture:process.arch,stages,snapshots,source_sha256:before.sha256,final_source_sha256:after.sha256,independent_target:work,independent_video:vw,video_snapshots:videoSnapshots,adopted:false,finalized:false,limits:['隔离原创与系统语音样本，不是文学、美术、表演或真实读者质量认可','未调用付费模型、外部发送、采纳或定稿']},null,2)+'\n');t.diagnostic(c.directory);
 }finally{await c.client.close();}
});
