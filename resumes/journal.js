'use strict';
const $=id=>document.getElementById(id);
function safe(s){return String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
async function init(){
 const list=$('sessions'),reader=$('reader'),counter=$('count');
 try{
  const response=await fetch('../data/parties.json?v=63');
  if(!response.ok)throw new Error('HTTP '+response.status);
  const data=await response.json(),parties=Array.isArray(data.parties)?data.parties:[];
  counter.textContent=String(parties.length);
  if(!parties.length){list.innerHTML='<div class="journal-empty">Les comptes rendus des séances seront publiés ici.</div>';return;}
  const show=i=>{
   const p=parties[i];
   list.querySelectorAll('button').forEach((b,j)=>b.setAttribute('aria-expanded',String(i===j)));
   reader.innerHTML='<div class="metadata">'+safe(p.date||'Séance '+(i+1))+'</div><h2>'+safe(p.titre||'Partie '+(i+1))+'</h2>'+
    (p.resume?'<p>'+safe(p.resume)+'</p>':'<p>Résumé en cours de rédaction.</p>')+
    (Array.isArray(p.liens)&&p.liens.length?'<div class="metadata">Lieux et personnages liés</div>'+p.liens.filter(x=>typeof x.id==='string'&&/^[a-z0-9-]+$/.test(x.id)).map(x=>'<p><a href="../#/'+safe(x.id)+'">'+safe(x.label||x.id)+'</a></p>').join(''):'');
  };
  list.innerHTML=parties.map((p,i)=>'<button type="button" class="session-link" aria-expanded="false" data-i="'+i+'"><span class="session-star" aria-hidden="true">✦</span><span><strong>'+safe(p.titre||'Partie '+(i+1))+'</strong><small>'+safe(p.date||'Séance '+(i+1))+'</small></span><span class="session-chevron" aria-hidden="true">›</span></button>').join('');
  list.addEventListener('click',event=>{const b=event.target.closest('button[data-i]');if(b)show(Number(b.dataset.i));});
  show(0);
 }catch(err){list.innerHTML='<div class="journal-empty">Le journal des séances est momentanément indisponible.</div>';console.error(err);}
}
init();