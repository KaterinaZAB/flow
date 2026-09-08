import fs from 'node:fs';import path from 'node:path';import ts from 'typescript';
const roots=['app','components','hooks','lib','scripts','tests','db'];
function walk(p){return fs.existsSync(p)?fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):[path.join(p,e.name).replaceAll('\\','/')]):[];}
const files=roots.flatMap(walk).filter(p=>/\.[cm]?[jt]sx?$/.test(p));const external=new Map(),edges=new Map();
for(const file of files){const text=fs.readFileSync(file,'utf8'),imports=[...ts.preProcessFile(text,true,true).importedFiles.map(i=>i.fileName),...Array.from(text.matchAll(/(?:import\(|require\()\s*['"]([^'"]+)/g),m=>m[1])];const deps=[];for(const imp of imports){if(imp.startsWith('.')||imp.startsWith('@/')){const target=imp.startsWith('@/')?imp.slice(2):path.join(path.dirname(file),imp).replaceAll('\\','/');const resolved=[target,...['.ts','.tsx','.js','.mjs','/index.ts','/index.tsx'].map(e=>target+e)].find(p=>files.includes(p));if(resolved)deps.push(resolved);}else{const pkg=imp.startsWith('@')?imp.split('/').slice(0,2).join('/'):imp.split('/')[0];external.set(pkg,[...(external.get(pkg)??[]),file]);}}edges.set(file,deps);}
const reachable=new Set();function visit(file){if(reachable.has(file))return;reachable.add(file);for(const dep of edges.get(file)??[])visit(dep);}
files.filter(p=>p.startsWith('app/')||p.startsWith('scripts/')||p.startsWith('tests/')||p.startsWith('db/')).forEach(visit);
const result={external:Object.fromEntries(external),unreachable:files.filter(p=>!reachable.has(p))};
fs.mkdirSync('.local',{recursive:true});fs.writeFileSync('.local/dependency-audit.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
