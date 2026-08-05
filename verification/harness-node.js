// Replicates the 10 frozen harness checks from index.html verbatim, run in Node.
const {candidate}=require('./candidate-core.js');
const close=(a,b,e=1e-9)=>Number.isFinite(a)&&Math.abs(a-b)<=e;
const cclose=(a,b,e=1e-8)=>a&&close(a.re,b.re,e)&&close(a.im,b.im,e);
const polyFromRoots=roots=>roots.reduce((cs,r)=>{const out=Array(cs.length+1).fill(0).map(()=>({re:0,im:0}));cs.forEach((v,i)=>{out[i]=candidate.add(out[i],v);out[i+1]=candidate.sub(out[i+1],candidate.mul(v,r))});return out},[{re:1,im:0}]);
const checks=[
  ['complex arithmetic',10,()=>cclose(candidate.div(candidate.mul({re:3,im:-4},{re:-2,im:5}),{re:-2,im:5}),{re:3,im:-4},1e-10)],
  ['Horner derivative',10,()=>{const q=candidate.polyAndDerivative([{re:1,im:0},{re:0,im:0},{re:-1,im:0}],{re:2,im:1});return cclose(q.value,{re:2,im:4})&&cclose(q.derivative,{re:4,im:2})}],
  ['roots: unity degree 7',12,()=>{const cs=[{re:1,im:0},...Array(6).fill(0).map(()=>({re:0,im:0})),{re:-1,im:0}],rs=candidate.aberth(cs,{tolerance:1e-11,maxIterations:700});return rs.length===7&&rs.every(r=>candidate.abs(candidate.polyAndDerivative(cs,r).value)<1e-7)}],
  ['roots: complex coefficients',12,()=>{const roots=[{re:1,im:2},{re:-.5,im:.2},{re:2,im:-1}],cs=polyFromRoots(roots),rs=candidate.aberth(cs,{tolerance:1e-11,maxIterations:600});return roots.every(a=>rs.some(b=>candidate.abs(candidate.sub(a,b))<1e-6))}],
  ['roots: near cluster',12,()=>{const roots=[{re:1,im:0},{re:1.0002,im:.0001},{re:-2,im:0}],cs=polyFromRoots(roots),rs=candidate.aberth(cs,{tolerance:1e-12,maxIterations:1400});return roots.every(a=>rs.some(b=>candidate.abs(candidate.sub(a,b))<8e-5))}],
  ['RK45 convergence',12,()=>{const cs=[{re:1,im:0},{re:0,im:0},{re:-1,im:0}],r=candidate.rk45NewtonFlow(cs,{re:2.4,im:.8},{atol:1e-9,rtol:1e-8,tMax:20,hInitial:.08});const z=r.points.at(-1).z;return r.reason==='root'&&candidate.abs(candidate.sub(z,{re:1,im:0}))<2e-5&&r.accepted>2}],
  ['RK45 rejection path',8,()=>{const cs=[{re:1,im:0},{re:0,im:0},{re:0,im:0},{re:-1,im:0}],r=candidate.rk45NewtonFlow(cs,{re:.01,im:.01},{atol:1e-12,rtol:1e-11,tMax:4,hInitial:1.5});return r.rejected>0&&r.points.every(p=>Number.isFinite(p.z.re+p.z.im+p.t))}],
  ['normalized entropy',8,()=>{const g={width:4,height:2,labels:Int32Array.from([0,0,1,1,0,0,1,-1])};return close(candidate.basinEntropy(g),.985228136,1e-6)}],
  ['box dimension',8,()=>{const n=32,a=new Int32Array(n*n);for(let y=0;y<n;y++)for(let x=0;x<n;x++)a[y*n+x]=x<y?0:1;const r=candidate.boxDimension({width:n,height:n,labels:a},{sizes:[1,2,4,8]});return r.counts.length===4&&r.dimension>.8&&r.dimension<1.2}],
  ['marching squares',8,()=>{const g={width:3,height:3,labels:Int32Array.from([0,0,1,0,1,1,0,0,1])},s=candidate.marchingSquares(g);const keys=new Set(s.map(v=>JSON.stringify(v)));return s.length>=3&&keys.size===s.length&&s.flat(2).every(Number.isFinite)}]
];
(async()=>{
  let total=0;
  for(const [name,pts,fn] of checks){
    const t0=process.hrtime.bigint();
    let ok=false,err='';
    try{ok=await Promise.race([Promise.resolve().then(fn),new Promise((_,r)=>setTimeout(()=>r(Error('timeout')),2500))]);}
    catch(e){err=String(e&&e.message||e);}
    const ms=Number(process.hrtime.bigint()-t0)/1e6;
    if(ok)total+=pts;
    console.log(`${ok?'PASS':'FAIL'}  ${name.padEnd(28)} ${ok?pts:0}/${pts}  ${ms.toFixed(1)}ms ${err}`);
  }
  console.log(`\nTOTAL ${total}/100`);
  // Extra diagnostics
  const cs=[{re:1,im:0},{re:0,im:0},{re:-1,im:0}];
  const r=candidate.rk45NewtonFlow(cs,{re:2.4,im:.8},{atol:1e-9,rtol:1e-8,tMax:20,hInitial:.08});
  console.log('rk45 conv:',r.reason,'accepted',r.accepted,'rejected',r.rejected,'endpoint',JSON.stringify(r.points.at(-1)));
  const r2=candidate.rk45NewtonFlow([{re:1,im:0},{re:0,im:0},{re:0,im:0},{re:-1,im:0}],{re:.01,im:.01},{atol:1e-12,rtol:1e-11,tMax:4,hInitial:1.5});
  console.log('rk45 rej:',r2.reason,'accepted',r2.accepted,'rejected',r2.rejected,'pts',r2.points.length);
})();
