import {escapeHTML,htmlPage} from "./presentation.ts";
import {summaries} from "./professional.ts";
export const labels:Record<string,string>={};
export const names:Record<string,string>={};
export function reportMarkdown(r:any){return "# "+r.project.title+"\n\n"+summaries(r.project).map((s:any)=>"## "+s.title+"\n\n"+s.lines.join("\n\n")).join("\n\n")+"\n\n专业成果，正文采纳与定稿独立决定。\n";}
export function reportHTML(r:any){return htmlPage(r.project.title,"<h1>"+escapeHTML(r.project.title)+"</h1>"+summaries(r.project).map((s:any)=>"<section><h2>"+escapeHTML(s.title)+"</h2>"+s.lines.map((l:string)=>"<p>"+escapeHTML(l)+"</p>").join("")+"</section>").join(""));}
