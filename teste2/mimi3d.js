// ═══════════════════════════════════════════════════════════════
//  MIMI 3D — a lagarta desenhada e animada só com código (Three.js)
//  Um único "motor" WebGL desenha cada Mimi da tela e copia a imagem
//  para o <canvas> de cada lugar (início, mapa, jogo, parabéns).
//  Se o navegador não tiver WebGL, Mimi3D.ok fica false e o jogo
//  continua usando a Mimi desenhada em SVG.
// ═══════════════════════════════════════════════════════════════
(function(){
const M3={ok:false,calm:false};   // calm = sem animações paradas "de enfeite" (botão parar animações)
window.Mimi3D=M3;
if(!window.THREE)return;

let renderer;
const BUF=512;
try{
  const test=document.createElement('canvas');
  if(!(test.getContext('webgl2')||test.getContext('webgl')))return;
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
}catch(e){return;}
if(THREE.ColorManagement){
  if('enabled' in THREE.ColorManagement)THREE.ColorManagement.enabled=true;
  else THREE.ColorManagement.legacyMode=false;
}
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.setPixelRatio(1);
renderer.setSize(BUF,BUF,false);
renderer.setClearColor(0x000000,0);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
M3.ok=true;

// ── MATERIAIS (compartilhados por todas as Mimis) ──
const phys=(o)=>new THREE.MeshPhysicalMaterial(o);
const MAT={
  body:  phys({color:'#ee5fae',roughness:.55,sheen:.45,sheenColor:new THREE.Color('#fff0f8'),sheenRoughness:.45,clearcoat:.12,clearcoatRoughness:.6}),
  head:  phys({color:'#f477bd',roughness:.5,sheen:.45,sheenColor:new THREE.Color('#fff4fa'),sheenRoughness:.4,clearcoat:.18,clearcoatRoughness:.5}),
  belly: phys({color:'#ffb3d9',roughness:.7,sheen:.6,sheenColor:new THREE.Color('#ffffff')}),
  eye:   phys({color:'#3b3058',roughness:.12,clearcoat:1,clearcoatRoughness:.05}),
  white: new THREE.MeshBasicMaterial({color:'#ffffff'}),
  cheek: new THREE.MeshStandardMaterial({color:'#ff4f9a',roughness:.9,transparent:true,opacity:.55}),
  mouth: new THREE.MeshStandardMaterial({color:'#b84e86',roughness:.6}),
  stalk: phys({color:'#c94f97',roughness:.5}),
  tip:   phys({color:'#ffd166',roughness:.25,clearcoat:.8,emissive:new THREE.Color('#5a3a00'),emissiveIntensity:.25}),
  leg:   phys({color:'#d9579f',roughness:.6,sheen:.6,sheenColor:new THREE.Color('#ffffff')}),
  sweat: phys({color:'#bfe3ff',roughness:.05,transmission:.4,transparent:true,opacity:.85,clearcoat:1}),
  gold:  new THREE.MeshStandardMaterial({color:'#ffd166',metalness:.75,roughness:.28}),
};
// cores que a criança ganha jogando (cada fase vencida libera uma). Sem compras e sem sorteio.
const COLORS={
  rosa:   {body:'#ee5fae',head:'#f477bd',belly:'#ffb3d9',leg:'#d9579f',stalk:'#c94f97',tip:'#ffd166'},
  azul:   {body:'#3d9ff0',head:'#5ab3f6',belly:'#c4e4ff',leg:'#2f88d8',stalk:'#2a76c0',tip:'#ffd166'},
  verde:  {body:'#43bf63',head:'#5fd07e',belly:'#ccf3d6',leg:'#35a553',stalk:'#2c8f47',tip:'#ffd166'},
  roxa:   {body:'#9a68f0',head:'#ac82f6',belly:'#e0d3ff',leg:'#8553de',stalk:'#7144c8',tip:'#ffd166'},
  laranja:{body:'#ff9638',head:'#ffaa58',belly:'#ffe2c2',leg:'#e97f26',stalk:'#d26f1c',tip:'#fff07a'},
  dourada:{body:'#f0b429',head:'#f7c64a',belly:'#fff0bf',leg:'#d99c1c',stalk:'#c58a12',tip:'#ff6fb5'},
};
M3.COLORS=COLORS;
function setColor(rig,id){
  const c=COLORS[id]||COLORS.rosa;if(rig.color===id)return;rig.color=id;
  Object.keys(rig.mats).forEach(k=>rig.mats[k].color.set(c[k]));
  if(rig.fly){const u=rig.fly.userData.mats;u.wingMat.color.set(c.body);u.dotMat.color.set(c.tip);u.dotMat.emissive.set(c.tip);u.bellyMat.color.set(c.belly);}
}
const std=(c,o={})=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.5},o));

const G={
  sph:new THREE.SphereGeometry(1,40,28),
  sphLo:new THREE.SphereGeometry(1,20,14),
  leg:new THREE.CapsuleGeometry(.055,.14,6,12),
  arc:new THREE.TorusGeometry(.085,.024,10,24,Math.PI),
  smile:new THREE.TorusGeometry(.11,.026,10,24,Math.PI),
};
function mesh(geo,mat,shadow=true){const m=new THREE.Mesh(geo,mat);m.castShadow=shadow;return m;}
function ball(r,mat,x=0,y=0,z=0,sx=1,sy=1,sz=1){const m=mesh(G.sph,mat);m.position.set(x,y,z);m.scale.set(r*sx,r*sy,r*sz);return m;}

function starShape(R=1,r=.45){
  const s=new THREE.Shape();
  for(let i=0;i<10;i++){const a=Math.PI/5*i+Math.PI/2,rr=i%2?r:R;const x=Math.cos(a)*rr,y=Math.sin(a)*rr;i?s.lineTo(x,y):s.moveTo(x,y);}
  s.closePath();return s;
}
function heartShape(){
  const s=new THREE.Shape();
  s.moveTo(0,-.9);
  s.bezierCurveTo(-.2,-.7,-1,-.25,-1,.25);
  s.bezierCurveTo(-1,.75,-.45,1,0,.55);
  s.bezierCurveTo(.45,1,1,.75,1,.25);
  s.bezierCurveTo(1,-.25,.2,-.7,0,-.9);
  return s;
}
const EXT={depth:.25,bevelEnabled:true,bevelThickness:.12,bevelSize:.1,bevelSegments:3};
const GSTAR=new THREE.ExtrudeGeometry(starShape(),EXT);GSTAR.center();
const GHEART=new THREE.ExtrudeGeometry(heartShape(),EXT);GHEART.center();

// ── O CORPO DA MIMI ──
// A cabeça olha para +x. Segmentos do corpo vão para trás (−x).
const SEGS=[{r:.52,x:.42},{r:.5,x:-.13},{r:.46,x:-.66},{r:.41,x:-1.13}];   // 4 gomos do corpo, do pescoço até o rabinho
const LEG_H=.11;

function buildMimi(){
  const root=new THREE.Group();          // posição/pulo
  const yawG=new THREE.Group();          // para onde ela olha
  root.add(yawG);
  const body=new THREE.Group();yawG.add(body);
  const mats={};['body','head','belly','leg','stalk','tip'].forEach(k=>mats[k]=MAT[k].clone());   // cada Mimi tem as suas cores
  const segs=[];
  SEGS.forEach((s,i)=>{
    const g=new THREE.Group();g.position.set(s.x,s.r+LEG_H,0);
    const b=ball(s.r,mats.body);g.add(b);
    const belly=ball(s.r*.82,mats.belly,0,-s.r*.32,0,1,.55,1.02);belly.castShadow=false;g.add(belly);
    const legs=[];
    [-1,1].forEach(side=>{
      const l=mesh(G.leg,mats.leg);
      l.position.set(0,-s.r-.02,side*s.r*.45);
      g.add(l);legs.push(l);
    });
    body.add(g);segs.push({g,ball:b,legs,r:s.r,baseY:s.r+LEG_H,x:s.x,i});
  });

  // cabeça
  const headPivot=new THREE.Group();headPivot.position.set(1.05,.84,0);yawG.add(headPivot);
  const head=new THREE.Group();headPivot.add(head);
  const skull=ball(.6,mats.head);head.add(skull);
  // rostinho (na frente, +x)
  const face=new THREE.Group();head.add(face);
  const eyes=[],happyEyes=[],eyeHi=[];
  [-1,1].forEach(side=>{
    const e=new THREE.Group();
    const dir=new THREE.Vector3(.8,.12,side*.46).normalize().multiplyScalar(.56);
    e.position.copy(dir);
    e.lookAt(dir.clone().multiplyScalar(2));
    const pupil=ball(.135,MAT.eye,0,0,0,1,1.25,.55);pupil.castShadow=false;e.add(pupil);
    const hi=ball(.05,MAT.white,.04,.065,.06);hi.castShadow=false;e.add(hi);
    const hi2=ball(.02,MAT.white,-.03,-.05,.055);hi2.castShadow=false;e.add(hi2);
    face.add(e);eyes.push(e);eyeHi.push(hi);
    const he=mesh(G.arc,MAT.eye,false);       // olhinho fechado de alegria  ^ ^
    he.position.copy(dir).multiplyScalar(1.02);he.lookAt(dir.clone().multiplyScalar(3));
    he.visible=false;face.add(he);happyEyes.push(he);
  });
  const smile=mesh(G.smile,MAT.mouth,false);
  {const p=new THREE.Vector3(.9,-.2,0).normalize().multiplyScalar(.6);smile.position.copy(p);smile.lookAt(p.clone().multiplyScalar(3));smile.rotateZ(Math.PI);}
  face.add(smile);
  const oMouth=ball(.06,MAT.mouth,0,0,0,1,.85,.5);oMouth.castShadow=false;
  {const p=new THREE.Vector3(.9,-.24,0).normalize().multiplyScalar(.6);oMouth.position.copy(p);oMouth.lookAt(p.clone().multiplyScalar(3));}
  oMouth.visible=false;face.add(oMouth);
  [-1,1].forEach(side=>{
    const p=new THREE.Vector3(.62,-.2,side*.62).normalize().multiplyScalar(.57);
    const c=ball(.11,MAT.cheek,p.x,p.y,p.z,1,.7,1);c.castShadow=false;c.lookAt(p.clone().multiplyScalar(3));
    face.add(c);
  });
  const sweat=ball(.07,MAT.sweat,.25,.42,.45,1,1.4,1);sweat.visible=false;head.add(sweat);

  // antenas (cada uma num pivô, para balançar como mola)
  const ants=[];
  [-1,1].forEach(side=>{
    const piv=new THREE.Group();piv.position.set(.05,.5,side*.2);head.add(piv);
    const curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(0,0,0),new THREE.Vector3(-.05,.32,side*.05),new THREE.Vector3(-.2,.55,side*.2));
    const st=mesh(new THREE.TubeGeometry(curve,16,.032,8,false),mats.stalk);piv.add(st);
    const tip=ball(.11,mats.tip,-.2,.57,side*.2);piv.add(tip);
    ants.push({piv,side,ang:0,vel:0,ang2:0,vel2:0});
  });

  const hatSlot=new THREE.Group();hatSlot.position.set(-.05,.5,0);head.add(hatSlot);
  const outfitSlot=new THREE.Group();yawG.add(outfitSlot);

  // pedacinho da fruta que ela morde quando chega na estrela
  const bitePiece=ball(.36,new THREE.MeshPhysicalMaterial({color:'#ffd166',roughness:.45,clearcoat:.4}),1.6,.32,0);
  bitePiece.visible=false;yawG.add(bitePiece);
  // coraçãozinho do carinho quando ela erra
  const heart=mesh(GHEART,new THREE.MeshStandardMaterial({color:'#ff4f9a',roughness:.35,emissive:new THREE.Color('#ff4f9a'),emissiveIntensity:.25,transparent:true}),false);
  heart.visible=false;

  return {root,yawG,body,segs,headPivot,head,eyes,eyeHi,happyEyes,smile,oMouth,sweat,ants,hatSlot,outfitSlot,
    bitePiece,heart,mats,color:'rosa',look:'',outfitAnim:null};
}

// ── ACESSÓRIOS EM 3D ──
function buildHat(id){
  const g=new THREE.Group();
  if(id==='hat_coroa'){
    const band=mesh(new THREE.CylinderGeometry(.3,.28,.17,32,1,true),MAT.gold);band.material=MAT.gold.clone();band.material.side=THREE.DoubleSide;
    band.position.y=.12;g.add(band);
    for(let i=0;i<6;i++){
      const a=i/6*Math.PI*2;const sp=mesh(new THREE.ConeGeometry(.07,.2,10),MAT.gold);
      sp.position.set(Math.cos(a)*.28,.3,Math.sin(a)*.28);g.add(sp);
      const tb=ball(.035,MAT.gold,Math.cos(a)*.28,.41,Math.sin(a)*.28);g.add(tb);
    }
    ['#ff8fab','#7cc4f2','#7fd8a6'].forEach((c,i)=>{const a=(i-1)*.7;const gem=ball(.05,phys({color:c,roughness:.05,clearcoat:1}),Math.cos(a)*.3,.12,Math.sin(a)*.3);g.add(gem);});
    g.rotation.z=-.12;
  }else if(id==='hat_cartola'){
    const purple=std('#6b5f8f',{roughness:.6});
    const brim=mesh(new THREE.CylinderGeometry(.44,.44,.04,40),purple);brim.position.y=.06;g.add(brim);
    const top=mesh(new THREE.CylinderGeometry(.27,.27,.46,40),purple);top.position.y=.3;g.add(top);
    const bandM=mesh(new THREE.CylinderGeometry(.278,.278,.09,40),std('#f5a3c7'));bandM.position.y=.14;g.add(bandM);
    g.rotation.z=-.15;
  }else if(id==='hat_flor'){
    const ring=mesh(new THREE.TorusGeometry(.4,.035,10,40),std('#8fd694'));ring.rotation.x=Math.PI/2;ring.position.y=.02;g.add(ring);
    const cols=['#ff9ec0','#ffb3d4','#ff9ec0','#ffa8cc','#c7a8ff','#ff9ec0','#ffb3d4'];
    cols.forEach((c,i)=>{
      const a=i/cols.length*Math.PI*2;const f=new THREE.Group();f.position.set(Math.cos(a)*.4,.06,Math.sin(a)*.4);
      for(let k=0;k<5;k++){const b=k/5*Math.PI*2;f.add(ball(.055,std(c,{roughness:.7}),Math.cos(b)*.06,.02,Math.sin(b)*.06,1,.6,1));}
      f.add(ball(.04,std('#ffe38a'),0,.05,0));g.add(f);
    });
    g.rotation.z=-.15;
  }else if(id==='hat_laco'){
    const pink=phys({color:'#ff9ec7',roughness:.35,clearcoat:.6,sheen:.5});
    const l=ball(.17,pink,0,.12,-.17,.6,.75,1.15);l.rotation.x=.4;g.add(l);
    const r=ball(.17,pink,0,.12,.17,.6,.75,1.15);r.rotation.x=-.4;g.add(r);
    g.add(ball(.08,pink,0,.12,0));
    g.position.set(.05,0,.1);g.rotation.x=-.35;
  }else if(id==='hat_bone'){
    const blue=std('#8ecbf5',{roughness:.6});
    const dome=mesh(new THREE.SphereGeometry(.42,32,16,0,Math.PI*2,0,Math.PI/2),blue);dome.position.y=-.02;g.add(dome);
    const visor=mesh(new THREE.CylinderGeometry(.3,.3,.035,32,1,false,-Math.PI/2,Math.PI),std('#5fa6dc'));
    visor.position.set(.28,0,0);visor.scale.set(1.1,1,1.25);g.add(visor);
    g.add(ball(.05,std('#ffd166'),0,.4,0));
    g.position.y=-.05;
  }
  return g;
}

// ── ROUPINHAS (tênis, suéter, mochila, cachecol, pintinhas) ──
// tecido listrado desenhado num canvas (listras horizontais = tricô)
function stripeTex(cols,n=8,knit=true){
  const c=document.createElement('canvas');c.width=64;c.height=128;const x=c.getContext('2d');
  for(let i=0;i<n;i++){x.fillStyle=cols[i%cols.length];x.fillRect(0,i*128/n,64,128/n+1);}
  if(knit){x.strokeStyle='rgba(0,0,0,.12)';x.lineWidth=1.5;for(let y=0;y<128;y+=6)for(let xx=0;xx<64;xx+=8){x.beginPath();x.moveTo(xx,y);x.lineTo(xx+4,y+4);x.lineTo(xx+8,y);x.stroke();}}
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;
}
const SHOE_COLS=['#ff3b55','#3d9ff0','#ffd23f','#43bf63'];
function addExtra(g,parent,m){parent.add(m);g.userData.extra=(g.userData.extra||[]).concat(m);}
function buildOutfit(id,rig){
  const g=new THREE.Group();
  if(id==='out_tenis'){
    // um tênis em cada perninha: cano colorido, sola branca e cadarço
    rig.segs.forEach((s,i)=>s.legs.forEach((l,k)=>{
      const shoe=new THREE.Group();shoe.position.set(.05,-.14,0);shoe.scale.setScalar(1.7);
      const col=SHOE_COLS[(i+k)%SHOE_COLS.length];
      shoe.add(ball(.09,std(col,{roughness:.45}),.02,.01,0,1.45,.75,1));
      shoe.add(ball(.09,std('#ffffff',{roughness:.6}),.03,-.035,0,1.55,.35,1.08));
      const lace=mesh(new THREE.TorusGeometry(.03,.008,6,12),std('#ffffff'),false);lace.position.set(.05,.06,0);lace.rotation.x=Math.PI/2;shoe.add(lace);
      addExtra(g,l,shoe);
    }));
  }else if(id==='out_sueter'){
    // suéter de tricô nos 3 primeiros gomos, com golinha
    const tex=stripeTex(['#e84a5f','#ffffff','#3d9ff0','#ffffff'],8);
    const mat=new THREE.MeshStandardMaterial({map:tex,roughness:.95});
    rig.segs.slice(0,3).forEach(s=>{const sh=ball(s.r*1.04,mat,0,.01,0,1,.98,1.02);addExtra(g,s.g,sh);});
    const collar=mesh(new THREE.TorusGeometry(.4,.08,10,28),std('#e84a5f',{roughness:.9}));collar.position.set(.38,.08,0);collar.rotation.y=Math.PI/2;
    addExtra(g,rig.segs[0].g,collar);
  }else if(id==='out_mochila'){
    // mochilinha de exploradora nas costas
    const s=rig.segs[1];
    const bag=new THREE.Group();bag.position.set(-.1,s.r*.86,0);bag.rotation.z=.12;
    const rbox=(w,h,d,r,c)=>{const sh=new THREE.Shape();sh.moveTo(-w/2+r,-h/2);sh.lineTo(w/2-r,-h/2);sh.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);sh.lineTo(w/2,h/2-r);sh.quadraticCurveTo(w/2,h/2,w/2-r,h/2);sh.lineTo(-w/2+r,h/2);sh.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);sh.lineTo(-w/2,-h/2+r);sh.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
      const geo=new THREE.ExtrudeGeometry(sh,{depth:d,bevelEnabled:true,bevelThickness:.04,bevelSize:.04,bevelSegments:3,curveSegments:6});geo.center();return mesh(geo,std(c,{roughness:.75}));};
    const main=rbox(.56,.56,.5,.16,'#ff9638');main.position.y=.26;bag.add(main);              // corpo da mochila
    const flap=rbox(.6,.2,.54,.08,'#e0701c');flap.position.set(0,.5,0);bag.add(flap);          // tampa
    [-1,1].forEach(side=>{const pk=rbox(.3,.24,.06,.06,'#ffb35c');pk.position.set(0,.2,side*.3);bag.add(pk);   // bolsos dos lados
      const bk=mesh(new THREE.BoxGeometry(.08,.08,.03),MAT.gold);bk.position.set(0,.42,side*.31);bag.add(bk);});
    [-1,1].forEach(side=>{const st=mesh(new THREE.TorusGeometry(s.r*1.01,.035,8,30,Math.PI*.55),std('#8a4a1c',{roughness:.8}),false);
      st.rotation.y=Math.PI/2;st.rotation.x=side>0?.25:-.25;st.position.set(.12*side,-s.r*.92,0);st.rotation.z=Math.PI/2-.8;bag.add(st);});
    addExtra(g,s.g,bag);
  }else if(id==='out_cachecol'){
    // cachecol listrado no pescoço, com as pontas balançando
    const tex=stripeTex(['#ff3b55','#ffffff','#ffd23f','#ffffff'],6,true);tex.repeat.set(4,1);
    const mat=new THREE.MeshStandardMaterial({map:tex,roughness:.95,side:THREE.DoubleSide});
    const ring=mesh(new THREE.TorusGeometry(.5,.19,12,32),mat);ring.position.set(.68,.68,0);ring.rotation.y=Math.PI/2;ring.rotation.x=.15;g.add(ring);
    const tails=[];
    [[-.1,.5],[.12,.56]].forEach(([dx,dz],i)=>{
      const piv=new THREE.Group();piv.position.set(.7+dx,.6,dz);
      const t2=stripeTex(['#ff3b55','#ffffff','#ffd23f','#ffffff'],6,true);
      const tail=mesh(new THREE.BoxGeometry(.24,.55,.07),new THREE.MeshStandardMaterial({map:t2,roughness:.95}));tail.position.y=-.25;piv.add(tail);
      const fr=mesh(new THREE.BoxGeometry(.22,.06,.07),std('#ffd23f'));fr.position.y=-.52;piv.add(fr);
      g.add(piv);tails.push(piv);
    });
    rig.outfitAnim=(t,moving)=>{tails.forEach((p,i)=>{p.rotation.z=-.25+Math.sin(t*(moving?9:2.2)+i)*(moving?.3:.08);p.rotation.x=.3+Math.sin(t*1.7+i)*.05;});};
  }else if(id==='out_pintinhas'){
    // pintinhas pretas de joaninha espalhadas pelo corpo
    const dot=std('#1d1a2e',{roughness:.35});
    const dirs=[[0,1,0],[.35,.75,.55],[-.35,.75,-.55],[-.3,.7,.6],[.3,.7,-.6],[0,.35,.95],[0,.35,-.95]];
    rig.segs.forEach((s,i)=>dirs.forEach((d,k)=>{
      if((i+k)%2&&k>0)return;
      const v=new THREE.Vector3(...d).normalize();
      const m=ball(.09+(k===0?.03:0),dot,0,0,0,1,1,.35);m.position.copy(v.clone().multiplyScalar(s.r*.99));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),v);
      addExtra(g,s.g,m);
    }));
  }
  return g;
}
function setLook(rig,hat,outfit){
  const key=(hat||'')+'|'+(outfit||'');
  if(rig.look===key)return;rig.look=key;
  rig.hatSlot.clear();
  if(rig.outfitSlot.userData.cur&&rig.outfitSlot.userData.cur.userData.extra)
    rig.outfitSlot.userData.cur.userData.extra.forEach(m=>m.parent&&m.parent.remove(m));
  rig.outfitSlot.clear();rig.outfitAnim=null;
  if(hat)rig.hatSlot.add(buildHat(hat));
  if(outfit){const o=buildOutfit(outfit,rig);rig.outfitSlot.add(o);rig.outfitSlot.userData.cur=o;}
  flyDeco(rig);if(rig.fly)setButterfly(rig,rig.isFly);
}

// ── BORBOLETA: a Mimi depois do casulo (asas com as cores dela) ──
function wingGeo(fore){
  const sh=new THREE.Shape();
  if(fore){sh.moveTo(0,0);sh.bezierCurveTo(.55,.25,1.25,1.05,1.05,1.75);sh.bezierCurveTo(.85,2.15,.1,2.05,-.25,1.55);sh.bezierCurveTo(-.45,1.05,-.3,.4,0,0);}
  else{sh.moveTo(0,0);sh.bezierCurveTo(-.15,.55,-.35,1.2,-.85,1.35);sh.bezierCurveTo(-1.35,1.45,-1.45,.85,-1.05,.45);sh.bezierCurveTo(-.75,.15,-.35,0,0,0);}
  const g=new THREE.ShapeGeometry(sh,24);g.rotateX(Math.PI/2);   // a asa fica deitada e cresce para +z
  const pts=sh.getSpacedPoints(80).map(p=>new THREE.Vector3(p.x,0,p.y));
  g.userData.edge=new THREE.BufferGeometry().setFromPoints(pts);
  return g;
}
const WG={fore:wingGeo(true),hind:wingGeo(false),dot:new THREE.CircleGeometry(1,24).rotateX(Math.PI/2)};
function buildButterfly(rig){
  const g=new THREE.Group();
  const m=rig.mats;
  const wingMat=new THREE.MeshPhysicalMaterial({color:m.body.color,roughness:.45,sheen:.6,sheenColor:new THREE.Color('#ffffff'),side:THREE.DoubleSide,clearcoat:.3});
  const edgeMat=new THREE.MeshStandardMaterial({color:'#3b3058',roughness:.6,side:THREE.DoubleSide});
  const dotMat=new THREE.MeshStandardMaterial({color:m.tip.color,roughness:.4,side:THREE.DoubleSide,emissive:m.tip.color,emissiveIntensity:.15});
  const whiteMat=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.5,side:THREE.DoubleSide});
  const bellyMat=new THREE.MeshPhysicalMaterial({color:m.belly.color,roughness:.5,side:THREE.DoubleSide});
  g.userData.mats={wingMat,dotMat,bellyMat};
  // corpinho: tórax e abdômen listrado
  const thorax=ball(.4,m.body,.3,.84,0,1.1,1,1);g.add(thorax);
  const abd=ball(.3,m.body,-.45,.72,0,2.1,1,1);g.add(abd);
  [-.2,-.5,-.8].forEach(x=>{const r=mesh(new THREE.TorusGeometry(.27*(1-Math.abs(x+.3)*.35),.04,8,24),edgeMat);r.position.set(x,.72,0);r.rotation.y=Math.PI/2;g.add(r);});
  const wings=[];
  [-1,1].forEach(side=>{
    const piv=new THREE.Group();piv.position.set(.15,1.08,side*.12);g.add(piv);
    const inner=new THREE.Group();inner.scale.z=side;piv.add(inner);
    [[WG.fore,0],[WG.hind,-.1]].forEach(([geo,x],k)=>{
      const w=mesh(geo,wingMat,true);w.position.x=x;inner.add(w);
      const edge=new THREE.LineLoop(geo.userData.edge,new THREE.LineBasicMaterial({color:'#3b3058'}));edge.position.x=x;inner.add(edge);
      [.01,-.01].forEach(o=>{const patch=mesh(geo,bellyMat,false);patch.position.set(x,o,0);patch.scale.setScalar(.45);inner.add(patch);});
    });
    [[.55,1.45,.22,dotMat],[.1,1.7,.13,whiteMat],[.75,1.05,.1,whiteMat],[-.8,.95,.2,dotMat],[-1.0,.6,.09,whiteMat]].forEach(([x,z,r,mt])=>{
      [.018,-.018].forEach(o=>{const d=mesh(WG.dot,mt,false);d.position.set(x,o,z);d.scale.setScalar(r);inner.add(d);});
    });
    wings.push({piv,side,inner});
  });
  g.userData.wings=wings;g.visible=false;
  g.userData.deco=new THREE.Group();g.add(g.userData.deco);
  return g;
}
function buildCocoon(){
  const g=new THREE.Group();
  const silk=new THREE.MeshPhysicalMaterial({color:'#f6e7bf',roughness:.75,sheen:1,sheenColor:new THREE.Color('#ffffff'),emissive:new THREE.Color('#ffe9a8'),emissiveIntensity:0,transparent:true});
  const shell=ball(1,silk,0,0,0,1.75,.95,.95);g.add(shell);
  const band=new THREE.MeshStandardMaterial({color:'#e2c98a',roughness:.8,transparent:true});
  [-1.05,-.45,.2,.85].forEach((x,i)=>{const r=1-Math.pow(x/1.8,2);const t=mesh(new THREE.TorusGeometry(.95*Math.sqrt(Math.max(.1,r)),.05,8,32),band);t.position.x=x;t.rotation.y=Math.PI/2;t.rotation.x=.25*(i%2?1:-1);g.add(t);});
  g.position.set(-.05,.85,0);g.visible=false;
  g.userData={silk,band};
  const sparks=[];
  const gold=new THREE.MeshStandardMaterial({color:'#ffd166',emissive:new THREE.Color('#ffb400'),emissiveIntensity:.5,roughness:.3,transparent:true});
  for(let i=0;i<10;i++){const sp=mesh(GSTAR,gold,false);sp.visible=false;const a=i/10*Math.PI*2;sp.userData.dir=new THREE.Vector3(Math.cos(a)*1.2,.6+Math.sin(a*3)*.5,Math.sin(a)*1.2);sparks.push(sp);}
  return {g,sparks,gold};
}
// a roupa escolhida também aparece na borboleta
function flyDeco(rig){
  if(!rig.fly)return;
  const u=rig.fly.userData;
  (u.decoParts||[]).forEach(m=>m.parent&&m.parent.remove(m));u.decoParts=[];
  const add=(par,m)=>{par.add(m);u.decoParts.push(m);};
  const outfit=(rig.look||'').split('|')[1];
  if(outfit==='out_pintinhas'){
    const dot=std('#1d1a2e',{roughness:.35,side:THREE.DoubleSide});
    u.wings.forEach(w=>{[[.4,1.15,.16],[.05,1.45,.11],[-.7,.8,.14],[.6,.6,.09]].forEach(([x,z,r])=>[.03,-.03].forEach(o=>{const d=mesh(WG.dot,dot,false);d.position.set(x,o,z);d.scale.setScalar(r);add(w.inner,d);}));});
  }else if(outfit==='out_sueter'){
    const mat=new THREE.MeshStandardMaterial({map:stripeTex(['#e84a5f','#ffffff','#3d9ff0','#ffffff'],8),roughness:.95});
    add(u.deco,ball(.43,mat,.3,.84,0,1.1,1,1));
  }else if(outfit==='out_mochila'){
    const bag=new THREE.Group();bag.position.set(-.05,1.05,0);
    bag.add(ball(.2,std('#ff9638',{roughness:.7}),0,0,0,1.1,1,1.1));bag.add(ball(.2,std('#e0701c',{roughness:.7}),.04,.08,0,1.05,.55,1.12));
    add(u.deco,bag);
  }else if(outfit==='out_tenis'){
    [[.2,1],[.2,-1],[-.1,1],[-.1,-1]].forEach(([x,side],i)=>{const sh=ball(.08,std(SHOE_COLS[i],{roughness:.45}),x,.42,side*.22,1.5,.8,1);add(u.deco,sh);});
  }
}
function setButterfly(rig,on){
  rig.isFly=!!on;
  rig.body.visible=!on;rig.fly.visible=!!on;
  rig.outfitSlot.visible=!on||(rig.look||'').endsWith('|out_cachecol');
}

// ── CENA (luzes + chão que recebe a sombra) ──
const VIEWS={
  front:{pos:[1.0,2.4,7.6],look:[-.05,.72,0],fov:30,yaw:-.55},
  game: {pos:[0,6.4,3.7],look:[0,.4,0],fov:30,yaw:0},
};
function buildScene(view){
  const scene=new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff','#f1c2dc',.7));
  const key=new THREE.DirectionalLight('#fff6ea',1.05);
  key.position.set(2.5,6,4);key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);
  Object.assign(key.shadow.camera,{left:-2.5,right:2.5,top:2.5,bottom:-2.5,near:1,far:15});
  key.shadow.bias=-.0015;key.shadow.radius=6;
  scene.add(key);
  const rim=new THREE.DirectionalLight('#d6c6ff',.55);rim.position.set(-4,3,-4);scene.add(rim);
  const fill=new THREE.DirectionalLight('#ffe0ef',.3);fill.position.set(-2,1,5);scene.add(fill);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(10,10),new THREE.ShadowMaterial({opacity:view==='game'?.22:.16}));
  ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
  const v=VIEWS[view]||VIEWS.front;
  const cam=new THREE.PerspectiveCamera(v.fov,1,.1,50);
  cam.position.set(...v.pos);cam.lookAt(...v.look);
  return {scene,cam};
}

// ── LUGARES (slots) ──
const slots=new Set();
const DIR_YAW={right:0,left:Math.PI,down:-Math.PI/2,up:Math.PI/2};
function angDiff(a,b){let d=(b-a)%(Math.PI*2);if(d>Math.PI)d-=Math.PI*2;if(d<-Math.PI)d+=Math.PI*2;return d;}

M3.mount=function(container,opts={}){
  if(container.__m3&&container.__m3.canvas.isConnected&&container.contains(container.__m3.canvas)){
    const s=container.__m3;s.setSize(opts.size||s.size);if(opts.mood)s.setMood(opts.mood);return s;
  }
  const view=opts.view||'front';
  const {scene,cam}=buildScene(view);
  const rig=buildMimi();scene.add(rig.root);scene.add(rig.heart);
  setColor(rig,opts.color||M3.color||'rosa');
  rig.fly=buildButterfly(rig);rig.yawG.add(rig.fly);
  rig.cocoon=buildCocoon();rig.yawG.add(rig.cocoon.g);rig.cocoon.sparks.forEach(sp=>rig.yawG.add(sp));
  if(opts.butterfly)setButterfly(rig,true);
  const canvas=document.createElement('canvas');canvas.className='mimi3d';
  canvas.setAttribute('aria-hidden','true');
  const ctx=canvas.getContext('2d');
  container.innerHTML='';container.appendChild(canvas);
  const yaw0=opts.yaw!=null?opts.yaw:(VIEWS[view]||VIEWS.front).yaw;
  const st={t:Math.random()*10,yaw:yaw0,yawT:yaw0,yawVel:0,walkT:0,walking:false,crawl:0,happyT:0,sadT:0,mud:false,
    blink:0,nextBlink:1+Math.random()*2,mood:opts.mood||'normal',prevHeadY:0,prevVel:0,idleHop:opts.idleHop||false,nextHop:2,waveT:0,metaT:-1,danceT:0,biteT:0,comfortT:0,biteDelay:0};
  const slot={canvas,ctx,scene,cam,rig,st,view,size:0,container,
    setSize(px){
      px=Math.max(24,Math.round(px));if(px===this.size)return;this.size=px;
      const dpr=Math.min(2,window.devicePixelRatio||1);
      canvas.width=Math.min(BUF,Math.round(px*dpr));canvas.height=canvas.width;
      canvas.style.width=px+'px';canvas.style.height=px+'px';
    },
    face(dir){if(dir in DIR_YAW)st.yawT=DIR_YAW[dir];else if(typeof dir==='number')st.yawT=dir;},
    step(){st.walkT=1;},
    setWalking(b){st.walking=b;},
    happy(){st.happyT=1;},
    wave(){st.waveT=1;st.happyT=Math.max(st.happyT,.5);},   // "oi!": levanta a cabeça e balança as antenas
    sad(){st.sadT=1;st.comfortT=0;},
    // comemoração na estrela: dancinha e depois uma mordidinha na fruta (cor da fruta)
    celebrate(fruitColor){st.danceT=1;st.happyT=0;st.biteDelay=1.5;rig.bitePiece.material.color.set(fruitColor||'#ffd166');},
    // carinho depois do erro: acena "sim, tudo bem" com a cabeça e solta um coraçãozinho
    comfort(){st.comfortT=1;},
    busy(){return st.danceT>0||st.biteDelay>0||st.biteT>0||st.metaT>=0;},
    // vira borboleta: casulo, brilho, "puf!" e as asas abrem (uns 4,5 segundos)
    metamorph(){setButterfly(rig,false);st.metaT=0;},
    setButterfly(b){setButterfly(rig,b);},
    setColor(id){setColor(rig,id);},
    setMud(b){st.mud=!!b;},
    setMood(m){st.mood=m||'normal';},
    setLook(h,o){setLook(rig,h,o);},
    dispose(){slots.delete(slot);container.__m3=null;},
  };
  slot.setSize(opts.size||120);
  setLook(rig,opts.hat||null,opts.outfit||null);
  container.__m3=slot;slots.add(slot);
  if(view==='game')rig.root.scale.setScalar(1);
  startLoop();
  return slot;
};

// ── ANIMAÇÃO (tudo calculado por código a cada quadro) ──
function updateRig(slot,dt){
  const {rig,st}=slot;
  // no modo calmo, os movimentos de enfeite (respirar, balançar) ficam parados; os de ação continuam
  const idle=M3.calm?0:1;
  st.t+=dt*idle;const t=st.t;
  // virar para a direção do passo (gira pelo lado mais curto)
  const d=angDiff(st.yaw,st.yawT);
  const yawVelPrev=st.yawVel;
  st.yawVel=d*Math.min(1,dt*12)/Math.max(dt,1e-3);
  st.yaw+=d*Math.min(1,dt*12);
  // passos: uma onda que corre do rabo até a cabeça, como uma lagarta de verdade
  if(st.walkT>0)st.walkT=Math.max(0,st.walkT-dt/.34);
  const moving=st.walking||st.walkT>0;
  if(moving)st.crawl+=dt*(st.mud?7:15);
  const crawlAmp=st.walking?1:Math.min(1,st.walkT*1.6);
  rig.segs.forEach((s,i)=>{
    const breathe=1+.028*Math.sin(t*2.3-i*.7)*idle;
    const ph=st.crawl-(rig.segs.length-1-i)*1.1;
    const lift=moving?Math.max(0,Math.sin(ph))*.13*crawlAmp:0;
    const squash=moving?1+.07*Math.sin(ph+1.2)*crawlAmp:1;
    s.g.position.y=s.baseY+lift;
    s.g.position.x=s.x+(moving?Math.cos(ph)*.07*crawlAmp*(1+i*.3):0);   // o corpo estica e encolhe, dá para ver até de cima
    s.ball.scale.set(s.r*squash,s.r*breathe/squash,s.r*breathe);
    s.legs.forEach((l,k)=>{l.rotation.z=moving?Math.sin(ph*1.0+k*Math.PI)*.6*crawlAmp:Math.sin(t*1.5+i+k)*.05;});
  });
  // cabeça: balança de leve, acompanha a onda
  const hph=st.crawl+.3;
  let headY=.84+(moving?Math.max(0,Math.sin(hph))*.09*crawlAmp:0)+Math.sin(t*2.3+.5)*.02*idle;
  // aceno: a cabeça sobe e balança de um lado para o outro
  let waveLift=0;
  if(st.waveT>0){st.waveT=Math.max(0,st.waveT-dt/1.6);const p=1-st.waveT;waveLift=Math.sin(p*Math.PI);headY+=waveLift*.35;}
  rig.headPivot.position.y=headY;
  rig.head.rotation.z=Math.sin(t*1.3)*.05+(moving?Math.sin(hph)*.06*crawlAmp:0);
  rig.head.rotation.y=Math.sin(t*.9)*.08;
  // no labirinto, quando ela vem para baixo (na direção de quem joga), levanta o rosto para aparecer
  if(slot.view==='game'){const toward=Math.max(0,-Math.sin(st.yaw));rig.head.rotation.z+=toward*.75;}

  // pulo de alegria (2 pulinhos com giro)
  let y=0,spin=0,sx=1,sy=1;
  if(st.happyT>0){
    st.happyT=Math.max(0,st.happyT-dt/1.3);const p=1-st.happyT;
    const hop=Math.abs(Math.sin(p*Math.PI*2));
    y=hop*.55;spin=p<.5?p*2*Math.PI*2:0;
    const land=1-hop;sy=1-.18*land*land*(1-p);sx=1+.12*land*land*(1-p);
  }else if(st.idleHop){
    st.nextHop-=dt*idle;if(st.nextHop<0){st.happyT=.5;st.nextHop=3+Math.random()*3;}
  }
  // tristeza (bateu): balança a cabeça "não"
  let shake=0;
  if(st.sadT>0){st.sadT=Math.max(0,st.sadT-dt/.9);const p=1-st.sadT;shake=Math.sin(p*Math.PI*6)*.45*(1-p);}
  rig.head.rotation.y+=shake;
  // lama: afunda e treme
  if(st.mud){y-=.12;rig.yawG.rotation.z=Math.sin(t*10)*.06;rig.yawG.rotation.x=Math.sin(t*7)*.05;}
  else{rig.yawG.rotation.z=0;rig.yawG.rotation.x=0;}
  // dancinha: o corpo faz uma onda de um lado para o outro e ela pula no ritmo
  let dance=0;
  if(st.danceT>0){
    st.danceT=Math.max(0,st.danceT-dt/1.5);const p=1-st.danceT;dance=Math.sin(p*Math.PI);
    const beat=p*Math.PI*8;
    rig.segs.forEach((s,i)=>{s.g.position.z=Math.sin(beat-i*.9)*.3*dance;});
    rig.headPivot.position.z=Math.sin(beat+.9)*.3*dance;
    y+=Math.abs(Math.sin(beat/2))*.22*dance;
    spin+=(p<.5?0:(1-Math.cos((p-.5)*2*Math.PI))/2*Math.PI*2);   // no fim, um giro completo
  }else{rig.segs.forEach(s=>{s.g.position.z=0;});rig.headPivot.position.z=0;}
  // mordidinha: 3 nhacs no pedaço da fruta, que vai diminuindo
  let chomp=0;
  if(st.biteDelay>0){st.biteDelay-=dt;if(st.biteDelay<=0){st.biteT=1;rig.bitePiece.visible=true;}}
  if(st.biteT>0){
    st.biteT=Math.max(0,st.biteT-dt/1.5);const p=1-st.biteT;
    chomp=Math.max(0,Math.sin(p*Math.PI*6));
    const left=1-Math.floor(p*3+.15)/3;
    rig.bitePiece.scale.setScalar(.36*Math.max(.05,left));
    rig.bitePiece.position.y=.3*Math.max(.3,left);
    if(st.biteT===0)rig.bitePiece.visible=false;
  }
  // carinho: a cabeça diz "sim" devagar e um coração sobe
  let nod=0;
  if(st.comfortT>0){
    st.comfortT=Math.max(0,st.comfortT-dt/1.8);const p=1-st.comfortT;
    nod=Math.sin(p*Math.PI*4)*.2*(1-p*.6);
    const hp=new THREE.Vector3();rig.head.getWorldPosition(hp);
    rig.heart.visible=true;
    rig.heart.position.set(hp.x,hp.y+.8+p*1.1,hp.z);
    rig.heart.quaternion.copy(slot.cam.quaternion);
    const sc=.42*Math.min(1,p*5);rig.heart.scale.setScalar(sc);
    rig.heart.material.opacity=Math.min(1,(1-p)*3);
    if(st.comfortT===0)rig.heart.visible=false;
  }
  // borboleta: flutua e bate as asas
  if(rig.isFly){
    const fl=st.flyIn!=null?st.flyIn:1;
    y+=(.3+Math.sin(t*2.2)*.1*idle)*fl;sx*=.74;sy*=.74;
    const flap=Math.sin(performance.now()/(M3.calm?260:110));
    const open=st.wingOpen!=null?st.wingOpen:1;
    rig.fly.userData.wings.forEach(w=>{w.piv.rotation.x=-w.side*((.95+.45*flap)*open+(1-open)*1.5);w.piv.scale.setScalar(.2+.8*open);});
    rig.yawG.rotation.z=.12+Math.sin(t*2.2+1)*.05*idle;
  }
  // metamorfose
  if(st.metaT>=0){
    st.metaT+=dt;const T=st.metaT,c=rig.cocoon;
    if(T<1.2){                       // o casulo vai crescendo em volta dela
      const k=T/1.2;c.g.visible=true;c.g.scale.setScalar(.15+.85*(1-Math.pow(1-k,3)));
      c.g.userData.silk.opacity=1;c.g.userData.band.opacity=1;c.g.userData.silk.emissiveIntensity=0;
      rig.body.scale.setScalar(1-.25*k);rig.headPivot.scale.setScalar(1-.3*k);
    }else if(T<2.8){                 // balança e começa a brilhar
      const k=(T-1.2)/1.6;c.g.scale.setScalar(1+.04*Math.sin(T*18)*k);
      c.g.rotation.z=Math.sin(T*(6+k*14))*.12*k;c.g.userData.silk.emissiveIntensity=k*.9;
      rig.body.visible=false;rig.headPivot.visible=false;
    }else if(T<3.4){                 // puf! as estrelinhas voam e a borboleta aparece
      const k=(T-2.8)/.6;
      if(!rig.isFly){setButterfly(rig,true);rig.headPivot.visible=true;rig.headPivot.scale.setScalar(1);c.sparks.forEach(sp=>sp.visible=true);}
      c.g.scale.setScalar(1+k*.8);c.g.userData.silk.opacity=1-k;c.g.userData.band.opacity=1-k;
      st.wingOpen=k;st.flyIn=k;
    }else{
      c.g.visible=false;c.g.rotation.z=0;st.wingOpen=1;st.flyIn=1;
      if(T>4.6){st.metaT=-1;c.sparks.forEach(sp=>sp.visible=false);rig.body.scale.setScalar(1);}
    }
    if(T>=2.8&&T<=4.6){
      const k=(T-2.8)/1.8;c.gold.opacity=1-k;
      c.sparks.forEach(sp=>{sp.position.set(-.05+sp.userData.dir.x*k*2.2,.85+sp.userData.dir.y*k*2.2,sp.userData.dir.z*k*2.2);sp.scale.setScalar(.14*(1-k*.5));sp.rotation.z=k*6;});
    }
    if(T<2.8){y=0;spin=0;}
    if(T>=2.8&&T<4.6)spin+=Math.sin((T-2.8)/1.8*Math.PI)*.6;
  }
  rig.root.position.y=y;
  rig.root.scale.set(sx,sy,sx);
  rig.yawG.rotation.y=st.yaw+spin;

  // humor
  const happyFace=st.mood==='happy'||st.happyT>0||st.danceT>0||st.biteT>0;
  const sadFace=(st.mood==='sad'||st.sadT>0||st.mud)&&!(st.comfortT>0&&st.sadT===0);
  rig.eyes.forEach(e=>e.visible=!happyFace);
  rig.happyEyes.forEach(e=>e.visible=happyFace);
  rig.smile.visible=!sadFace&&chomp<.35;rig.oMouth.visible=sadFace||chomp>=.35;
  if(chomp>=.35)rig.oMouth.scale.set(.06*1.6,.06*1.6*chomp,.03);else rig.oMouth.scale.set(.06,.051,.03);
  rig.sweat.visible=sadFace;
  if(sadFace)rig.sweat.position.y=.42-((t*.6)%1)*.15;
  // piscar
  st.nextBlink-=dt;
  if(st.nextBlink<0){st.blink=.14;st.nextBlink=2.2+Math.random()*2.8;}
  let eyeS=1;if(st.blink>0){st.blink-=dt;eyeS=.12;}
  if(sadFace)eyeS*=.8;
  rig.eyes.forEach(e=>e.scale.set(1,eyeS,1));

  // antenas = molinhas: reagem ao sobe-e-desce e ao giro da cabeça
  const wy=headY+y;
  const vel=(wy-st.prevHeadY)/Math.max(dt,1e-3);const acc=(vel-st.prevVel)/Math.max(dt,1e-3);
  st.prevHeadY=wy;st.prevVel=vel;
  const yawAcc=(st.yawVel-yawVelPrev)/Math.max(dt,1e-3);
  const droop=sadFace?-.45:0;
  rig.ants.forEach(a=>{
    const k=90,c=7;
    const f=-k*(a.ang-droop)-c*a.vel-Math.max(-60,Math.min(60,acc))*.9;
    a.vel+=f*dt;a.ang+=a.vel*dt;
    const f2=-k*a.ang2-c*a.vel2-Math.max(-200,Math.min(200,yawAcc))*.12+Math.sin(t*1.7+a.side)*1.5*idle+(st.waveT>0?Math.sin(performance.now()/60)*40*waveLift:0);
    a.vel2+=f2*dt;a.ang2+=a.vel2*dt;
    a.piv.rotation.z=a.ang;a.piv.rotation.x=a.ang2*a.side*.8+a.side*.08;
  });
  if(rig.outfitAnim)rig.outfitAnim(t,moving);
  if(waveLift){rig.head.rotation.z+=waveLift*.35;rig.head.rotation.x=Math.sin(performance.now()/130)*.35*waveLift;rig.segs[0].g.position.y+=waveLift*.18;}
  else rig.head.rotation.x=0;
  if(chomp)rig.head.rotation.z-=chomp*.55;         // abaixa a cabeça para morder
  if(nod)rig.head.rotation.z+=nod;
  if(dance)rig.head.rotation.x+=Math.sin((1-st.danceT)*Math.PI*8)*.25*dance;
}

let running=false,last=0;
function frame(now){
  const dt=Math.min(.05,(now-(last||now))/1000);last=now;
  if(!slots.size){running=false;return;}
  slots.forEach(s=>{
    if(!s.canvas.isConnected){slots.delete(s);return;}
    updateRig(s,dt);
    if(s.canvas.offsetParent===null)return;          // escondida: não precisa desenhar
    renderer.render(s.scene,s.cam);
    s.ctx.clearRect(0,0,s.canvas.width,s.canvas.height);
    s.ctx.drawImage(renderer.domElement,0,0,s.canvas.width,s.canvas.height);
  });
  requestAnimationFrame(frame);
}
function startLoop(){if(!running){running=true;last=0;requestAnimationFrame(frame);}}
})();
