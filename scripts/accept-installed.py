#!/usr/bin/env python3
"""在正式宿主安装上验收固定候选包或公开包；不编译或替换宿主。"""
from pathlib import Path
import hashlib,json,os,subprocess,struct,tarfile,sys
ROOT=Path.cwd();lock=json.loads((ROOT/'acceptance-lock.json').read_text())
EVIDENCE=Path(os.environ.get('HETU_ACCEPTANCE_DIRECTORY',str(ROOT/'output/installed-acceptance')));EVIDENCE.mkdir(parents=True,exist_ok=True)
DOWNLOADS=Path(os.environ.get('HETU_DOWNLOAD_DIRECTORY',str(ROOT/'output/official-downloads')));DOWNLOADS.mkdir(parents=True,exist_ok=True)
def run(args,**kw):return subprocess.check_output(args,text=True,stderr=subprocess.STDOUT,**kw).strip()
def sha(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def package_sha(p):
 d=hashlib.sha256()
 for f in sorted(p.rglob('*'),key=lambda f:f.relative_to(p).as_posix().encode()):
  assert not f.is_symlink(),'不接受符号链接'
  if f.is_file():
   name=f.relative_to(p).as_posix().encode();b=f.read_bytes();d.update(struct.pack('>IQ',len(name),len(b))+name+b)
 return d.hexdigest()
def unpack(archive,target,expected):
 target.mkdir(parents=True,exist_ok=True)
 assert not list(target.iterdir()),'固定包解压目录须为空'
 with tarfile.open(archive) as source:
  for m in source.getmembers():
   assert not m.issym() and not m.islnk()
   assert (target/m.name).resolve().is_relative_to(target)
  source.extractall(target,filter='data')
 assert package_sha(target)==expected
host=lock['host'];version=host['version'];archive=DOWNLOADS/f'Hetu-{version}-macos-arm64.zip';manifest_path=DOWNLOADS/'release-manifest.json'
if not archive.exists():run(['gh','release','download','v'+version,'--repo','limecloud/hetu','--pattern',archive.name,'--pattern','release-manifest.json','--dir',str(DOWNLOADS)])
assert sha(archive)==host['archive_sha256']
m=json.loads(manifest_path.read_text());assert m['git_sha']==host['git_sha'] and m['version']==version
assert m['notarization_status']=='Accepted' and m['signing']=='developer-id'
app=Path('/Applications/Hetu.app')
if os.environ.get('HETU_REUSE_APP')!='1':
 assert not app.exists(),'CI安装前不应存在未知应用；本机使用前须先独立核验并覆盖安装'
 run(['ditto','-x','-k',str(archive),str(DOWNLOADS/'expanded')]);run(['ditto',str(DOWNLOADS/'expanded/Hetu.app'),str(app)])
run(['codesign','--verify','--deep','--strict',str(app)])
identity=run(['codesign','--display','--verbose=4',str(app)]);assert 'TeamIdentifier='+m['team_id'] in identity
gate=run(['spctl','--assess','--type','execute','--verbose=2',str(app)])
staple=run(['xcrun','stapler','validate',str(app)]);bin_dir=app/'Contents/Resources/bin'
assert run([str(bin_dir/'hetu'),'--version'])=='hetu '+version
(EVIDENCE/'host.json').write_text(json.dumps({'version':version,'git_sha':host['git_sha'],'archive_sha256':host['archive_sha256'],'source_build':False,'signature_verified':True,'gatekeeper':gate,'staple':staple},ensure_ascii=False,indent=2)+'\n')
plugin=lock['plugin'];slug=plugin['slug'];name=f"org.wordflowlab.{slug}-{plugin['version']}.tgz"
if os.environ.get('HETU_PUBLISHED_BUNDLE')=='1':
 dest=DOWNLOADS/slug;dest.mkdir(exist_ok=True)
 run(['gh','release','download','v'+plugin['version'],'--repo','wordflowlab/hetu-'+slug,'--pattern',name,'--pattern','release-integrity.json','--dir',str(dest)])
 integrity=json.loads((dest/'release-integrity.json').read_text());assert integrity['package_sha256']==plugin['package_sha256']
 assert sha(dest/name)==integrity['archive_sha256'];package_archive=dest/name
else:package_archive=ROOT/'output'/name
fixed=EVIDENCE/'fixed-package';unpack(package_archive,fixed,plugin['package_sha256'])
env={**os.environ,'PATH':str(bin_dir)+os.pathsep+os.environ['PATH'],'HETU_PACKAGED_APP':str(app/'Contents/MacOS/Hetu'),'HETU_TEST_BIN':str(bin_dir),'HETU_TEST_PACKAGE':str(fixed),'HETU_SOURCE':os.environ.get('HETU_SOURCE',str(ROOT.parent/'host')),'HETU_RECEIPT_DIRECTORY':str(EVIDENCE),'HETU_TEST_HOST_COMMIT':host['git_sha']}
results=[]
for test in ['machine','ui']:
 command=([str(bin_dir/'node'),'node_modules/@playwright/test/cli.js','test'] if test=='ui' else [str(bin_dir/'node'),'--experimental-strip-types','--test','tests/machine.integration.ts'])
 with (EVIDENCE/(test+'.log')).open('w') as log:r=subprocess.run(command,cwd=ROOT,env=env,stdout=log,stderr=subprocess.STDOUT,timeout=1200)
 results.append({'test':test,'exit_code':r.returncode});(EVIDENCE/'results.json').write_text(json.dumps(results,indent=2)+'\n');print(slug,results[-1],flush=True);assert r.returncode==0,'保留失败，先回读原操作'
