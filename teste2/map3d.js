// ═══════════════════════════════════════════════════════════════
//  MAPA 3D — um terreno de verdade: morros, lago, árvores e um caminho
//  de terra que liga as frutas (cada fruta é um modelo 3D feito por código).
//  Os botões das fases continuam em HTML, por cima do desenho, para o
//  teclado e o leitor de tela. Sem WebGL, Map3D.ok fica false e o jogo
//  usa o mapa desenhado em SVG.
// ═══════════════════════════════════════════════════════════════
(function(){
const M={ok:false};
window.Map3D=M;
if(!window.THREE)return;
let renderer;
try{
  const test=document.createElement('canvas');
  if(!(test.getContext('webgl2')||test.getContext('webgl')))return;
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
}catch(e){return;}
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.domElement.className='map3d';
renderer.domElement.setAttribute('aria-hidden','true');
M.ok=true;

const std=(c,o={})=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.8},o));
const SKY='#9fdcff';
function mesh(g,m,cast=true,recv=false){const x=new THREE.Mesh(g,m);x.castShadow=cast;x.receiveShadow=recv;return x;}

// ── ALTURA DO TERRENO ── morrinhos suaves no meio, montanhas lá no fundo
function rawH(x,z){
  return .55*Math.sin(x*.42+.6)*Math.cos(z*.37-.4)+.32*Math.sin(x*.95+1.3)*Math.sin(z*.8+.5)+.18*Math.cos(x*1.7-z*1.3);
}
let NODES=[],FLAT=[];        // pontos das frutas (o chão fica plano em volta delas)
function H(x,z){
  let h=rawH(x,z);
  // longe do centro o terreno sobe (montanhas do horizonte)
  const far=Math.max(0,Math.hypot(x*.8,z)-9);h+=far*far*.09;
  FLAT.forEach(([nx,nz,nh,rad])=>{const d=Math.hypot(x-nx,z-nz);const k=Math.max(0,Math.min(1,(rad-d)/(rad*.55)));const s=k*k*(3-2*k);h=h*(1-s)+nh*s;});
  return h;
}

// ── FRUTAS EM 3D ──
const G={sph:new THREE.SphereGeometry(1,32,22)};
function ball(r,m,x=0,y=0,z=0,sx=1,sy=1,sz=1){const b=mesh(G.sph,m);b.position.set(x,y,z);b.scale.set(r*sx,r*sy,r*sz);return b;}
function lathe(pts,m){const g=new THREE.LatheGeometry(pts.map(([a,b])=>new THREE.Vector2(a,b)),32);return mesh(g,m);}
function leaf(c='#2fb55a',s=1){const sh=new THREE.Shape();sh.moveTo(0,0);sh.quadraticCurveTo(.18*s,.15*s,0,.42*s);sh.quadraticCurveTo(-.18*s,.15*s,0,0);
  const m=mesh(new THREE.ShapeGeometry(sh),std(c,{side:THREE.DoubleSide,roughness:.6}));return m;}
function stem(){const m=mesh(new THREE.CylinderGeometry(.025,.035,.22,8),std('#7a4a24'));m.position.y=.22;return m;}
function texDots(base,dot,n=60,shape='seed'){
  const c=document.createElement('canvas');c.width=256;c.height=128;const x=c.getContext('2d');
  x.fillStyle=base;x.fillRect(0,0,256,128);
  if(shape==='stripes'){x.fillStyle=dot;for(let i=0;i<10;i++){x.beginPath();for(let y=0;y<=128;y+=8){x.lineTo(i*25.6+Math.sin(y*.15+i)*4,y);}for(let y=128;y>=0;y-=8){x.lineTo(i*25.6+11+Math.sin(y*.15+i)*4,y);}x.fill();}}
  else if(shape==='diamond'){x.strokeStyle=dot;x.lineWidth=3;for(let i=-10;i<20;i++){x.beginPath();x.moveTo(i*22,0);x.lineTo(i*22+128,128);x.stroke();x.beginPath();x.moveTo(i*22,128);x.lineTo(i*22+128,0);x.stroke();}
    x.fillStyle='#8a5a06';for(let i=0;i<12;i++)for(let j=0;j<6;j++){x.beginPath();x.arc(i*22+11+(j%2)*11,j*22+11,2.5,0,7);x.fill();}}
  else{x.fillStyle=dot;for(let i=0;i<n;i++){const px=(i*97)%256,py=12+((i*53)%104);x.beginPath();x.ellipse(px,py,2.2,3.4,0,0,7);x.fill();}}
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t;
}
function buildFruit(id){
  const g=new THREE.Group();
  if(id==='maca'){
    const b=lathe([[0,0],[.3,.03],[.46,.2],[.5,.42],[.44,.62],[.26,.7],[.06,.64],[0,.6]],std('#e8323f',{roughness:.35}));g.add(b);
    const s=stem();s.position.y=.72;g.add(s);const l=leaf();l.position.set(.04,.76,0);l.rotation.z=-.9;g.add(l);
  }else if(id==='morango'){
    const b=lathe([[0,0],[.12,.06],[.3,.3],[.42,.58],[.38,.74],[.2,.8],[0,.8]],std('#ffffff',{roughness:.4,map:texDots('#e81e45','#ffe14d',70)}));g.add(b);
    for(let i=0;i<6;i++){const l=leaf('#2fa84f',.8);l.position.y=.8;l.rotation.set(-1.2,i/6*Math.PI*2,0,'YXZ');g.add(l);}
  }else if(id==='laranja'){
    g.add(ball(.44,std('#ffffff',{roughness:.55,map:texDots('#ff9500','#e07a00',140)}),0,.44,0));
    const s=stem();s.position.y=.88;s.scale.setScalar(.6);g.add(s);const l=leaf();l.position.set(.03,.88,0);l.rotation.z=-1.1;g.add(l);
  }else if(id==='pera'){
    const b=lathe([[0,0],[.28,.03],[.42,.2],[.42,.4],[.3,.58],[.2,.72],[.16,.86],[.08,.94],[0,.95]],std('#c8e04a',{roughness:.45}));g.add(b);
    const s=stem();s.position.y=.98;g.add(s);const l=leaf();l.position.set(.04,1.02,0);l.rotation.z=-.9;g.add(l);
  }else if(id==='melancia'){
    g.add(ball(.42,std('#ffffff',{roughness:.5,map:texDots('#3fbf5a','#1d6b34',0,'stripes')}),0,.38,0,1.35,.9,1));
  }else if(id==='abacaxi'){
    const b=lathe([[0,0],[.26,.04],[.36,.22],[.38,.46],[.32,.68],[.18,.8],[0,.82]],std('#ffffff',{roughness:.6,map:texDots('#f5b014','#c97a0a',0,'diamond')}));g.add(b);
    for(let i=0;i<9;i++){const l=mesh(new THREE.ConeGeometry(.06,.5+(i%3)*.12,5),std('#2fa84f',{roughness:.6}));const a=i/9*Math.PI*2;
      l.position.set(Math.cos(a)*.06,1.0,Math.sin(a)*.06);l.rotation.set(Math.sin(a)*.5,0,-Math.cos(a)*.5);g.add(l);}
  }
  g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.userData.color=o.material.color.clone();}});
  return g;
}
// fruta fechada: fica cinzinha
function tint(g,locked){g.traverse(o=>{if(o.isMesh){const c=o.userData.color.clone();if(locked){const l=c.getHSL({}).l;c.setHSL(.7,.08,.38+l*.3);}o.material.color.copy(c);if(o.material.map)o.material.opacity=1;}});}

// ── ENFEITES ──
function tree(x,z,s=1,kind=0){
  const g=new THREE.Group();
  const trunk=mesh(new THREE.CylinderGeometry(.08,.12,.6,8),std('#7a4a24'));trunk.position.y=.3;g.add(trunk);
  if(kind===1){[[0,.9,.5],[0,1.35,.38],[0,1.7,.25]].forEach(([a,y,r])=>{const c=mesh(new THREE.ConeGeometry(r,.6,8),std('#1f7a45',{flatShading:true}));c.position.y=y;g.add(c);});}
  else{const leafM=std(['#2fa84f','#38b85a','#259045'][(x*7+z*3|0)%3&3]||'#2fa84f',{flatShading:true});
    [[0,.95,.45],[.25,.8,.32],[-.22,.82,.34],[0,1.25,.3]].forEach(([a,y,r],i)=>{const c=mesh(new THREE.IcosahedronGeometry(r,1),leafM);c.position.set(a,y,i===3?0:(i%2?.1:-.1));g.add(c);});
    // frutinhas na copa
    const fm=std(['#e8323f','#ff9500','#ffd23f'][Math.abs(x*3+z|0)%3]);for(let i=0;i<4;i++){const a=i*1.7+x;g.add(ball(.06,fm,Math.cos(a)*.38,.9+Math.sin(a*2)*.15,Math.sin(a)*.38));}}
  g.position.set(x,H(x,z),z);g.scale.setScalar(s);g.rotation.y=x*1.3;
  return g;
}
function flower(x,z,c){
  const g=new THREE.Group();
  const st=mesh(new THREE.CylinderGeometry(.012,.012,.2,5),std('#2f9a50'),false);st.position.y=.1;g.add(st);
  const pm=std(c,{roughness:.5});for(let i=0;i<5;i++){const a=i/5*Math.PI*2;g.add(ball(.045,pm,Math.cos(a)*.05,.21,Math.sin(a)*.05,1,.5,1));}
  g.add(ball(.035,std('#ffe14d'),0,.225,0));
  g.position.set(x,H(x,z),z);return g;
}
function rock(x,z,s){const r=mesh(new THREE.DodecahedronGeometry(.18*s,0),std('#9aa3ad',{flatShading:true}));r.position.set(x,H(x,z)+.05*s,z);r.rotation.set(x,z,0);return r;}
function cloud(x,y,z,s){const g=new THREE.Group();const m=std('#ffffff',{roughness:1,emissive:'#ffffff',emissiveIntensity:.25});
  [[0,0,0,.6],[.55,-.05,0,.45],[-.55,-.08,0,.42],[.2,.25,0,.4]].forEach(([a,b,c,r])=>g.add(ball(r,m,a,b,c)));g.children.forEach(c=>c.castShadow=false);
  g.position.set(x,y,z);g.scale.setScalar(s);return g;}

// ── O MAPA ──
let cur=null;
M.build=function(container,opts){
  M.dispose();
  const wide=opts.wide,n=opts.count;
  // posições das frutas: em tela larga o caminho vai da esquerda para a direita, em tela alta vem de perto para longe
  NODES=[];
  for(let i=0;i<n;i++){
    const k=i/(n-1);
    NODES.push(wide?[-6.4+k*12.8,(i%2?-1.5:1.6)]:[(i%2?1.55:-1.55),5.6-k*11.2]);
  }
  FLAT=NODES.map(([x,z])=>[x,z,rawH(x,z)*.5,1.6]);
  const lakeAt=wide?[2.6,4.3]:[3.7,1.1];
  FLAT.push([lakeAt[0],lakeAt[1],-.25,3.2]);        // o chão fica plano onde está o lago
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(SKY);
  scene.fog=new THREE.Fog(SKY,wide?16:18,wide?34:36);
  scene.add(new THREE.HemisphereLight('#ffffff','#7fbf6a',.75));
  const sun=new THREE.DirectionalLight('#fff3dc',1.1);sun.position.set(-6,12,8);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-16,right:16,top:16,bottom:-16,near:1,far:50});sun.shadow.bias=-.0008;
  scene.add(sun);

  // terreno com cores pintadas nos vértices (grama clara no alto, mais escura nos vales)
  const S=46,seg=150;
  const tg=new THREE.PlaneGeometry(S,S,seg,seg);tg.rotateX(-Math.PI/2);
  const pos=tg.attributes.position,cols=[];
  const c1=new THREE.Color('#5cc95e'),c2=new THREE.Color('#8fdc6a'),c3=new THREE.Color('#3fa850'),tmp=new THREE.Color();
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),z=pos.getZ(i),h=H(x,z);pos.setY(i,h);
    const t=Math.max(0,Math.min(1,(h+.6)/1.4));
    tmp.copy(c3).lerp(c1,t).lerp(c2,Math.max(0,Math.sin(x*1.3+z*.9))*.25);
    if(h>1.6)tmp.lerp(new THREE.Color('#7fb87a'),Math.min(1,(h-1.6)/3));
    cols.push(tmp.r,tmp.g,tmp.b);
  }
  tg.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));tg.computeVertexNormals();
  const ground=mesh(tg,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95,flatShading:false}),false,true);scene.add(ground);

  // lago
  const lake=mesh(new THREE.CircleGeometry(1.25,40),std('#4fb8f0',{roughness:.15,metalness:.1,transparent:true,opacity:.92}),false,true);
  lake.rotation.x=-Math.PI/2;lake.scale.set(1.15,1,1);lake.position.set(lakeAt[0],H(...lakeAt)+.06,lakeAt[1]);scene.add(lake);
  const shore=mesh(new THREE.RingGeometry(1.2,1.42,40),std('#e8d39a'),false,true);shore.rotation.x=-Math.PI/2;shore.scale.set(1.15,1,1);shore.position.copy(lake.position);shore.position.y-=.01;scene.add(shore);

  // caminho de grama clarinha (uma fita que acompanha o chão), com flores dos lados
  const pts=NODES.map(([x,z])=>new THREE.Vector3(x,0,z));
  const curve=new THREE.CatmullRomCurve3(pts,false,'catmullrom',.5);
  function ribbon(width,y,mat){
    const N=260,v=[],idx=[];
    for(let i=0;i<=N;i++){
      const t=i/N,p=curve.getPoint(t),tg2=curve.getTangent(t);
      const nx=-tg2.z,nz=tg2.x,l=Math.hypot(nx,nz)||1;
      [-1,1].forEach(s=>{const x=p.x+nx/l*width*s,z=p.z+nz/l*width*s;v.push(x,H(x,z)+y,z);});
      if(i<N){const a=i*2;idx.push(a,a+2,a+1,a+1,a+2,a+3);}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(idx);g.computeVertexNormals();
    mat.side=THREE.DoubleSide;
    return mesh(g,mat,false,false);
  }
  scene.add(ribbon(.5,.07,std('#2f9a48',{roughness:.95,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4})));
  scene.add(ribbon(.4,.1,std('#b6f08e',{roughness:.95,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-8})));
  // flores na beira do caminho
  const PET=['#ff6fa8','#ffd23f','#b57aff','#ff8a5c','#ffffff','#5ec8ff'];
  for(let k=0,N=150;k<N;k++){
    const t=(k+.5)/N,p=curve.getPoint(t),tg2=curve.getTangent(t),l=Math.hypot(tg2.x,tg2.z)||1;
    const side=k%2?1:-1,off=.5+((k*37)%10)/40;
    const x=p.x-tg2.z/l*off*side,z=p.z+tg2.x/l*off*side;
    if(NODES.some(([nx,nz])=>Math.hypot(nx-x,nz-z)<1.0))continue;
    const fl=flower(x,z,PET[(k*7)%PET.length]);fl.scale.setScalar(1.25);scene.add(fl);
  }
  // no meio do caminho, florzinhas mostram os passos: coloridas = caminho aberto, botões brancos = ainda fechado
  const stones=[];
  for(let s2=0;s2<n-1;s2++){
    for(let k=1;k<6;k++){
      const t=(s2+k/6)/(n-1),p=curve.getPoint(t),y=H(p.x,p.z)+.05;
      const on=flower(p.x,p.z,PET[(s2+k)%4]);on.position.y=y-.06;on.scale.setScalar(1.15);
      const bud=ball(.06,std('#f4f7ee',{roughness:.6}),p.x,y+.05,p.z,1,1.2,1);
      on.visible=!!opts.segOpen[s2];bud.visible=!opts.segOpen[s2];
      scene.add(on);scene.add(bud);stones.push({on,bud,seg:s2,k});
    }
  }

  // ilhas das frutas: um tablado redondo de grama com borda de terra
  const fruits=[];
  NODES.forEach(([x,z],i)=>{
    const h=H(x,z);
    const base=mesh(new THREE.CylinderGeometry(.82,.92,.22,36),std('#8a5a2b'),true,true);base.position.set(x,h+.02,z);scene.add(base);
    const top=mesh(new THREE.CylinderGeometry(.82,.82,.05,36),std(opts.done[i]?'#7fe08a':'#a6e88a',{roughness:.9}),false,true);top.position.set(x,h+.14,z);scene.add(top);
    const f=buildFruit(opts.ids[i]);f.position.set(x,h+.16,z);f.scale.setScalar(1.05);tint(f,!opts.open[i]);scene.add(f);
    fruits.push(f);
  });

  // árvores, pedras e flores longe do caminho
  const near=(x,z,r)=>{for(let k=0;k<=200;k++){const p=curve.getPoint(k/200);if(Math.hypot(p.x-x,p.z-z)<r)return true;}return Math.hypot(x-lakeAt[0],(z-lakeAt[1])*1.5)<2.2;};
  let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  const area=wide?[9,6.5]:[5.5,9];
  let placed=0;
  for(let tries=0;tries<260&&placed<34;tries++){
    const x=(rnd()*2-1)*area[0]*1.5,z=(rnd()*2-1)*area[1]*1.5;
    if(near(x,z,1.7))continue;
    scene.add(tree(x,z,.85+rnd()*.5,rnd()<.3?1:0));placed++;
  }
  const fcol=['#ff6fa8','#ffd23f','#b57aff','#ff8a5c','#ffffff','#5ec8ff'];
  for(let i=0;i<70;i++){const x=(rnd()*2-1)*area[0],z=(rnd()*2-1)*area[1];if(near(x,z,.7))continue;scene.add(flower(x,z,fcol[i%fcol.length]));}
  for(let i=0;i<10;i++){const x=(rnd()*2-1)*area[0],z=(rnd()*2-1)*area[1];if(near(x,z,.8))continue;scene.add(rock(x,z,.7+rnd()));}
  const clouds=[];
  [[-6,6.5,-9,1.4],[5,7,-11,1.8],[0,6,-6,1],[9,6.8,-4,1.2],[-9,7.4,-3,1.3]].forEach(([x,y,z,s])=>{const c=cloud(x,y,z,s);scene.add(c);clouds.push(c);});

  // câmera: inclinada, olhando o terreno de cima, ajustada ao tamanho da caixa
  const cam=new THREE.PerspectiveCamera(wide?34:40,1,.1,80);
  container.appendChild(renderer.domElement);
  const st={scene,cam,curve,fruits,stones,clouds,wide,container,t:0,pop:[]};
  function resize(){
    const W=container.clientWidth,Hh=container.clientHeight;
    renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
    renderer.setSize(W,Hh,false);
    renderer.domElement.style.width=W+'px';renderer.domElement.style.height=Hh+'px';
    cam.aspect=W/Hh;
    // afasta a câmera até caber o caminho inteiro
    const span=wide?14.6:12.6,vfov=cam.fov*Math.PI/180,hfov=2*Math.atan(Math.tan(vfov/2)*cam.aspect);
    if(wide){const d=Math.max((span/2)/Math.tan(hfov/2),5.4/Math.tan(vfov/2))*1.0;cam.position.set(0,d*.78,d*.68);cam.lookAt(0,-.2,.3);}
    else{const d=Math.max((span/2)/Math.tan(vfov/2)*.82,4.6/Math.tan(hfov/2));cam.position.set(0,d*.86,d*.55);cam.lookAt(0,0,.2);}
    const dist=cam.position.length();scene.fog.near=dist*1.05;scene.fog.far=dist*2.4;
    cam.updateProjectionMatrix();cam.updateMatrixWorld();
  }
  st.resize=resize;resize();
  cur=st;
  loop();
  return M;
};
// ponto do chão na tela (pixels dentro da caixa)
function toScreen(v){
  const p=v.clone().project(cur.cam);
  return [(p.x+1)/2*cur.container.clientWidth,(1-p.y)/2*cur.container.clientHeight];
}
M.nodeScreen=function(i,lift=.7){const [x,z]=NODES[i];return toScreen(new THREE.Vector3(x,H(x,z)+lift,z));};
M.groundScreen=function(i){return M.nodeScreen(i,.14);};
// ponto do caminho entre a fruta seg e a seguinte (u de 0 a 1), e o ponto um pouquinho à frente
// a Mimi anda um pouquinho à frente do caminho (mais perto de quem joga), para não ficar em cima da fruta
const FRONT=.75,SIDE=.95;
M.pathScreen=function(seg,u){
  const n=NODES.length,t=Math.min(1,(seg+u)/(n-1)),p=cur.curve.getPoint(t);
  return toScreen(new THREE.Vector3(p.x+SIDE,H(p.x+SIDE,p.z+FRONT)+.12,p.z+FRONT));
};
M.standScreen=function(i){const [x,z]=NODES[i];return toScreen(new THREE.Vector3(x+SIDE,H(x+SIDE,z+FRONT)+.12,z+FRONT));};
// tamanho (em pixels) da ilha de uma fruta na tela
M.nodeSize=function(i){const [x,z]=NODES[i],h=H(x,z);const a=toScreen(new THREE.Vector3(x-.82,h,z)),b=toScreen(new THREE.Vector3(x+.82,h,z));return Math.hypot(b[0]-a[0],b[1]-a[1]);};
// fruta que acabou de abrir: ganha cor e dá um pulinho; as florzinhas do caminho até ela abrem
M.open=function(i){
  if(!cur)return;
  const f=cur.fruits[i];if(f){tint(f,false);cur.pop.push({f,t:0,y:f.position.y});}
  cur.stones.forEach(s=>{if(s.seg===i-1){s.on.visible=true;s.bud.visible=false;}});
};
// a florzinha k do caminho i abre quando a Mimi pisa nela
M.bloom=function(i,k){if(cur)cur.stones.forEach(s=>{if(s.seg===i&&s.k===k){s.on.visible=true;s.bud.visible=false;}});};
M.setCalm=function(b){M.calm=b;};
function loop(){
  if(!cur)return;
  if(!cur.container.isConnected){M.dispose();return;}
  const dt=1/60;cur.t+=dt;
  if(!M.calm){
    cur.fruits.forEach((f,i)=>{f.rotation.y=Math.sin(cur.t*.8+i)*.35;});
    cur.clouds.forEach((c,i)=>{c.position.x+=dt*.25*(i%2?1:.7);if(c.position.x>14)c.position.x=-14;});
  }
  cur.pop=cur.pop.filter(p=>{p.t+=dt;const k=Math.min(1,p.t/.8);p.f.position.y=p.y+Math.sin(k*Math.PI)*.6;p.f.scale.setScalar(1.05*(1+Math.sin(k*Math.PI)*.25));return k<1;});
  if(cur.container.offsetParent!==null)renderer.render(cur.scene,cur.cam);
  cur.raf=requestAnimationFrame(loop);
}
M.resize=function(){if(cur)cur.resize();};
M.dispose=function(){
  if(!cur)return;
  cancelAnimationFrame(cur.raf);
  cur.scene.traverse(o=>{if(o.geometry&&o.geometry!==G.sph)o.geometry.dispose();if(o.material){if(o.material.map)o.material.map.dispose();o.material.dispose();}});
  if(renderer.domElement.parentNode)renderer.domElement.parentNode.removeChild(renderer.domElement);
  cur=null;
};
})();
