/* Portable synchronous SHA-256 for deterministic browser save format parity.
 * No network calls, no key derivation, no cryptographic authentication claims.
 * Verified against Node's node:crypto in tests/browser-native-session-v367.test.js.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargameSyncSha256=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const K=[
 0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
 0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
 0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
 0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
 0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
 0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
 0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
 0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
];
const rotr=(v,n)=>(v>>>n)|(v<<(32-n));
function sha256(value){
 const src=new TextEncoder().encode(String(value));
 if(src.length>0x1fffffff)throw Error('Save input too long');
 const len=Math.ceil((src.length+9)/64)*64;
 const padded=new Uint8Array(len);padded.set(src);padded[src.length]=0x80;
 const view=new DataView(padded.buffer);
 const bits=src.length*8;view.setUint32(len-8,Math.floor(bits/4294967296),false);view.setUint32(len-4,bits>>>0,false);
 const h=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
 const w=new Uint32Array(64);
 for(let i=0;i<len;i+=64){
  for(let j=0;j<16;j++)w[j]=view.getUint32(i+j*4,false);
  for(let j=16;j<64;j++){
   const x=w[j-15],y=w[j-2],s0=rotr(x,7)^rotr(x,18)^(x>>>3),s1=rotr(y,17)^rotr(y,19)^(y>>>10);
   w[j]=(w[j-16]+s0+w[j-7]+s1)>>>0;
  }
  let [a,b,c,d,e,f,g,q]=h;
  for(let j=0;j<64;j++){
   const s1=rotr(e,6)^rotr(e,11)^rotr(e,25),ch=(e&f)^(~e&g);
   const t1=(q+s1+ch+K[j]+w[j])>>>0;
   const s0=rotr(a,2)^rotr(a,13)^rotr(a,22),maj=(a&b)^(a&c)^(b&c);
   const t2=(s0+maj)>>>0;
   q=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
  }
  const z=[a,b,c,d,e,f,g,q];for(let j=0;j<8;j++)h[j]=(h[j]+z[j])>>>0;
 }
 return Array.from(h,x=>x.toString(16).padStart(8,'0')).join('');
}
// Ordinary JSON byte contract: insertion order and JSON.stringify semantics.
 // Not the stricter canonical serializer used for campaign receipts.
function jsonChecksum(value){
 const text=JSON.stringify(value);
 if(typeof module==='object'&&module.exports)return require('node:crypto').createHash('sha256').update(text).digest('hex');
 return sha256(text);
}
return {sha256,jsonChecksum};
});
