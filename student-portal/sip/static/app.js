const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),2600)};
async function api(u,m='GET',b){const r=await fetch('/api/'+u,{method:m,headers:{'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined});
 const d=await r.json().catch(()=>({}));if(r.status==401&&u!='login'){showLogin();throw d}if(!r.ok){toast(d.error||'Something went wrong');throw d}return d}
const showLogin=()=>{$('#login').hidden=false;$('#app').hidden=true};
$('#lf').onsubmit=async e=>{e.preventDefault();try{await api('login','POST',Object.fromEntries(new FormData(e.target)));$('#login').hidden=true;$('#app').hidden=false;go('dash')}catch{}};
$('#out').onclick=async()=>{await api('logout','POST');showLogin()};
document.querySelectorAll('nav [data-v]').forEach(b=>b.onclick=()=>go(b.dataset.v));
document.addEventListener('pointermove',e=>{const c=e.target.closest?.('.glass');if(!c)return;const r=c.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
 c.style.setProperty('--mx',x*100+'%');c.style.setProperty('--my',y*100+'%');if(c.classList.contains('tilt')){c.style.setProperty('--ry',(x-.5)*10+'deg');c.style.setProperty('--rx',(.5-y)*10+'deg')}});
document.addEventListener('pointerout',e=>{const c=e.target.closest?.('.tilt');if(c){c.style.setProperty('--rx','0deg');c.style.setProperty('--ry','0deg')}});

function modal(title,fields,vals,save){const f=$('#mf');f.innerHTML=`<h2 style="margin:0">${title}</h2>`+fields.map(x=>`<label>${x.l}${x.o?`<select name="${x.k}">${x.o.map(o=>`<option value="${o[0]}">${esc(o[1])}</option>`).join('')}</select>`:`<input name="${x.k}" type="${x.t||'text'}" ${x.r?'required':''} ${x.step?'step="any"':''}>`}</label>`).join('')+
 `<div class="row"><button class="btn">Save</button><button type="button" class="btn g" id="cx">Cancel</button></div>`;
 fields.forEach(x=>{if(vals&&vals[x.k]!=null)f.elements[x.k].value=vals[x.k]});$('#modal').hidden=false;f.elements[0].focus();
 $('#cx').onclick=()=>$('#modal').hidden=true;f.onsubmit=async e=>{e.preventDefault();try{await save(Object.fromEntries(new FormData(f)));$('#modal').hidden=true}catch{}}}

const V={
async dash(m){const s=await api('stats');m.innerHTML=`<h1>Dashboard</h1><div class="stats">${[['Students',s.students],['Present today',s.present_today],['Attendance rate',s.attendance_rate==null?'–':s.attendance_rate+'%'],['Average grade',s.avg_grade==null?'–':s.avg_grade+'%']].map(x=>`<div class="glass tilt stat"><b>${x[1]}</b><span>${x[0]}</span></div>`).join('')}</div>
 <div class="glass pane"><h2 style="margin-top:0">Top performers</h2>${s.top.length?s.top.map(t=>`<div class="row sp" style="margin:12px 0"><span>${esc(t.name)}</span><div class="row"><div class="bar"><i style="width:${t.pct}%"></i></div><b>${t.pct}%</b></div></div>`).join(''):'<p class="empty">Add grades to see rankings.</p>'}</div>`},
async students(m){const F=[{k:'roll_no',l:'Roll number',r:1},{k:'name',l:'Full name',r:1},{k:'email',l:'Email',t:'email'},{k:'phone',l:'Phone'},{k:'class_name',l:'Class'},{k:'dob',l:'Date of birth',t:'date'}];
 let all=await api('students');const draw=()=>{const k=$('#sq').value.toLowerCase(),rows=all.filter(s=>(s.name+s.roll_no+(s.class_name||'')).toLowerCase().includes(k));
  $('#st').innerHTML=rows.length?`<table><tr><th>Roll</th><th>Name</th><th>Class</th><th>Email</th><th>Phone</th><th></th></tr>${rows.map(s=>`<tr><td>${esc(s.roll_no)}</td><td>${esc(s.name)}</td><td>${esc(s.class_name)}</td><td>${esc(s.email)}</td><td>${esc(s.phone)}</td><td><button class="btn g s" data-e="${s.id}">Edit</button> <button class="btn d s" data-d="${s.id}">Delete</button></td></tr>`).join('')}</table>`:'<p class="empty">No students found. Add your first student.</p>'};
 m.innerHTML=`<div class="row sp"><h1>Students</h1><div class="row"><input id="sq" placeholder="Search name, roll, class" aria-label="Search students"><button class="btn" id="add">Add student</button></div></div><div class="glass pane tw" id="st"></div>`;draw();
 const re=async()=>{all=await api('students');draw()};$('#sq').oninput=draw;
 $('#add').onclick=()=>modal('Add student',F,null,async d=>{await api('students','POST',d);toast('Student added');re()});
 $('#st').onclick=async e=>{const b=e.target;if(b.dataset.e){const s=all.find(x=>x.id==b.dataset.e);modal('Edit student',F,s,async d=>{await api('students/'+s.id,'PUT',d);toast('Student updated');re()})}
  if(b.dataset.d&&confirm('Delete this student and all their records?')){await api('students/'+b.dataset.d,'DELETE');toast('Student deleted');re()}}},
async attendance(m){m.innerHTML=`<div class="row sp"><h1>Attendance</h1><div class="row"><input type="date" id="ad" aria-label="Date" value="${new Date().toISOString().slice(0,10)}"><button class="btn" id="sa">Save attendance</button></div></div><div class="glass pane tw" id="at"></div>`;
 let rows=[];const load=async()=>{rows=await api('attendance?date='+$('#ad').value);draw()};
 const draw=()=>$('#at').innerHTML=rows.length?`<table><tr><th>Roll</th><th>Name</th><th>Status</th></tr>${rows.map((r,i)=>`<tr><td>${esc(r.roll_no)}</td><td>${esc(r.name)}</td><td><div class="seg" data-i="${i}">${['Present','Late','Absent'].map(s=>`<button type="button" data-s="${s}" class="${r.status==s?'on':''}">${s}</button>`).join('')}</div></td></tr>`).join('')}</table>`:'<p class="empty">No students yet. Add students first.</p>';
 $('#at').onclick=e=>{const s=e.target.dataset.s;if(s){rows[e.target.parentNode.dataset.i].status=s;draw()}};$('#ad').onchange=load;
 $('#sa').onclick=async()=>{await api('attendance','POST',{date:$('#ad').value,records:rows.map(r=>({student_id:r.id,status:r.status}))});toast('Attendance saved')};load()},
async grades(m){const[st,su]=await Promise.all([api('students'),api('subjects')]);
 m.innerHTML=`<div class="row sp"><h1>Grades</h1><div class="row"><select id="gf" aria-label="Filter by student"><option value="">All students</option>${st.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select><button class="btn" id="ag">Add grade</button></div></div><div class="glass pane tw" id="gt"></div>`;
 const load=async()=>{const g=await api('grades'+($('#gf').value?'?student_id='+$('#gf').value:''));
  $('#gt').innerHTML=g.length?`<table><tr><th>Student</th><th>Subject</th><th>Exam</th><th>Marks</th><th>Score</th><th></th></tr>${g.map(x=>`<tr><td>${esc(x.student)}</td><td>${esc(x.subject)}</td><td>${esc(x.exam)}</td><td>${x.marks}/${x.max_marks}</td><td><div class="row"><div class="bar"><i style="width:${Math.min(x.pct,100)}%"></i></div>${x.pct}%</div></td><td><button class="btn d s" data-d="${x.id}">Delete</button></td></tr>`).join('')}</table>`:'<p class="empty">No grades recorded yet.</p>'};
 $('#gf').onchange=load;$('#gt').onclick=async e=>{if(e.target.dataset.d&&confirm('Delete this grade?')){await api('grades/'+e.target.dataset.d,'DELETE');toast('Grade deleted');load()}};
 $('#ag').onclick=()=>modal('Add grade',[{k:'student_id',l:'Student',o:st.map(s=>[s.id,s.name+' ('+s.roll_no+')'])},{k:'subject_id',l:'Subject',o:su.map(s=>[s.id,s.name])},{k:'exam',l:'Exam',r:1},{k:'marks',l:'Marks',t:'number',r:1,step:1},{k:'max_marks',l:'Out of',t:'number',step:1}],{max_marks:100},async d=>{await api('grades','POST',d);toast('Grade added');load()});load()}};
async function go(v){document.querySelectorAll('nav [data-v]').forEach(b=>b.classList.toggle('on',b.dataset.v==v));const m=$('#main');try{await V[v](m);m.focus()}catch{}}
api('me').then(()=>{$('#login').hidden=true;$('#app').hidden=false;go('dash')}).catch(showLogin);
