// Put your deployed backend URL here (no trailing slash). Leave as localhost while testing.
const API_BASE="http://localhost:5000";
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clamp=n=>Math.max(0,Math.min(100,Math.round(Number(n)||0)));
const DEMO=`# TaskTracker
A small CLI to track tasks.

import json, os
from datetime import datetime

DB = "tasks.json"

def load():
    if not os.path.exists(DB):
        return []
    with open(DB) as f:
        return json.load(f)

def save(tasks):
    with open(DB, "w") as f:
        json.dump(tasks, f, indent=2)

def add(title, due=None):
    tasks = load()
    tasks.append({"id": len(tasks) + 1, "title": title, "due": due,
                  "done": False, "created": datetime.now().isoformat()})
    save(tasks)

def complete(task_id):
    tasks = load()
    for t in tasks:
        if t["id"] == task_id:
            t["done"] = True
    save(tasks)

def overdue():
    now = datetime.now().isoformat()
    return [t for t in load() if t["due"] and t["due"] < now and not t["done"]]
`;
$("demo").onclick=()=>{$("code").value=DEMO;if(!$("name").value)$("name").value="Alex Chen"};
$("theme").onclick=()=>{const r=document.documentElement;r.dataset.theme=getComputedStyle(r).colorScheme==="dark"?"light":"dark"};

function status(t,err){const s=$("status");s.textContent=t;s.className=err?"err":""}

function drawLine(vals){
  const w=300,h=150,p=22,n=vals.length,pts=vals.map((v,i)=>[p+i*(w-2*p)/Math.max(1,n-1),h-p-(clamp(v)/100)*(h-2*p)]);
  const d=pts.map((q,i)=>(i?"L":"M")+q[0].toFixed(1)+" "+q[1].toFixed(1)).join(" ");
  let s='<line x1="22" y1="128" x2="278" y2="128" stroke="var(--line)"/>';
  s+='<path d="'+d+'" fill="none" stroke="var(--cyan)" stroke-width="2.5" stroke-linejoin="round"/>';
  pts.forEach((q,i)=>{s+='<circle cx="'+q[0]+'" cy="'+q[1]+'" r="3.5" fill="var(--violet)"/><text x="'+q[0]+'" y="146" text-anchor="middle">'+(i+1)+'</text>'});
  $("line").innerHTML=s;
}
function drawBars(items){
  const w=300,h=150,p=22,n=items.length,bw=(w-2*p)/n;
  let s='<line x1="22" y1="128" x2="278" y2="128" stroke="var(--line)"/>';
  items.forEach((it,i)=>{const v=clamp(it.value),bh=(v/100)*(h-2*p-8),x=p+i*bw+bw*.18;
    s+='<rect x="'+x+'" y="'+(128-bh)+'" width="'+bw*.64+'" height="'+bh+'" rx="4" fill="var(--violet)"/><text x="'+(x+bw*.32)+'" y="'+(124-bh)+'" text-anchor="middle">'+v+'</text><text x="'+(x+bw*.32)+'" y="143" text-anchor="middle">'+esc(String(it.label).slice(0,9))+'</text>'});
  $("bars").innerHTML=s;
}

function render(r,name){
  const score=clamp(r.score);
  $("who").textContent=(name?name+"’s":"Overall")+" developer score";
  $("score").textContent=score;
  $("arc").setAttribute("stroke-dasharray",score+" 100");
  $("summary").textContent=r.summary||"";
  $("stamp").textContent="✔ Verified by AI on "+new Date().toLocaleDateString();
  $("skills").innerHTML=(r.skills||[]).slice(0,6).map(s=>'<div class="skill"><div class="top"><span>'+esc(s.name)+'</span><span>'+clamp(s.score)+'%</span></div><div class="bar"><i style="width:'+clamp(s.score)+'%"></i></div><small>'+esc(s.evidence)+'</small></div>').join("");
  $("badges").innerHTML=(r.badges||[]).slice(0,4).map(b=>'<div class="badge"><b>'+esc(b.name)+'</b><small>'+esc(b.reason)+'</small></div>').join("")||'<div class="sub">No badges earned yet. See the skill evidence above for what to improve.</div>';
  drawLine((r.quality_by_section&&r.quality_by_section.length>1?r.quality_by_section:[score,score]).slice(0,8));
  drawBars((r.complexity&&r.complexity.length?r.complexity:[{label:"overall",value:50}]).slice(0,6));
  $("out").style.display="grid";
  $("out").scrollIntoView({behavior:"smooth",block:"start"});
}

$("gh").onclick=async()=>{
  const repo=$("repo").value.trim();if(!repo){status("Enter a GitHub repo link first.",true);return}
  status("Reading repository…");
  try{const r=await fetch(API_BASE+"/api/github?repo="+encodeURIComponent(repo)),d=await r.json();
    if(!r.ok)throw new Error(d.error);$("code").value=d.code;status("Loaded "+d.files.length+" files. Now click Verify.")}
  catch(e){status(e.message||"Could not read that repo.",true)}
};
$("run").onclick=async()=>{
  const code=$("code").value.trim(),name=$("name").value.trim();
  if(code.length<60){status("Paste code or load a repo first.",true);return}
  $("run").disabled=true;status("Verifying… reading your code");
  try{
    const r=await fetch(API_BASE+"/api/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,code})});
    const d=await r.json();if(!r.ok)throw new Error(d.error);
    render(d,name);status("");
  }catch(e){status(e.message||"Something went wrong. Try again.",true)}
  finally{$("run").disabled=false}
};
