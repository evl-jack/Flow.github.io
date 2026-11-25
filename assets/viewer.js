import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

const root=document.querySelector('#manifold-viewer');
const palette=[new THREE.Color('#eff8f3'),new THREE.Color('#006b64'),new THREE.Color('#12304b')];
const status=(value,yes)=>yes?'<span class="pass">Pass</span>':'Outside limit';
const format=(v,n)=>Number(v).toFixed(n);
function color(value,min,max){
  const t=Math.max(0,Math.min(1,(value-min)/(max-min)));
  return t<.5?palette[0].clone().lerp(palette[1],2*t):palette[1].clone().lerp(palette[2],2*t-1);
}
function pane(model,field,domain){
  const wrapper=document.createElement('section');
  wrapper.className='pane';
  const m=model.metrics;
  wrapper.innerHTML='<h3>'+model.label+'</h3><div class="canvas" aria-label="'+model.label+' 3D fluid geometry"></div><div class="details">'+
    '<span><strong>'+format(m.power,4)+' µW/m</strong> pumping power</span>'+
    '<span>Side flow '+format(m.split,5)+'% · '+status(m.split,m.split>=49.9&&m.split<=50.1)+'</span>'+
    '<span>Nominal area '+format(m.area,5)+' mm² · '+status(m.area,m.area<=83.00000001)+'</span>'+
    '<span>Throat '+format(m.h,4)+' mm · '+status(m.h,m.h>=.15&&m.h<=4)+'</span>'+
    '<span>Shoulder '+format(m.s,4)+' mm · '+status(m.s,m.s>=0&&m.s<=1)+'</span></div>';
  const holder=wrapper.querySelector('.canvas');
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
  holder.append(renderer.domElement);
  const scene=new THREE.Scene(), camera=new THREE.OrthographicCamera(-13,13,7,-7,.1,100);
  camera.position.set(14,-17,27);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.target.set(0,0,0); controls.enablePan=false; controls.minZoom=.58; controls.maxZoom=3.5;
  controls.update();
  const pts=[],walls=[];
  const coord=(x,y,z)=>[x-10,y-3.5,z];
  const lookup=new Set(model.cells.map(c=>c[0]+','+c[1]));
  function face(out,a,b,c,d){out.push(...a,...b,...c,...a,...c,...d)}
  for(const [i,j] of model.cells){
    const [x,X]=model.x.slice(i,i+2),[y,Y]=model.y.slice(j,j+2);
    face(pts,coord(x,y,1),coord(X,y,1),coord(X,Y,1),coord(x,Y,1));
    const corners=[[x,y],[X,y],[X,Y],[x,Y]];
    [[0,-1],[1,0],[0,1],[-1,0]].forEach(([di,dj],k)=>{
      if(lookup.has((i+di)+','+(j+dj)))return;
      const a=corners[k],b=corners[(k+1)%4];
      face(walls,coord(...a,0),coord(...b,0),coord(...b,1),coord(...a,1));
    });
  }
  function mesh(points,material){
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
    const item=new THREE.Mesh(geo,material);scene.add(item);return item;
  }
  const surface=mesh(pts,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}));
  mesh(walls,new THREE.MeshBasicMaterial({color:'#274756',side:THREE.DoubleSide}));
  function repaint(key,range){
    const rgb=new Float32Array(model.cells.length*18);
    model.cells.forEach((c,n)=>{
      const v=color(c[key==='pressure'?2:3],...range);
      for(let k=0;k<6;k++)v.toArray(rgb,n*18+3*k);
    });
    surface.geometry.setAttribute('color',new THREE.BufferAttribute(rgb,3));
    draw();
  }
  function draw(){if(holder.clientWidth)renderer.render(scene,camera)}
  function resize(){
    const w=holder.clientWidth,h=holder.clientHeight, aspect=w/h;
    camera.left=-Math.max(11.5,7.5*aspect); camera.right=-camera.left;
    camera.top=camera.right/aspect;camera.bottom=-camera.top;
    camera.updateProjectionMatrix();renderer.setSize(w,h,false);draw();
  }
  new ResizeObserver(resize).observe(holder);
  const pointer=new THREE.Vector2(),ray=new THREE.Raycaster();
  function inspect(ev){
    const b=renderer.domElement.getBoundingClientRect();
    pointer.set((ev.clientX-b.left)/b.width*2-1,1-(ev.clientY-b.top)/b.height*2);
    ray.setFromCamera(pointer,camera);
    const hit=ray.intersectObject(surface)[0]; if(!hit)return;
    const n=Math.floor(hit.faceIndex/2), c=model.cells[n];
    root.querySelector('.inspection').textContent=model.label+' · cell '+(n+1)+' · p = '+format(c[2],4)+' Pa · |u| = '+format(c[3],5)+' m/s';
  }
  renderer.domElement.addEventListener('pointermove',inspect);
  renderer.domElement.addEventListener('click',inspect);
  repaint(field,domain);
  return {wrapper,controls,camera,draw,repaint};
}

try {
  const response=await fetch(root.dataset.results); if(!response.ok)throw Error('Data unavailable');
  const data=await response.json();
  root.innerHTML='<div class="tools"><label>Field <select aria-label="Displayed field"><option value="pressure">Pressure</option><option value="speed">Speed</option></select></label><button type="button" class="reset">Reset view</button></div><div class="legend"><span id="min"></span><span class="gradient"></span><span id="max"></span></div><div class="panes"></div><p class="inspection" aria-live="polite">Hover or select a colored cell to inspect pressure and speed.</p><p class="viewport-tip">Drag to orbit both models. Scroll or pinch to zoom.</p><div class="step-line"><div class="steps"><strong>Fitted geometry correction</strong><button type="button" class="play">Play</button><button type="button" class="previous" aria-label="Previous correction state">Previous</button><button type="button" class="next" aria-label="Next correction state">Next</button></div><p class="step" aria-live="polite"></p></div>';
  const select=root.querySelector('select');
  const panes=data.models.map(m=>pane(m,'pressure',data.ranges.pressure));
  panes.forEach(p=>root.querySelector('.panes').append(p.wrapper));
  for(let i=0;i<2;i++){
    panes[i].controls.saveState();
    panes[i].controls.addEventListener('change',()=>{
      const a=panes[i],b=panes[1-i];
      b.camera.position.copy(a.camera.position);b.camera.quaternion.copy(a.camera.quaternion);b.camera.zoom=a.camera.zoom;
      b.camera.updateProjectionMatrix();a.draw();b.draw();
    });
  }
  function change(){
    const key=select.value,range=data.ranges[key],units=key==='pressure'?'Pa':'m/s';
    root.querySelector('#min').textContent=format(range[0],3)+' '+units;
    root.querySelector('#max').textContent=format(range[1],3)+' '+units;
    panes.forEach(p=>p.repaint(key,range));
  }
  select.addEventListener('change',change); change();
  root.querySelector('.reset').addEventListener('click',()=>panes[0].controls.reset());
  let index=0,timer;
  const label=root.querySelector('.step'),play=root.querySelector('.play');
  const sketch=document.createElement('canvas');
  sketch.width=640; sketch.height=224;
  sketch.style.cssText='display:block;width:min(100%,420px);height:auto;margin:.55rem 0';
  sketch.setAttribute('aria-label','Plan view of the geometry at the selected correction step');
  label.before(sketch);
  function drawStep({h,s}){
    const ctx=sketch.getContext('2d'), scale=30;
    const outline=[[0,0],[20,0],[20,4],[14,4],[14,h],[13,h],[13,4],[10.5+s,4],
      [10.5+s,6],[10.5,6],[10.5,7],[9.5,7],[9.5,6],[9.5-s,6],[9.5-s,4],[0,4]];
    ctx.clearRect(0,0,640,224);
    ctx.beginPath();
    outline.forEach(([x,y],i)=>ctx[i?'lineTo':'moveTo'](20+scale*x,217-scale*y));
    ctx.closePath();ctx.fillStyle='#a3d8d3';ctx.fill();ctx.lineWidth=2.5;ctx.strokeStyle='#006b64';ctx.stroke();
  }
  function display(){
    const s=data.correction[index];drawStep(s);
    label.textContent=s.label+' · Throat '+format(s.h,4)+' mm · shoulder '+format(s.s,4)+' mm · side flow '+format(s.split,4)+'% · '+format(s.power,4)+' µW/m. '+s.note;
  }
  function stop(){clearInterval(timer);timer=undefined;play.textContent='Play'}
  function move(i){index=(i+data.correction.length)%data.correction.length;display()}
  root.querySelector('.previous').onclick=()=>{stop();move(index-1)};
  root.querySelector('.next').onclick=()=>{stop();move(index+1)};
  play.onclick=()=>{if(timer){stop();return} move(0);play.textContent='Pause';timer=setInterval(()=>{if(index===data.correction.length-1){stop();return}move(index+1)},1650)};
  display();
} catch(error) {
  root.textContent='The interactive view could not load. The report below includes the archived flow-field comparison.';
  console.warn(error);
}
