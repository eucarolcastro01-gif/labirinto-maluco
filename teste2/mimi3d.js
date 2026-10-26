// ═══════════════════════════════════════════════════════════════
//  MIMI 3D — a lagarta desenhada e animada só com código (Three.js)
//  Um único "motor" WebGL desenha cada Mimi da tela e copia a imagem
//  para o <canvas> de cada lugar (início, mapa, jogo, parabéns).
//  Se o navegador não tiver WebGL, Mimi3D.ok fica false e o jogo
//  continua usando a Mimi desenhada em SVG.
// ═══════════════════════════════════════════════════════════════
(function(){
const M3={ok:false};
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
  const segs=[];
  SEGS.forEach((s,i)=>{
    const g=new THREE.Group();g.position.set(s.x,s.r+LEG_H,0);
    const b=ball(s.r,MAT.body);g.add(b);
    const belly=ball(s.r*.82,MAT.belly,0,-s.r*.32,0,1,.55,1.02);belly.castShadow=false;g.add(belly);
    const legs=[];
    [-1,1].forEach(side=>{
      const l=mesh(G.leg,MAT.leg);
      l.position.set(0,-s.r-.02,side*s.r*.45);
      g.add(l);legs.push(l);
    });
    body.add(g);segs.push({g,ball:b,legs,r:s.r,baseY:s.r+LEG_H,x:s.x,i});
  });

  // cabeça
  const headPivot=new THREE.Group();headPivot.position.set(1.05,.84,0);yawG.add(headPivot);
  const head=new THREE.Group();headPivot.add(head);
  const skull=ball(.6,MAT.head);head.add(skull);
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
    const st=mesh(new THREE.TubeGeometry(curve,16,.032,8,false),MAT.stalk);piv.add(st);
    const tip=ball(.11,MAT.tip,-.2,.57,side*.2);piv.add(tip);
    ants.push({piv,side,ang:0,vel:0,ang2:0,vel2:0});
  });

  const hatSlot=new THREE.Group();hatSlot.position.set(-.05,.5,0);head.add(hatSlot);
  const outfitSlot=new THREE.Group();yawG.add(outfitSlot);

  return {root,yawG,body,segs,headPivot,head,eyes,eyeHi,happyEyes,smile,oMouth,sweat,ants,hatSlot,outfitSlot,
    look:'',cape:null,wings:null};
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

function makeCape(){
  const geo=new THREE.PlaneGeometry(2.1,1.3,28,10);
  const pos=geo.attributes.position;const base=new Float32Array(pos.array);
  const m=new THREE.Mesh(geo,phys({color:'#ff3b55',roughness:.55,sheen:.6,sheenColor:new THREE.Color('#ff9aa8'),side:THREE.DoubleSide}));
  m.castShadow=true;
  m.rotation.x=-Math.PI/2;
  m.position.set(-.35,1.04,0);
  const gold=mesh(new THREE.TorusGeometry(.2,.035,8,24),MAT.gold);gold.position.set(.72,.92,0);gold.rotation.y=Math.PI/2;
  const g=new THREE.Group();g.add(m);g.add(gold);
  g.userData.update=(t)=>{
    for(let i=0;i<pos.count;i++){
      const x=base[i*3],y=base[i*3+1];          // y do plano = largura (vai virar z)
      const back=(1.05-x)/2.1;                   // 0 perto da cabeça, 1 na ponta
      const drape=-1.35*y*y;                     // cai pelos lados do corpo
      const wave=Math.sin(t*5-x*4)*.06*back;
      pos.array[i*3+2]=drape+wave-back*.12;
    }
    pos.needsUpdate=true;geo.computeVertexNormals();
  };
  return g;
}
function makeWings(){
  const s=new THREE.Shape();
  s.moveTo(0,0);s.bezierCurveTo(.2,.9,1.1,1.2,1.05,.55);s.bezierCurveTo(1.0,.2,.6,.1,0,0);
  s.moveTo(0,0);
  const s2=new THREE.Shape();
  s2.moveTo(0,0);s2.bezierCurveTo(.5,-.1,.95,-.35,.75,-.6);s2.bezierCurveTo(.5,-.85,.15,-.4,0,0);
  const geo=new THREE.ExtrudeGeometry([s,s2],{depth:.02,bevelEnabled:true,bevelThickness:.01,bevelSize:.01,bevelSegments:1});
  const mat=phys({color:'#a66bff',roughness:.25,transparent:true,opacity:.9,side:THREE.DoubleSide,sheen:1,sheenColor:new THREE.Color('#ffd0f5'),iridescence:.6});
  const g=new THREE.Group();g.position.set(-.2,.98,0);
  const L=new THREE.Group(),R=new THREE.Group();
  const dotM=std('#ffd166');
  // a forma é desenhada no plano XY: x = para fora (lado), y = para a frente (cabeça)
  [[L,-1],[R,1]].forEach(([grp,side])=>{
    const gg=geo.clone();
    gg.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(0,0,side),new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0)));
    const w=mesh(gg,mat);w.scale.setScalar(.8);grp.add(w);
    const dot=ball(.06,dotM,.48,0,side*.62);grp.add(dot);
    g.add(grp);
  });
  g.userData.update=(t)=>{const a=.85+.35*Math.sin(t*7);L.rotation.x=a;R.rotation.x=-a;};
  return g;
}
function buildOutfit(id,rig){
  const g=new THREE.Group();
  if(id==='out_capa'){const c=makeCape();g.add(c);rig.cape=c;}
  else if(id==='out_borboleta'){const w=makeWings();g.add(w);rig.wings=w;}
  else if(id==='out_arcoirs'){
    const cols=['#ff3d3d','#ff9f00','#ffe000','#2ecc55','#3db5ff','#b03dff'];
    rig.segs.forEach((s,i)=>{
      [-1,0,1].forEach((k,j)=>{
        const c=cols[(i*3+j)%cols.length];
        const tor=mesh(new THREE.TorusGeometry(s.r*.97,.045,10,40),std(c,{roughness:.45}));
        tor.rotation.y=Math.PI/2;tor.position.x=k*.11;
        tor.scale.setScalar(Math.cos(k*.22));
        s.g.add(tor);g.userData.extra=(g.userData.extra||[]).concat(tor);
      });
    });
  }else if(id==='out_estrela'||id==='out_coracao'){
    const geo=id==='out_estrela'?GSTAR:GHEART;
    const mat=id==='out_estrela'?std('#ffd166',{metalness:.3,roughness:.3}):phys({color:'#ff7fae',roughness:.3,clearcoat:.8});
    rig.segs.forEach((s)=>{
      [-1,1].forEach(side=>{
        const m=mesh(geo,mat);m.scale.setScalar(.13);
        const dir=new THREE.Vector3(0,.55,side*.84).normalize();
        m.position.copy(dir.clone().multiplyScalar(s.r*1.0));
        m.lookAt(dir.clone().multiplyScalar(5));
        s.g.add(m);g.userData.extra=(g.userData.extra||[]).concat(m);
      });
      const top=mesh(geo,mat);top.scale.setScalar(.15);top.position.set(0,s.r*1.01,0);top.rotation.x=-Math.PI/2;
      s.g.add(top);g.userData.extra=(g.userData.extra||[]).concat(top);
    });
  }
  return g;
}
function setLook(rig,hat,outfit){
  const key=(hat||'')+'|'+(outfit||'');
  if(rig.look===key)return;rig.look=key;
  rig.hatSlot.clear();
  if(rig.outfitSlot.userData.cur&&rig.outfitSlot.userData.cur.userData.extra)
    rig.outfitSlot.userData.cur.userData.extra.forEach(m=>m.parent&&m.parent.remove(m));
  rig.outfitSlot.clear();rig.cape=null;rig.wings=null;
  if(hat)rig.hatSlot.add(buildHat(hat));
  if(outfit){const o=buildOutfit(outfit,rig);rig.outfitSlot.add(o);rig.outfitSlot.userData.cur=o;}
}

// ── CENA (luzes + chão que recebe a sombra) ──
const VIEWS={
  front:{pos:[1.0,2.4,7.6],look:[-.05,.72,0],fov:30,yaw:-.55},
  game: {pos:[0,4.5,5.9],look:[0,.5,0],fov:30,yaw:0},
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
const DIR_YAW={right:0,left:Math.PI,down:-Math.PI/2+.6,up:Math.PI/2-.6};
function angDiff(a,b){let d=(b-a)%(Math.PI*2);if(d>Math.PI)d-=Math.PI*2;if(d<-Math.PI)d+=Math.PI*2;return d;}

M3.mount=function(container,opts={}){
  if(container.__m3&&container.__m3.canvas.isConnected&&container.contains(container.__m3.canvas)){
    const s=container.__m3;s.setSize(opts.size||s.size);if(opts.mood)s.setMood(opts.mood);return s;
  }
  const view=opts.view||'front';
  const {scene,cam}=buildScene(view);
  const rig=buildMimi();scene.add(rig.root);
  const canvas=document.createElement('canvas');canvas.className='mimi3d';
  canvas.setAttribute('aria-hidden','true');
  const ctx=canvas.getContext('2d');
  container.innerHTML='';container.appendChild(canvas);
  const yaw0=opts.yaw!=null?opts.yaw:(VIEWS[view]||VIEWS.front).yaw;
  const st={t:Math.random()*10,yaw:yaw0,yawT:yaw0,yawVel:0,walkT:0,walking:false,crawl:0,happyT:0,sadT:0,mud:false,
    blink:0,nextBlink:1+Math.random()*2,mood:opts.mood||'normal',prevHeadY:0,prevVel:0,idleHop:opts.idleHop||false,nextHop:2};
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
    sad(){st.sadT=1;},
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
  const {rig,st}=slot;st.t+=dt;const t=st.t;
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
    const breathe=1+.028*Math.sin(t*2.3-i*.7);
    const ph=st.crawl-(rig.segs.length-1-i)*1.1;
    const lift=moving?Math.max(0,Math.sin(ph))*.13*crawlAmp:0;
    const squash=moving?1+.07*Math.sin(ph+1.2)*crawlAmp:1;
    s.g.position.y=s.baseY+lift;
    s.g.position.x=s.x+(moving?Math.cos(ph)*.03*crawlAmp:0);
    s.ball.scale.set(s.r*squash,s.r*breathe/squash,s.r*breathe);
    s.legs.forEach((l,k)=>{l.rotation.z=moving?Math.sin(ph*1.0+k*Math.PI)*.6*crawlAmp:Math.sin(t*1.5+i+k)*.05;});
  });
  // cabeça: balança de leve, acompanha a onda
  const hph=st.crawl+.3;
  let headY=.82+(moving?Math.max(0,Math.sin(hph))*.09*crawlAmp:0)+Math.sin(t*2.3+.5)*.02;
  rig.headPivot.position.y=headY;
  rig.head.rotation.z=Math.sin(t*1.3)*.05+(moving?Math.sin(hph)*.06*crawlAmp:0);
  rig.head.rotation.y=Math.sin(t*.9)*.08;

  // pulo de alegria (2 pulinhos com giro)
  let y=0,spin=0,sx=1,sy=1;
  if(st.happyT>0){
    st.happyT=Math.max(0,st.happyT-dt/1.3);const p=1-st.happyT;
    const hop=Math.abs(Math.sin(p*Math.PI*2));
    y=hop*.55;spin=p<.5?p*2*Math.PI*2:0;
    const land=1-hop;sy=1-.18*land*land*(1-p);sx=1+.12*land*land*(1-p);
  }else if(st.idleHop){
    st.nextHop-=dt;if(st.nextHop<0){st.happyT=.5;st.nextHop=3+Math.random()*3;}
  }
  // tristeza (bateu): balança a cabeça "não"
  let shake=0;
  if(st.sadT>0){st.sadT=Math.max(0,st.sadT-dt/.9);const p=1-st.sadT;shake=Math.sin(p*Math.PI*6)*.45*(1-p);}
  rig.head.rotation.y+=shake;
  // lama: afunda e treme
  if(st.mud){y-=.12;rig.yawG.rotation.z=Math.sin(t*10)*.06;rig.yawG.rotation.x=Math.sin(t*7)*.05;}
  else{rig.yawG.rotation.z=0;rig.yawG.rotation.x=0;}
  rig.root.position.y=y;
  rig.root.scale.set(sx,sy,sx);
  rig.yawG.rotation.y=st.yaw+spin;

  // humor
  const happyFace=st.mood==='happy'||st.happyT>0;
  const sadFace=st.mood==='sad'||st.sadT>0||st.mud;
  rig.eyes.forEach(e=>e.visible=!happyFace);
  rig.happyEyes.forEach(e=>e.visible=happyFace);
  rig.smile.visible=!sadFace;rig.oMouth.visible=sadFace;
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
    const f2=-k*a.ang2-c*a.vel2-Math.max(-200,Math.min(200,yawAcc))*.12+Math.sin(t*1.7+a.side)*1.5;
    a.vel2+=f2*dt;a.ang2+=a.vel2*dt;
    a.piv.rotation.z=a.ang;a.piv.rotation.x=a.ang2*a.side*.8+a.side*.08;
  });
  if(rig.cape)rig.cape.userData.update(t*(moving?1.8:1));
  if(rig.wings)rig.wings.userData.update(t);
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
