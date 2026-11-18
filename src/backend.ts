import type { BackendContext } from "../vendor/hetu-sdk.ts";
import { Project } from "./application/project.ts";
let app: Project | undefined;
export function apply(context: BackendContext) {
  app = new Project(context);
  context.effect(() => {
    app = undefined;
  });
}
export async function invoke(action: string, input: unknown) {
  if (!app) throw Error("插件未激活。");
  const r:any=await app.invoke(action,input);
  if((input as any)?.detail==="summary"&&r.status==="succeeded"&&r.data?.object){
    const {content,...object}=r.data.object;
    return {...r,data:{...r.data,object,content_read:{action:"export_project",arguments:{object_id:object.object_id,revision:object.revision,format:"json",max_bytes:8192}},content_omitted:true}};
  }
  return r;
}
