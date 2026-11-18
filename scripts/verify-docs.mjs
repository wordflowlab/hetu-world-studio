import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
const files=['README.md','CAPABILITIES.md'];
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())await walk(f);else if(f.endsWith('.md'))files.push(f);}}
await walk('docs');await walk('skills');let count=0;
for(const file of files){const text=await readFile(file,'utf8');for(const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)){const target=match[1].split('#')[0];if(!target||/^[a-z]+:/i.test(target))continue;await stat(path.resolve(path.dirname(file),decodeURI(target)));count++;}}
console.log(JSON.stringify({documents:files.length,local_links:count}));
