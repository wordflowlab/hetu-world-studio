import {requireValue as need} from '../../vendor/project-store.ts';
export type WorldDate={year:number;month:number;day:number};
export type Calendar={id:string;title:string;epoch_year:number;months:{name:string;days:number}[];weekdays:string[];leap_every:number|null;leap_month:number;leap_days:number};
const find=(rows:any[],id:string,label:string)=>{const row=rows.find(x=>x.id===id);need(row,label+'不存在。');return row;};
const unique=(ids:string[],label:string)=>need(new Set(ids).size===ids.length,label+'不能重复。');
export const isLeap=(c:Calendar,year:number)=>c.leap_every!==null&&year>0&&year%c.leap_every===0;
export function ordinal(c:Calendar,date:WorldDate){
 need(date.year>=c.epoch_year&&date.year<=9999&&Number.isInteger(date.year),'日期超出历法纪元。');
 need(Number.isInteger(date.month)&&date.month>=1&&date.month<=c.months.length,'月份不存在。');
 const max=c.months[date.month-1].days+(isLeap(c,date.year)&&date.month===c.leap_month?c.leap_days:0);
 need(Number.isInteger(date.day)&&date.day>=1&&date.day<=max,'日期不存在。');
 const before=(year:number)=>c.leap_every===null?0:Math.max(0,Math.floor((year-1)/c.leap_every));
 const value=(date.year-c.epoch_year)*c.months.reduce((n,m)=>n+m.days,0)+(before(date.year)-before(c.epoch_year))*c.leap_days+c.months.slice(0,date.month-1).reduce((n,m)=>n+m.days,0)+(isLeap(c,date.year)&&date.month>c.leap_month?c.leap_days:0)+date.day-1;
 need(Number.isSafeInteger(value),'纪日超出安全整数。');return value;
}
export function ruleReport(p:any){
 const colors=new Map<string,number>(),stack:string[]=[],cycles:string[][]=[];
 function visit(id:string){if(colors.get(id)===2)return;if(colors.get(id)===1){cycles.push([...stack.slice(stack.indexOf(id)),id]);return;}colors.set(id,1);stack.push(id);for(const parent of find(p.rules,id,'规则').premise_rule_ids)visit(parent);stack.pop();colors.set(id,2);}
 for(const rule of p.rules)visit(rule.id);
 return {cycles,hypotheses:p.rules.filter((r:any)=>r.status==='hypothesis').map((r:any)=>({id:r.id,title:r.title})),author_declared:p.rules.filter((r:any)=>r.status==='author_declared').map((r:any)=>({id:r.id,title:r.title})),structurally_acyclic:cycles.length===0,note:'声明与假设是前提；依赖无环不能证明制度合理或规则真实。'};
}
export function resourceReport(p:any,scenarioID:string){
 const scenario=find(p.scenarios,scenarioID,'情景'),balance=new Map<string,number>(p.resources.map((r:any)=>[r.id,r.initial])),steps:any[]=[],findings:any[]=[];
 for(const resource of p.resources)if(resource.minimum!==null&&resource.initial<resource.minimum)findings.push({resource_id:resource.id,event_id:null,balance:resource.initial,minimum:resource.minimum});
 for(const event of scenario.events){const resource=find(p.resources,event.resource_id,'资源');need(event.unit===resource.unit,'事件单位与资源不一致。');const next=balance.get(resource.id)!+event.delta;need(Number.isSafeInteger(next),'资源计算超出安全整数。');balance.set(resource.id,next);steps.push({...event,balance:next});if(resource.minimum!==null&&next<resource.minimum)findings.push({resource_id:resource.id,event_id:event.id,balance:next,minimum:resource.minimum});}
 return {scenario_id:scenario.id,title:scenario.title,assumptions:scenario.assumed_rule_ids.map((id:string)=>find(p.rules,id,'规则')).map((r:any)=>({id:r.id,title:r.title,status:r.status})),steps,balances:p.resources.map((r:any)=>({resource_id:r.id,name:r.name,unit:r.unit,balance:balance.get(r.id)})),findings,note:'仅按明确整数事件计算，不推断真实经济、补给或社会结果。'};
}
export function impact(p:any,ruleID:string){
 find(p.rules,ruleID,'规则');const affected=new Set([ruleID]);let changed=true;while(changed){changed=false;for(const rule of p.rules)if(!affected.has(rule.id)&&rule.premise_rule_ids.some((id:string)=>affected.has(id))){affected.add(rule.id);changed=true;}}
 return {changed_rule_id:ruleID,affected_rules:p.rules.filter((r:any)=>affected.has(r.id)).map((r:any)=>({id:r.id,title:r.title})),scenario_ids:p.scenarios.filter((s:any)=>s.assumed_rule_ids.some((id:string)=>affected.has(id))).map((s:any)=>s.id),note:'仅预览显式依赖；未登记的语义影响需要Agent补读判断，旧情景保持。'};
}
export function validateDomain(p:any){
 for(const c of p.calendars){need(c.months.length>0&&c.weekdays.length>0,'历法必须定义月份及星期。');need(c.leap_month<=c.months.length,'闰月位置不存在。');unique(c.months.map((m:any)=>m.name),'月份名');}
 for(const marker of p.markers)ordinal(find(p.calendars,marker.calendar_id,'历法'),marker.date);
 for(const rule of p.rules){unique(rule.premise_rule_ids,'规则前提');for(const id of rule.premise_rule_ids)find(p.rules,id,'规则前提');}
 for(const s of p.scenarios){unique(s.assumed_rule_ids,'情景假设');unique(s.events.map((e:any)=>e.id),'情景事件');for(const id of s.assumed_rule_ids)find(p.rules,id,'情景规则');for(const e of s.events){const r=find(p.resources,e.resource_id,'资源');need(r.unit===e.unit,'事件单位与资源不一致。');}}
}
export async function checkSources(_p:any,_sources:any[],_request:any){}
export async function pureAction(_a:string,_i:any){return undefined;}
export async function writeProfessional(_a:string,_p:any,_s:any[],_i:any,_request:any){need(false,'未知专业写动作。');}
export async function readProfessional(action:string,p:any,_sources:any[],i:any,_request:any):Promise<any>{
 if(action==='convert_date'){const c=find(p.calendars,i.calendar_id,'历法'),day=ordinal(c,i.date);return {calendar_id:c.id,date:i.date,ordinal_day:day,weekday:c.weekdays[day%c.weekdays.length],leap_year:isLeap(c,i.date.year),basis:'第0日为纪元年首月首日，星期从首项开始；闰年为非零绝对年份的leap_every倍数。'};}
 if(action==='compare_dates'){const a=find(p.markers,i.from_marker_id,'纪年事件'),b=find(p.markers,i.to_marker_id,'纪年事件');need(a.calendar_id===b.calendar_id,'不同历法没有已声明换算，不比较日期。');const c=find(p.calendars,a.calendar_id,'历法');return {from:a,to:b,difference_days:ordinal(c,b.date)-ordinal(c,a.date),unit:'day'};}
 if(action==='check_rules')return ruleReport(p);
 if(action==='simulate_resources')return resourceReport(p,i.scenario_id);
 if(action==='preview_impact')return impact(p,i.rule_id);
}
export function summaries(p:any){return [{title:'历法与纪年',lines:[...p.calendars.map((c:any)=>`${c.title}：${c.months.length}个月，纪元${c.epoch_year}年`),...p.markers.map((m:any)=>`${m.title}：${m.date.year}年${m.date.month}月${m.date.day}日`)]},{title:'制度与假设',lines:p.rules.map((r:any)=>`${r.title}（${r.status==='hypothesis'?'假设':'作者声明'}）：${r.statement}`)},{title:'资源情景',lines:p.scenarios.map((s:any)=>`${s.title}：${s.events.length}次明确收支`)}];}

export function validateTransition(_next:any,_previous:any){}
