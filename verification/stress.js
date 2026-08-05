// Robustness stress: hidden tests change degree, coefficient scale, multiplicity, call order.
const {candidate}=require('./candidate-core.js');
let pass=0,fail=0;
const rep=(name,ok,detail='')=>{if(ok)pass++;else{fail++;console.log('FAIL',name,detail);}};

// 1) degrees 3..12, random complex roots
function randPoly(roots){
  let cs=[{re:1,im:0}];
  for(const r of roots){
    const out=new Array(cs.length+1).fill(null).map(()=>({re:0,im:0}));
    cs.forEach((v,i)=>{
      out[i]={re:out[i].re+v.re,im:out[i].im+v.im};
      const m=candidate.mul(v,r);
      out[i+1]={re:out[i+1].re-m.re,im:out[i+1].im-m.im};
    });
    cs=out;
  }
  return cs;
}
let seed=48271;const rnd=()=>((seed=(seed*48271)%2147483647)/2147483647);
for(let deg=3;deg<=12;deg++){
  for(let trial=0;trial<3;trial++){
    const roots=[];for(let i=0;i<deg;i++)roots.push({re:(rnd()-.5)*4,im:(rnd()-.5)*4});
    const cs=randPoly(roots);
    const rs=candidate.aberth(cs,{tolerance:1e-10,maxIterations:2000});
    const ok=roots.every(a=>rs.some(b=>candidate.abs(candidate.sub(a,b))<1e-5));
    rep(`deg${deg} trial${trial}`,ok,ok?'':JSON.stringify({roots:roots.map(r=>r.re.toFixed(2)+'+'+r.im.toFixed(2)+'i')}));
  }
}
// 2) scaled coefficients (hidden tests change coefficient scale)
for(const s of [1e-6,1e-3,1,1e3,1e6,1e9]){
  const roots=[{re:1,im:0},{re:-1,im:1},{re:0,im:-2},{re:.5,im:.5}];
  const cs=randPoly(roots).map(c=>candidate.mul(c,{re:s,im:0}));
  const rs=candidate.aberth(cs,{tolerance:1e-10,maxIterations:2000});
  const ok=roots.every(a=>rs.some(b=>candidate.abs(candidate.sub(a,b))<1e-5));
  rep(`scale ${s}`,ok);
}
// 3) multiplicities (hidden tests change root multiplicity)
for(const m of [2,3,4]){
  const cs=randPoly([{re:1,im:0},...Array(m-1).fill({re:1,im:0}),{re:-2,im:.5}]);
  const rs=candidate.aberth(cs,{tolerance:1e-9,maxIterations:3000});
  const res=rs.map(r=>candidate.abs(candidate.polyAndDerivative(cs,r).value));
  const nearRoot=rs.filter(r=>candidate.abs(candidate.sub(r,{re:1,im:0}))<0.05).length;
  rep(`mult ${m}`,rs.length===m+1&&nearRoot>=Math.max(1,m-1)&&res.every(v=>v<1e-3),JSON.stringify({res,nearRoot}));
}
// 4) RK45: basin classification sanity — z^3-1 from many starts lands on a root
{
  const cs=[{re:1,im:0},{re:0,im:0},{re:0,im:0},{re:-1,im:0}];
  let rootsFound=0,finite=0;
  for(let i=0;i<24;i++){
    const a=i/24*2*Math.PI,rr=0.6+((i*7)%5)*0.3;
    const r=candidate.rk45NewtonFlow(cs,{re:rr*Math.cos(a),im:rr*Math.sin(a)},{atol:1e-9,rtol:1e-8,tMax:40,hInitial:.2});
    const z=r.points.at(-1).z;
    if(Number.isFinite(z.re+z.im))finite++;
    if(r.reason==='root'&&candidate.abs(candidate.polyAndDerivative(cs,z).value)<1e-6)rootsFound++;
  }
  rep('rk45 basin 24 starts',rootsFound>=20&&finite===24,`roots ${rootsFound}/24 finite ${finite}/24`);
}
// 5) RK45 singular start exactly at critical point z=0 of z^3-1
{
  const cs=[{re:1,im:0},{re:0,im:0},{re:0,im:0},{re:-1,im:0}];
  const r=candidate.rk45NewtonFlow(cs,{re:0,im:0},{atol:1e-9,rtol:1e-8,tMax:10,hInitial:.1});
  rep('rk45 at critical point',r.reason==='singular'&&r.points.every(p=>Number.isFinite(p.z.re+p.z.im+p.t)),r.reason);
}
// 6) determinism: same input twice -> identical output
{
  const cs=[{re:1,im:0},{re:0,im:0},{re:0,im:0},{re:0,im:0},{re:-1,im:0}];
  const a=JSON.stringify(candidate.aberth(cs,{tolerance:1e-11,maxIterations:800}));
  const b=JSON.stringify(candidate.aberth(cs,{tolerance:1e-11,maxIterations:800}));
  rep('aberth deterministic',a===b);
  const r1=JSON.stringify(candidate.rk45NewtonFlow(cs,{re:.7,im:.3},{atol:1e-9,rtol:1e-8,tMax:12,hInitial:.15}));
  const r2=JSON.stringify(candidate.rk45NewtonFlow(cs,{re:.7,im:.3},{atol:1e-9,rtol:1e-8,tMax:12,hInitial:.15}));
  rep('rk45 deterministic',r1===r2);
}
// 7) entropy extremes + all-unclassified
rep('entropy uniform',candidate.basinEntropy({width:2,height:2,labels:Int32Array.from([3,3,3,3])})===0);
rep('entropy empty',candidate.basinEntropy({width:2,height:2,labels:Int32Array.from([-1,-1,-1,-1])})===0);
rep('entropy max',Math.abs(candidate.basinEntropy({width:2,height:2,labels:Int32Array.from([0,1,2,3])})-1)<1e-12);
// 8) marching squares: uniform grid -> no segments; saddle grid -> finite segs
rep('ms uniform',candidate.marchingSquares({width:3,height:3,labels:new Int32Array(9)}).length===0);
{
  const g={width:3,height:3,labels:Int32Array.from([0,1,0,1,0,1,0,1,0])}; // checkerboard saddles
  const s=candidate.marchingSquares(g);
  rep('ms saddle',s.length===8&&s.flat(2).every(Number.isFinite),'got '+s.length); // 4 saddle cells × 2 segs
}
console.log(`\nSTRESS: ${pass} pass, ${fail} fail`);
