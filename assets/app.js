(function(){
'use strict';
var DATA=[],BY={},CONT={continent:1,region:1,ville:1,pj:1,faction:0};
var $app=document.getElementById('app'),$q=document.getElementById('q');
var profil='groupe';
try{profil=localStorage.getItem('codex.profil')||'groupe'}catch(e){}
var TYPES={continent:'Continent',region:'Région',ville:'Ville',pnj:'PNJ',clan:'Clan',faction:'Faction',sujet:'Sujet',organisation:'Organisation',pj:'Joueur',lieu:'Lieu',evenement:'Événement'};
var ONGLETS={pnj:'PNJ',clans:'Clans',gouvernement:'Gouvernement',lieux:'Lieux',factions:'Factions',monde:'Monde',groupe:'Le groupe',evenements:'Événements'};
var SIL='<svg viewBox="0 0 120 150" aria-hidden="true"><circle cx="60" cy="48" r="26" fill="#3a4a54"/><path d="M8 150C8 100 34 82 60 82C86 82 112 100 112 150Z" fill="#3a4a54"/></svg>';

function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function norm(s){return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()}
function porteeOk(b){return b.portee==='groupe'||profil==='harfang'}
function blocs(e){return (e.blocs||[]).filter(porteeOk)}
function visible(e){return CONT[e.type]===1||blocs(e).length>0}
function imgPath(e){
  if(e.img)return e.img;
  if(e.type==='pnj'||e.type==='clan'){
    var v=BY[e.parent];var r=v&&BY[v.parent];
    if(v&&r)return 'img/'+r.id+'/'+v.id+'/pnj/'+e.id+'.webp';
  }
  return null;
}
function thumb(e,cls){
  var p=imgPath(e);
  return '<div class="'+(cls||'thumb')+'">'+(p?'<img src="'+esc(p)+'" alt="" loading="lazy" onerror="this.parentNode.innerHTML=window.__SIL">':SIL)+'</div>';
}
window.__SIL=SIL;
function link(e,t){return '<a href="#/e/'+esc(e.id)+'">'+esc(t||e.nom)+'</a>'}
function card(e){
  return '<a class="card" href="#/e/'+esc(e.id)+'">'+thumb(e)+'<div><b>'+esc(e.nom)+'</b><small>'+esc(e.titre||TYPES[e.type]||'')+'</small></div></a>';
}
function crumbs(e){
  var c=[],p=BY[e.parent];while(p){c.unshift(p);p=BY[p.parent]}
  var h='<div class="crumbs"><a href="#/">Monde</a>';
  c.forEach(function(x){h+='<span>/</span>'+link(x)});
  return h+'<span>/</span>'+esc(e.nom)+'</div>';
}
function children(id){return DATA.filter(function(e){return e.parent===id&&visible(e)})}

function pips(n){var h='<span class="pips">';for(var i=1;i<=5;i++)h+='<i'+(i<=n?' class="on"':'')+'></i>';return h+'</span>'}

function renderBlocs(e){
  var h='';
  blocs(e).forEach(function(b){
    h+='<section class="bloc"><h2>'+esc(b.titre)+'<small>'+(b.portee==='groupe'?'vous':'tu')+'</small></h2><ul>'+
      b.points.map(function(p){return '<li>'+esc(p)+'</li>'}).join('')+'</ul></section>';
  });
  return h;
}
function renderCartes(e){
  if(!e.cartes||!e.cartes.length)return '';
  return '<section class="bloc"><h2>Carte'+(e.cartes.length>1?'s':'')+'</h2>'+e.cartes.map(function(c){
    return '<figure class="carte"><a href="'+esc(c.img)+'" target="_blank" rel="noopener"><img src="'+esc(c.img)+'" alt="'+esc(c.legende||'')+'" loading="lazy"></a><figcaption>'+esc(c.legende||'')+'</figcaption></figure>';
  }).join('')+'</section>';
}
function renderRelations(e){
  var rs=(e.relations||[]).filter(function(r){var t=BY[r.cible];return t&&visible(t)});
  if(!rs.length)return '';
  var h='<section class="bloc"><h2>Relations</h2><div class="grid">';
  rs.forEach(function(r){
    var t=BY[r.cible];
    h+='<a class="card" href="#/e/'+esc(t.id)+'">'+thumb(t)+'<div><b>'+esc(t.nom)+'</b><small class="rel"><span class="t">'+esc(r.type)+'</span></small>'+
      '<small>'+pips(r.lien)+esc(r.note||'')+'</small></div></a>';
  });
  return h+'</div></section>';
}
function statutPill(e){return e.statut?'<span class="pill '+esc(e.statut)+'">'+esc(e.statut)+'</span>':''}

function viewFiche(id,tab){
  var e=BY[id];
  if(!e||!visible(e))return notFound();
  var h=crumbs(e);
  var kids=children(e.id);
  var isCont=CONT[e.type]===1&&e.type!=='pj';
  h+='<div class="hero">'+((e.type==='pnj'||e.type==='pj'||e.type==='clan')?thumb(e,'portrait'):'')+'<div class="info"><h1>'+esc(e.nom)+'</h1>'+
    '<div class="sub">'+esc(e.titre||'')+'</div><div class="meta"><span class="pill">'+esc(TYPES[e.type]||e.type)+'</span>'+statutPill(e);
  if(e.clan&&BY[e.clan])h+='<span class="pill">'+link(BY[e.clan])+'</span>';
  h+='</div>';
  if(e.resume)h+='<p>'+esc(e.resume)+'</p>';
  if(e.question&&visible(e))h+='<p class="q">'+esc(e.question)+'</p>';
  h+='</div></div>';
  h+=renderBlocs(e);
  h+=renderCartes(e);
  if(kids.length){
    var tabs={},order=[];
    kids.forEach(function(k){var o=k.onglet||'autres';if(!tabs[o]){tabs[o]=[];order.push(o)}tabs[o].push(k)});
    var pref=['evenements','pnj','clans','gouvernement','lieux','factions','monde','autres'];
    order.sort(function(a,b){return pref.indexOf(a)-pref.indexOf(b)});
    if(!tab||!tabs[tab])tab=order[0];
    if(order.length>1){
      h+='<div class="tabs">'+order.map(function(o){return '<button data-tab="'+esc(o)+'" class="'+(o===tab?'on':'')+'">'+esc(ONGLETS[o]||o)+' ('+tabs[o].length+')</button>'}).join('')+'</div>';
    }else h+='<h2 style="font-size:14px;letter-spacing:.14em;color:var(--gold);margin:10px 0">'+esc((ONGLETS[tab]||tab).toUpperCase())+'</h2>';
    h+='<div class="grid">'+tabs[tab].map(card).join('')+'</div>';
    $app.innerHTML=h;
    var bs=$app.querySelectorAll('.tabs button');
    for(var i=0;i<bs.length;i++)bs[i].onclick=(function(b){return function(){viewFiche(id,b.getAttribute('data-tab'))}})(bs[i]);
    return;
  }
  h+=renderRelations(e);
  $app.innerHTML=h;
}
function viewHome(){
  var h='<div class="tree"><h1>Le monde connu</h1><p class="sub">Ce que vous savez à ce jour de Thalderra.</p>';
  DATA.filter(function(e){return e.type==='continent'}).forEach(function(c){
    h+='<h2>'+link(c)+'</h2>';
    var regs=children(c.id);
    var plain=regs.filter(function(r){return r.type!=='ville'&&r.type!=='faction'});
    plain.forEach(function(r){
      h+='<h3>'+link(r)+'</h3><div class="grid">';
      h+=children(r.id).map(card).join('')||'<span class="muted">Rien de visité</span>';
      h+='</div>';
    });
    var other=regs.filter(function(r){return r.type==='ville'||r.type==='faction'});
    if(other.length)h+='<h3>Lieux et factions</h3><div class="grid">'+other.map(card).join('')+'</div>';
  });
  var top=DATA.filter(function(e){return !e.parent&&e.type!=='continent'&&visible(e)});
  var groups={};top.forEach(function(e){var o=e.onglet||'autres';(groups[o]=groups[o]||[]).push(e)});
  Object.keys(groups).forEach(function(o){h+='<h2>'+esc(ONGLETS[o]||o)+'</h2><div class="grid">'+groups[o].map(card).join('')+'</div>'});
  $app.innerHTML=h+'</div>';
}
function viewStatut(){
  var h='<h1>Statut</h1><p class="sub">Qui est mort, qui est porté disparu, ce qui reste en suspens.</p>';
  var all=DATA.filter(function(e){return e.statut&&visible(e)&&e.type!=='pj'});
  [['mort','Morts'],['inconnu','Sort inconnu']].forEach(function(s){
    var l=all.filter(function(e){return e.statut===s[0]});
    if(!l.length)return;
    h+='<section class="bloc"><h2>'+s[1]+' ('+l.length+')</h2><table class="st">'+l.map(function(e){
      return '<tr><td>'+link(e)+'<br><span class="muted">'+esc(e.titre||'')+'</span></td><td>'+esc(e.question||e.resume||'')+'</td></tr>';
    }).join('')+'</table></section>';
  });
  var vivants=all.filter(function(e){return e.statut==='vivant'}).length;
  h+='<p class="muted">'+vivants+' personnages connus en vie.</p>';
  $app.innerHTML=h;
}
function notFound(){$app.innerHTML='<h1>Introuvable</h1><p class="muted">Cette fiche n\'existe pas, ou vous ne la connaissez pas encore. <a href="#/">Retour au monde</a></p>'}

function search(raw){
  var toks=norm(raw).split(/\s+/).filter(Boolean);
  if(!toks.length)return route();
  var res=[];
  DATA.forEach(function(e){
    if(!visible(e))return;
    var bt=blocs(e).map(function(b){return b.titre+' '+b.points.join(' ')}).join(' ');
    var fn=norm(e.nom+' '+(e.titre||'')),ft=norm((e.tags||[]).join(' ')),fr=norm(e.resume||''),fb=norm(bt);
    var score=0,ok=toks.every(function(t){
      var s=0;if(fn.indexOf(t)>=0)s=10;else if(ft.indexOf(t)>=0)s=6;else if(fr.indexOf(t)>=0)s=3;else if(fb.indexOf(t)>=0)s=1;
      score+=s;return s>0});
    if(ok)res.push({e:e,s:score,bt:bt});
  });
  res.sort(function(a,b){return b.s-a.s});
  var h='<h1>Recherche</h1><p class="sub">'+res.length+' résultat'+(res.length>1?'s':'')+' pour « '+esc(raw)+' »</p>';
  res.slice(0,40).forEach(function(r){
    var pts=[];blocs(r.e).forEach(function(b){b.points.forEach(function(p){pts.push(p)})});
    var sn=pts.filter(function(p){return toks.every(function(t){return norm(p).indexOf(t)>=0})})[0]||pts.filter(function(p){return toks.some(function(t){return norm(p).indexOf(t)>=0})})[0]||r.e.resume||'';
    h+='<div class="hit"><b>'+link(r.e)+'</b> <span class="pill">'+esc(TYPES[r.e.type]||'')+'</span><div class="sn">'+esc(sn)+'</div></div>';
  });
  $app.innerHTML=h;
}

function route(){
  var h=location.hash.replace(/^#\/?/,'');
  var parts=h.split('/');
  if(!h||h==='')return viewHome();
  if(parts[0]==='e')return viewFiche(decodeURIComponent(parts[1]||''));
  if(parts[0]==='statut')return viewStatut();
  viewHome();
}
function setProfil(p){
  profil=p;try{localStorage.setItem('codex.profil',p)}catch(e){}
  var bs=document.querySelectorAll('.profil button');
  for(var i=0;i<bs.length;i++)bs[i].classList.toggle('on',bs[i].getAttribute('data-p')===p);
  if($q.value.trim())search($q.value);else route();
}
function init(files){
  Promise.all(files.map(function(f){return fetch('data/'+f).then(function(r){return r.json()})})).then(function(parts){
    parts.forEach(function(p){p.forEach(function(e){DATA.push(e);BY[e.id]=e})});
    var bs=document.querySelectorAll('.profil button');
    for(var i=0;i<bs.length;i++)bs[i].onclick=(function(b){return function(){setProfil(b.getAttribute('data-p'))}})(bs[i]);
    $q.addEventListener('input',function(){if($q.value.trim())search($q.value);else route()});
    window.addEventListener('hashchange',function(){$q.value='';route();window.scrollTo(0,0)});
    setProfil(profil);
  }).catch(function(err){$app.innerHTML='<p class="muted">Impossible de charger les données ('+esc(err.message)+'). Ouvrez le site via son adresse web.</p>'});
}
fetch('data/index.json').then(function(r){return r.json()}).then(function(i){init(i.fichiers)});
})();
