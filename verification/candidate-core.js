// RN-ATLAS-12 · seed 0x48E24A91 — candidate numerical core.
// Complex numbers are plain objects { re:Number, im:Number }; all ops return fresh objects.

const cAdd=(a,b)=>({re:a.re+b.re,im:a.im+b.im});
const cSub=(a,b)=>({re:a.re-b.re,im:a.im-b.im});
const cMul=(a,b)=>({re:a.re*b.re-a.im*b.im,im:a.re*b.im+a.im*b.re});
const cScale=(a,s)=>({re:a.re*s,im:a.im*s});
const cAbs2=a=>a.re*a.re+a.im*a.im;
const cAbs=a=>Math.hypot(a.re,a.im);
const cArg=a=>Math.atan2(a.im,a.re);
function cDiv(a,b){
  const br=b.re,bi=b.im;
  if(br===0&&bi===0)return {re:NaN,im:NaN};
  // Smith's scaled division: no overflow/underflow of intermediate products.
  if(Math.abs(br)>=Math.abs(bi)){const r=bi/br,d=br+bi*r;return {re:(a.re+a.im*r)/d,im:(a.im-a.re*r)/d};}
  const r=br/bi,d=bi+br*r;return {re:(a.re*r+a.im)/d,im:(a.im*r-a.re)/d};
}
function cLog(a){return {re:Math.log(cAbs(a)),im:cArg(a)};}
function cExp(a){const r=Math.exp(a.re);return {re:r*Math.cos(a.im),im:r*Math.sin(a.im)};}
function cSqrt(a){ // principal square root, branch-safe
  const x=a.re,y=a.im;
  if(x===0&&y===0)return {re:0,im:0};
  const t=Math.sqrt((Math.abs(x)+cAbs(a))/2);
  return x>=0?{re:t,im:y/(2*t)}:{re:Math.abs(y)/(2*t),im:y>=0?t:-t};
}

// Highest-power-first Horner: value and derivative in one fused pass.
function polyAndDerivative(coeffs,z){
  const n=coeffs.length;
  let v={re:0,im:0},d={re:0,im:0};
  for(let i=0;i<n;i++){
    d=cAdd(cMul(d,z),v);
    v=cAdd(cMul(v,z),coeffs[i]);
  }
  return {value:v,derivative:d};
}
function newtonStep(coeffs,z){
  const {value,derivative}=polyAndDerivative(coeffs,z);
  if(cAbs2(derivative)<1e-300)return null;
  return cSub(z,cDiv(value,derivative));
}
function derivativeCoeffs(coeffs){
  const deg=coeffs.length-1,out=[];
  for(let i=0;i<deg;i++)out.push(cScale(coeffs[i],deg-i));
  return out;
}

// ---------------- Aberth–Ehrlich simultaneous root finder ----------------
function aberth(coeffs,options={}){
  const tol=options.tolerance??1e-12;
  const maxIterations=options.maxIterations??2000;
  const cs=[];let start=0;
  while(start<coeffs.length-1&&cAbs2(coeffs[start])===0)start++; // strip leading zeros
  for(let i=start;i<coeffs.length;i++)cs.push({re:coeffs[i].re,im:coeffs[i].im});
  const n=cs.length-1;
  if(n<=0)return [];
  if(n===1)return [cDiv(cs[1],cScale(cs[0],-1))];
  if(n===2){ // quadratic: cancellation-safe via Vieta, then polish.
    const [a,b,c]=cs;
    const D=cSqrt(cSub(cMul(b,b),cScale(cMul(a,c),4)));
    const q1=cScale(cAdd(b,D),-.5),q2=cScale(cSub(b,D),-.5);
    const q=cAbs2(q1)>=cAbs2(q2)?q1:q2;      // larger-magnitude branch avoids cancellation
    let r1=cDiv(q,a);
    let r2=cAbs2(q)<1e-300?{re:0,im:0}:cDiv(c,q); // r1*r2 = c/a
    for(const r of [r1,r2])for(let k=0;k<4;k++){const ns=newtonStep(cs,r);if(ns)Object.assign(r,ns);}
    return [r1,r2];
  }
  // Cauchy bound for the initial shell radius.
  const la=cAbs(cs[0]);let rho=0;
  for(let i=1;i<=n;i++)rho=Math.max(rho,cAbs(cs[i])/la);
  const R=Math.min(Math.max(rho,1e-150),1e150);
  const GA=2.399963229728653; // golden angle: low-discrepancy spread
  const z=[];
  for(let k=0;k<n;k++){
    const rr=R*(0.5+0.5*((k*0.6180339887498949)%1));
    const th=k*GA+0.7;
    z.push({re:rr*Math.cos(th),im:rr*Math.sin(th)});
  }
  // Simultaneous iteration with Weierstrass correction (handles clusters & multiplicities).
  let iter=0;
  for(;iter<maxIterations;iter++){
    let maxCorr=0;
    const corr=new Array(n);
    for(let i=0;i<n;i++){
      const {value:p,derivative:pp}=polyAndDerivative(cs,z[i]);
      let w;
      if(cAbs2(p)===0||cAbs2(pp)<1e-300)w={re:0,im:0};
      else{
        w=cDiv(p,pp);
        let sum={re:0,im:0};
        for(let j=0;j<n;j++){
          if(j===i)continue;
          const d=cSub(z[i],z[j]);
          if(cAbs2(d)<1e-300){sum={re:1e30,im:0};continue;} // coincident guess: shove apart
          sum=cAdd(sum,cDiv({re:1,im:0},d));
        }
        const den=cSub({re:1,im:0},cMul(w,sum));
        if(cAbs2(den)<1e-300)w=cScale(w,1e-4); // near-pole: damped step, stay finite
        else w=cDiv(w,den);
      }
      corr[i]=w;
      maxCorr=Math.max(maxCorr,cAbs(w));
    }
    for(let i=0;i<n;i++)z[i]=cSub(z[i],corr[i]);
    if(maxCorr<=tol*Math.max(R,1))break;
  }
  // Residual polish: short plain-Newton refinement at each converged guess.
  for(let i=0;i<n;i++){
    let zi=z[i];
    for(let k=0;k<8;k++){
      const nz=newtonStep(cs,zi);
      if(nz===null)break;
      const move=cAbs(cSub(nz,zi));
      zi=nz;
      if(move<=tol*Math.max(1,cAbs(zi)))break;
    }
    if(Number.isFinite(zi.re)&&Number.isFinite(zi.im))z[i]=zi;
  }
  return z;
}

// ---------------- Dormand–Prince RK45 Newton-flow integrator ----------------
const DP={
  a2:[1/5],a3:[3/40,9/40],a4:[44/45,-56/15,32/9],
  a5:[19372/6561,-25360/2187,64448/6561,-212/729],
  a6:[9017/3168,-355/33,46732/5247,49/176,-5103/18656],
  b:[35/384,0,500/1113,125/192,-2187/6784,11/84,0],
  bs:[5179/57600,0,7571/16695,393/640,-92097/339200,187/2100,1/40]
};
function rk45NewtonFlow(coeffs,z0,options={}){
  const atol=options.atol??1e-10,rtol=options.rtol??1e-9;
  const tMax=options.tMax??64;
  let h=options.hInitial??0.1;
  const hMin=options.hMin??1e-11,hMax=options.hMax??4;
  const maxSteps=options.maxSteps??400000;
  // Root terminal: scale-invariant Newton-step-length test (|p/p'| has units of z).
  const rootTol=options.rootTol??Math.max(1e-7,atol*10);
  const points=[{z:{re:z0.re,im:z0.im},t:0}];
  let accepted=0,rejected=0;
  let t=0,z={re:z0.re,im:z0.im};
  // Critical points once, up front (cheap for the degrees in scope).
  const crits=coeffs.length>2?aberth(derivativeCoeffs(coeffs),{tolerance:1e-8,maxIterations:300}):[];
  const distCrit=zz=>{let d=Infinity;for(const cr of crits)d=Math.min(d,cAbs(cSub(zz,cr)));return d;};
  const f=zz=>{
    const {value:p,derivative:pp}=polyAndDerivative(coeffs,zz);
    if(cAbs2(pp)<1e-300)return null;
    return cDiv(cScale(p,-1),pp);
  };
  const isRoot=zz=>{
    const {value:p,derivative:pp}=polyAndDerivative(coeffs,zz);
    const stepLen=cAbs2(pp)<1e-300?Infinity:cAbs(cDiv(p,pp));
    return stepLen<=rootTol*Math.max(1,cAbs(zz));
  };

  let reason='tMax';
  if(!Number.isFinite(h)||h<=0)h=0.1;
  h=Math.min(Math.max(h,hMin),hMax);
  if(isRoot(z))reason='root';

  for(let step=0;step<maxSteps&&reason==='tMax';step++){
    if(t>=tMax)break;
    h=Math.min(h,tMax-t);
    if(h<hMin){reason='stepUnderflow';break;}

    const pd=polyAndDerivative(coeffs,z);
    if(cAbs2(pd.derivative)<1e-300){reason='singular';break;}
    const stepLen=cAbs(cDiv(pd.value,pd.derivative));
    if(!Number.isFinite(stepLen)||stepLen>1e8){reason='singular';break;}

    // Build the 7 stages.
    const k=new Array(7);
    let bad=false;
    k[0]=f(z);if(!k[0])bad=true;
    const A=[DP.a2,DP.a3,DP.a4,DP.a5,DP.a6];
    for(let s=1;s<=5&&!bad;s++){
      let acc={re:0,im:0};
      for(let j=0;j<s;j++)if(A[s-1][j])acc=cAdd(acc,cScale(k[j],A[s-1][j]));
      const kz=f(cAdd(z,cScale(acc,h)));
      if(!kz){bad=true;break;}
      k[s]=kz;
    }
    if(!bad){
      let a5={re:0,im:0},a4={re:0,im:0};
      for(let j=0;j<6;j++)if(DP.b[j])a5=cAdd(a5,cScale(k[j],DP.b[j]));
      const y5=cAdd(z,cScale(a5,h));
      k[6]=f(y5);
      if(!k[6])bad=true;
      else{
        for(let j=0;j<7;j++)if(DP.bs[j])a4=cAdd(a4,cScale(k[j],DP.bs[j]));
        const y4=cAdd(z,cScale(a4,h));
        const errV=cScale(cSub(y5,y4),1/h);
        let sc=atol+rtol*Math.max(cAbs(z),cAbs(y5));
        // Tighten near critical points so steps stay inside the smooth regime.
        const dc=distCrit(y5);
        if(Number.isFinite(dc))sc=Math.min(sc,Math.max(atol,dc*1e-3));
        const e=cAbs(errV)/sc;
        if(!Number.isFinite(e)||e>1){
          rejected++;
          const fac=e>1e-12?0.9*Math.pow(e,-0.2):0.2;
          h=Math.max(h*Math.min(Math.max(fac,0.2),0.9),hMin*0.5);
          if(h<=hMin){points.push({z:{re:y5.re,im:y5.im},t:t+h});reason='stepUnderflow';break;}
          continue;
        }
        accepted++;t+=h;z=y5;
        points.push({z:{re:y5.re,im:y5.im},t});
        if(!Number.isFinite(z.re)||!Number.isFinite(z.im)){reason='singular';break;}
        if(isRoot(z)){
          // Polish the endpoint with a few Newton steps for a tight landing.
          let zp=z;
          for(let kk=0;kk<4;kk++){const ns=newtonStep(coeffs,zp);if(!ns)break;zp=ns;}
          if(Number.isFinite(zp.re)&&Number.isFinite(zp.im)){z=zp;points[points.length-1].z={re:zp.re,im:zp.im};}
          reason='root';break;
        }
        const fac=e>1e-15?0.9*Math.pow(e,-0.2):5;
        h=Math.min(Math.max(h*Math.min(Math.max(fac,0.2),5),hMin),hMax);
      }
    }
    if(bad){rejected++;h*=0.5;if(h<hMin){reason='stepUnderflow';break;}}
  }
  return {points,accepted,rejected,reason};
}

// ---------------- Basin statistics ----------------
function basinEntropy(grid){
  const counts=new Map();let total=0;
  for(let i=0;i<grid.labels.length;i++){
    const v=grid.labels[i];
    if(v===-1||v===undefined)continue;
    counts.set(v,(counts.get(v)||0)+1);total++;
  }
  if(total===0||counts.size<=1)return 0;
  let H=0;const lnK=Math.log(counts.size);
  for(const c of counts.values()){const p=c/total;H-=p*Math.log(p);}
  return H/lnK;
}
function boxDimension(grid,options={}){
  const sizes=options.sizes&&options.sizes.length?options.sizes.slice():[2,4,8,16];
  const counts=[];const xs=[],ys=[];
  for(const s of sizes){
    const gw=Math.ceil(grid.width/s),gh=Math.ceil(grid.height/s);
    let count=0;
    for(let by=0;by<gh;by++)for(let bx=0;bx<gw;bx++){
      const x0=bx*s,x1=Math.min(x0+s,grid.width);
      const y0=by*s,y1=Math.min(y0+s,grid.height);
      let first=-2,mixed=false;
      for(let y=y0;y<y1&&!mixed;y++)for(let x=x0;x<x1;x++){
        const v=grid.labels[y*grid.width+x];
        if(v===-1)continue;
        if(first===-2)first=v;else if(v!==first){mixed=true;break;}
      }
      if(mixed)count++;
    }
    counts.push(count);
    if(count>0){xs.push(Math.log(1/s));ys.push(Math.log(count));}
  }
  let dimension=0;
  if(xs.length>=2){
    const n=xs.length;
    const mx=xs.reduce((a,b)=>a+b,0)/n,my=ys.reduce((a,b)=>a+b,0)/n;
    let num=0,den=0;
    for(let i=0;i<n;i++){num+=(xs[i]-mx)*(ys[i]-my);den+=(xs[i]-mx)**2;}
    dimension=den===0?0:num/den;
  }
  return {dimension,counts};
}

// ---------------- Marching squares (edge-change form, saddle-safe) ----------------
function marchingSquares(grid){
  const W=grid.width,H=grid.height,L=grid.labels,segs=[];
  if(W<2||H<2)return segs;
  for(let y=0;y<H-1;y++)for(let x=0;x<W-1;x++){
    const tl=L[y*W+x],tr=L[y*W+x+1],bl=L[(y+1)*W+x],br=L[(y+1)*W+x+1];
    if(tl===-1||tr===-1||bl===-1||br===-1)continue;
    const eT=tl!==tr,eR=tr!==br,eB=bl!==br,eL=tl!==bl;
    const edges=[];
    if(eT)edges.push('T');if(eR)edges.push('R');if(eB)edges.push('B');if(eL)edges.push('L');
    if(edges.length===0)continue;
    const pt={T:[x+0.5,y],R:[x+1,y+0.5],B:[x+0.5,y+1],L:[x,y+0.5]};
    if(edges.length===2){
      segs.push([pt[edges[0]],pt[edges[1]]]);
    }else if(edges.length===4){
      // Saddle (checkerboard): deterministic resolution — segments hug the
      // tr/bl corners, pairing (T,R) and (L,B). No NaN, no duplicates.
      segs.push([pt.T,pt.R]);
      segs.push([pt.L,pt.B]);
    }
    // edges.length of 1 or 3 cannot occur around a 4-cycle.
  }
  const seen=new Set(),out=[];
  for(const s of segs){
    const k=s[0][0]+','+s[0][1]+';'+s[1][0]+','+s[1][1];
    const kr=s[1][0]+','+s[1][1]+';'+s[0][0]+','+s[0][1];
    if(seen.has(k)||seen.has(kr))continue;
    seen.add(k);out.push(s);
  }
  return out;
}

const candidate={
  add:cAdd,sub:cSub,mul:cMul,div:cDiv,abs:cAbs,
  polyAndDerivative,aberth,rk45NewtonFlow,basinEntropy,boxDimension,marchingSquares
};
if(typeof module!=='undefined')module.exports={candidate};
