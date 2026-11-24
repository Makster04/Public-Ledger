// Plain text from a PDF, for the trade reports members file electronically with the House Clerk. It needs no library:
// it opens every stream (inflating FlateDecode, and unpacking object streams), maps each font's character codes
// through the font's ToUnicode table when it has one, and writes text in the order it is drawn, starting a new line when
// the text moves down the page. A scanned (paper) filing has no text and gives ''.
const latin1=b=>new TextDecoder('latin1').decode(b);

// A stream inflated, or null when it doesn't inflate or would pass `cap` bytes (a large picture, or a compression bomb).
export const STREAM_CAP=16e6;
// The most one PDF's streams may inflate to in all (a long scanned report's pages), so one file can't use up memory.
export const PDF_CAP=64e6;
// Under Node (npm start), its zlib inflates, with the wider window the House Clerk's newer reports need (below);
// DecompressionStream takes the window from the header and stops partway through them. Elsewhere (a Worker),
// DecompressionStream does, and a stream it stops partway keeps what it gave, so those reports are read in part there.
let nodeZlib;
const zlibOf=async()=>nodeZlib!==undefined?nodeZlib:(nodeZlib=await import('node:zlib').catch(()=>null));
async function inflate(bytes,cap=STREAM_CAP){
  const z=await zlibOf();
  // The House Clerk's newer streams declare a 1 KB window in their header (58 47) but reach further back, so the window
  // is set to the largest (32 KB) rather than taken from the header; without it they fail "invalid distance too far back".
  if(z){try{const out=z.inflateSync(bytes,{maxOutputLength:cap,windowBits:15,chunkSize:1<<20});return new Uint8Array(out.buffer,out.byteOffset,out.length);}catch{return null;}}
  const parts=[];let n=0;
  const joined=()=>{const out=new Uint8Array(n);let o=0;for(const x of parts){out.set(x,o);o+=x.length;}return out;};
  try{
    const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
    for(;;){const {done,value}=await reader.read();if(done)break;n+=value.length;if(n>cap){await reader.cancel().catch(()=>{});return null;}parts.push(value);}
    return joined();
  }catch{return n>0?joined():null;}
}
// Streams that never hold text, so they're never inflated: pictures, embedded font programs, metadata, cross-reference
// tables and attached files. Text is drawn by content streams (a page's, or a form's) through fonts' ToUnicode tables.
export const NOT_TEXT=/\/Subtype\s*\/(Image|Type1C|CIDFontType0C|OpenType)\b|\/Type\s*\/(Metadata|XRef|EmbeddedFile)\b|\/Length[123]\s/;
// ---------- Encrypted PDFs (the PDF standard's "Standard" security handler, blank user password) ----------
// The House Clerk's e-filed reports since 2025 are encrypted with no password to open them (any reader opens them; the
// encryption only carries the author's permissions). Their streams are read the same way a reader opens them: RC4 (40
// to 128 bits, revisions 2 and 3) or AES-128 (revision 4, AESV2), with the key made from the blank password. A file that
// needs a real password, or uses AES-256 (revisions 5 and 6), isn't read and gives '' as before.
const PAD=[0x28,0xbf,0x4e,0x5e,0x4e,0x75,0x8a,0x41,0x64,0x00,0x4e,0x56,0xff,0xfa,0x01,0x08,0x2e,0x2e,0x00,0xb6,0xd0,0x68,0x3e,0x80,0x2f,0x0c,0xa9,0xfe,0x64,0x53,0x69,0x7a];
// MD5, which the key needs (not in Web Crypto).
export function md5(bytes){
  const K=new Uint32Array(64),S=[7,12,17,22,5,9,14,20,4,11,16,23,6,10,15,21];for(let i=0;i<64;i++)K[i]=Math.floor(Math.abs(Math.sin(i+1))*2**32)>>>0;
  const len=bytes.length,n=((len+8>>>6)+1)*64,m=new Uint8Array(n);m.set(bytes);m[len]=0x80;
  const bits=len*8;for(let i=0;i<8;i++)m[n-8+i]=Math.floor(bits/2**(8*i))&255;
  let a0=0x67452301,b0=0xefcdab89,c0=0x98badcfe,d0=0x10325476;const w=new Uint32Array(16),rotl=(x,c)=>(x<<c)|(x>>>(32-c));
  for(let o=0;o<n;o+=64){
    for(let i=0;i<16;i++)w[i]=m[o+4*i]|m[o+4*i+1]<<8|m[o+4*i+2]<<16|m[o+4*i+3]<<24;
    let a=a0,b=b0,c=c0,d=d0;
    for(let i=0;i<64;i++){let f,g;
      if(i<16){f=(b&c)|(~b&d);g=i;}else if(i<32){f=(d&b)|(~d&c);g=(5*i+1)%16;}else if(i<48){f=b^c^d;g=(3*i+5)%16;}else{f=c^(b|~d);g=(7*i)%16;}
      const t=d;d=c;c=b;b=(b+rotl((a+f+K[i]+w[g])>>>0,S[(i>>4)*4+(i%4)]))>>>0;a=t;}
    a0=(a0+a)>>>0;b0=(b0+b)>>>0;c0=(c0+c)>>>0;d0=(d0+d)>>>0;
  }
  const out=new Uint8Array(16);[a0,b0,c0,d0].forEach((v,i)=>{for(let j=0;j<4;j++)out[4*i+j]=v>>>(8*j)&255;});return out;
}
export function rc4(key,data){
  const s=new Uint8Array(256);for(let i=0;i<256;i++)s[i]=i;
  for(let i=0,j=0;i<256;i++){j=(j+s[i]+key[i%key.length])&255;[s[i],s[j]]=[s[j],s[i]];}
  const out=new Uint8Array(data.length);
  for(let k=0,i=0,j=0;k<data.length;k++){i=(i+1)&255;j=(j+s[i])&255;[s[i],s[j]]=[s[j],s[i]];out[k]=data[k]^s[(s[i]+s[j])&255];}
  return out;
}
const hexBytes=h=>{h=h.replace(/[^0-9a-fA-F]/g,'');if(h.length%2)h+='0';const b=new Uint8Array(h.length/2);for(let i=0;i<b.length;i++)b[i]=parseInt(h.slice(2*i,2*i+2),16);return b;};
// A PDF string's bytes: <hex> or (literal), with the literal's escapes.
function pdfStringBytes(s){
  s=s.trim();if(s.startsWith('<'))return hexBytes(s.slice(1,s.indexOf('>')));
  const out=[];const body=s.slice(1,-1);
  for(let i=0;i<body.length;i++){const ch=body[i];
    if(ch!=='\\'){out.push(ch.charCodeAt(0)&255);continue;}
    const nx=body[++i];const E={n:10,r:13,t:9,b:8,f:12,'(':40,')':41,'\\':92};
    if(nx in E)out.push(E[nx]);else if(/[0-7]/.test(nx)){let o=nx;while(o.length<3&&/[0-7]/.test(body[i+1]||''))o+=body[++i];out.push(parseInt(o,8)&255);}
    else if(nx==='\r'){if(body[i+1]==='\n')i++;}else if(nx!=='\n')out.push(nx.charCodeAt(0)&255);}
  return new Uint8Array(out);
}
// The file key for the blank user password, and how each object's key is made; null when the file isn't encrypted the
// way this reads. raw: the file as latin1 text.
export function pdfDecryptor(raw){
  const ref=[...raw.matchAll(/\/Encrypt\s+(\d+)\s+(\d+)\s+R/g)].pop();if(!ref)return null;
  const body=raw.match(new RegExp(`(?:^|\\s)${ref[1]}\\s+${ref[2]}\\s+obj([\\s\\S]*?)endobj`))?.[1];if(!body||!/\/Filter\s*\/Standard/.test(body))return {unsupported:true};
  const num=k=>Number(body.match(new RegExp(`/${k}\\s+(-?\\d+)`))?.[1]);
  const V=num('V')||0,R=num('R'),P=num('P'),bits=num('Length')||40,str=k=>{const m=body.match(new RegExp(`/${k}\\s*(<[0-9a-fA-F\\s]*>|\\((?:\\\\[\\s\\S]|[^\\\\)])*\\))`));return m?pdfStringBytes(m[1]):null;};
  const O=str('O'),idm=[...raw.matchAll(/\/ID\s*\[\s*(<[0-9a-fA-F\s]*>|\((?:\\[\s\S]|[^\\)])*\))/g)].pop(),ID=idm?pdfStringBytes(idm[1]):new Uint8Array(0);
  const aes=V===4&&/\/CFM\s*\/AESV2/.test(body);
  if(!O||!(R>=2&&R<=4)||(V===4&&!aes&&!/\/CFM\s*\/V2/.test(body)))return {unsupported:true};
  const n=R===2?5:Math.min(16,(V===4?128:bits)/8);
  const p=new Uint8Array(4);for(let i=0;i<4;i++)p[i]=(P>>>(8*i))&255;
  const meta=R>=4&&/\/EncryptMetadata\s+false/.test(body);
  let k=md5(new Uint8Array([...PAD,...O.subarray(0,32),...p,...ID,...(meta?[255,255,255,255]:[])]));
  if(R>=3)for(let i=0;i<50;i++)k=md5(k.subarray(0,n));
  const key=k.subarray(0,n),self=Number(ref[1]);
  const objKey=(obj,gen)=>md5(new Uint8Array([...key,obj&255,obj>>>8&255,obj>>>16&255,gen&255,gen>>>8&255,...(aes?[0x73,0x41,0x6c,0x54]:[])])).subarray(0,Math.min(16,n+5));
  return {self,aes,async stream(obj,gen,data){
    const k=objKey(obj,gen);if(!aes)return rc4(k,data);
    if(data.length<32||data.length%16)return null;
    try{const c=await crypto.subtle.importKey('raw',k,{name:'AES-CBC'},false,['decrypt']);return new Uint8Array(await crypto.subtle.decrypt({name:'AES-CBC',iv:data.subarray(0,16)},c,data.subarray(16)));}catch{return null;}
  }};
}

// Every indirect object: its number, its dictionary text, and its stream's bytes (inflated when FlateDecode; decrypted
// first when the file is encrypted with a blank password).
async function readObjects(bytes){
  const raw=latin1(bytes),objects=new Map(),crypt=pdfDecryptor(raw);let left=PDF_CAP;
  if(crypt?.unsupported)return objects;
  for(const m of raw.matchAll(/(\d+)\s+(\d+)\s+obj\b/g)){
    const start=m.index+m[0].length,end=raw.indexOf('endobj',start);if(end<0)continue;
    let body=raw.slice(start,end),stream=null;
    const s=body.search(/\bstream\r?\n/);
    if(s>=0){
      const from=start+s+body.slice(s).match(/^stream\r?\n/)[0].length,to=raw.lastIndexOf('endstream',end);
      if(to>from){
        const dict=body.slice(0,s);
        if(!NOT_TEXT.test(dict)){
          let data=bytes.subarray(from,to);
          // An encrypted stream is cut at its /Length (its last bytes may look like a line ending), then decrypted.
          let crypted=false;
          if(crypt&&Number(m[1])!==crypt.self&&!/\/Type\s*\/XRef\b/.test(dict)){
            // (the length is written in the dictionary, or kept in another object: /Length 25 0 R)
            const lm=dict.match(/\/Length\s+(\d+)\b(\s+\d+\s+R)?/),L=lm?(lm[2]?Number(raw.match(new RegExp(`(?:^|\\s)${lm[1]}\\s+\\d+\\s+obj\\s*(\\d+)\\s*endobj`))?.[1]):Number(lm[1])):NaN;
            data=await crypt.stream(Number(m[1]),Number(m[2]),Number.isFinite(L)&&L>0&&from+L<=to?bytes.subarray(from,from+L):trimEol(data));crypted=true;
            if(!data){objects.set(Number(m[1]),{dict:body.slice(0,s),stream:null});continue;}
          }
          stream=/\/FlateDecode/.test(dict)?(left>0?await inflate(crypted?data:trimEol(data),Math.min(STREAM_CAP,left)):null):/\/Filter/.test(dict)?null:data.slice();
          if(stream)left-=stream.length;
        }
      }
      body=body.slice(0,s);
    }
    objects.set(Number(m[1]),{dict:body,stream});
  }
  // Object streams pack several objects (often the fonts) into one compressed stream.
  for(const o of [...objects.values()]){
    if(!/\/Type\s*\/ObjStm/.test(o.dict)||!o.stream)continue;
    const n=Number(o.dict.match(/\/N\s+(\d+)/)?.[1]),first=Number(o.dict.match(/\/First\s+(\d+)/)?.[1]),text=latin1(o.stream);
    const head=text.slice(0,first).trim().split(/\s+/).map(Number);
    for(let i=0;i<n;i++){
      const num=head[2*i],off=head[2*i+1],next=i+1<n?head[2*i+3]:text.length-first;
      if(Number.isFinite(num)&&!objects.has(num))objects.set(num,{dict:text.slice(first+off,first+next),stream:null});
    }
  }
  return objects;
}
const trimEol=b=>{let n=b.length;while(n&&(b[n-1]===10||b[n-1]===13))n--;return b.subarray(0,n);};

// A ToUnicode table: character code (as hex) -> text, and how many bytes a code takes.
function cmap(text){
  const map=new Map(),hex=h=>h.replace(/\s/g,'').toUpperCase();
  const uni=h=>{let s='';for(let i=0;i+4<=h.length;i+=4)s+=String.fromCharCode(parseInt(h.slice(i,i+4),16));return s;};
  const width=(text.match(/begincodespacerange\s*<([0-9a-fA-F]+)>/)?.[1]||'00').length/2;
  for(const block of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g))
    for(const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g))map.set(hex(m[1]),uni(hex(m[2])));
  for(const block of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g))
    for(const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<([0-9a-fA-F]+)>|\[([^\]]*)\])/g)){
      const lo=parseInt(m[1],16),hi=parseInt(m[2],16),w=m[1].length;
      const list=m[5]?[...m[5].matchAll(/<([0-9a-fA-F]+)>/g)].map(x=>uni(hex(x[1]))):null;
      for(let c=lo;c<=hi&&c-lo<5000;c++){
        const key=c.toString(16).toUpperCase().padStart(w,'0');
        if(list){if(list[c-lo]!=null)map.set(key,list[c-lo]);}
        else{const base=hex(m[4]),last=parseInt(base.slice(-4),16)+(c-lo);map.set(key,uni(base.slice(0,-4)+last.toString(16).padStart(4,'0')));}
      }
    }
  return {map,width:Math.max(1,width)};
}

// The content stream's tokens: strings (as bytes), names, numbers, arrays and operators.
function tokens(text){
  const out=[];let i=0;const n=text.length;
  while(i<n){
    const c=text[i];
    if(/\s/.test(c)){i++;continue;}
    if(c==='%'){while(i<n&&text[i]!=='\n'&&text[i]!=='\r')i++;continue;}
    if(c==='('){
      let depth=1,s='';i++;
      while(i<n&&depth){
        const ch=text[i++];
        if(ch==='\\'){
          const e=text[i++];
          if(/[0-7]/.test(e)){let o=e;while(o.length<3&&/[0-7]/.test(text[i]))o+=text[i++];s+=String.fromCharCode(parseInt(o,8));}
          else s+={n:'\n',r:'\r',t:'\t',b:'\b',f:'\f'}[e]??(e==='\r'||e==='\n'?'':e);
        }
        else if(ch==='('){depth++;s+=ch;}
        else if(ch===')'){if(--depth)s+=ch;}
        else s+=ch;
      }
      out.push({str:s});continue;
    }
    if(c==='<'&&text[i+1]!=='<'){
      // (no closing ">": the stream is damaged or isn't text; it ends here rather than being read again from the start)
      const e=text.indexOf('>',i);if(e<0)break;
      let h=text.slice(i+1,e).replace(/\s/g,'');if(h.length%2)h+='0';
      let s='';for(let k=0;k<h.length;k+=2)s+=String.fromCharCode(parseInt(h.slice(k,k+2),16));
      out.push({str:s});i=e+1;continue;
    }
    if(c==='['||c===']'){out.push({op:c});i++;continue;}
    if(c==='<'||c==='>'){out.push({op:c+c});i+=2;continue;}
    let j=i+1;while(j<n&&!/[\s()<>\[\]/%]/.test(text[j]))j++;
    const w=text.slice(i,j);
    if(c==='/')out.push({name:w.slice(1)});
    else if(/^[+-]?(\d+\.?\d*|\.\d+)$/.test(w))out.push({num:Number(w)});
    else out.push({op:w});
    i=j;
    // An inline picture (BI … ID <bytes> EI): its bytes are skipped, up to the EI that ends it.
    if(w==='ID'&&c!=='/'){const end=/\sEI(?=[\s/\[<(]|$)/g;end.lastIndex=j+1;const m=end.exec(text);i=m?m.index+m[0].length:n;}
    if(out.length>MAX_TOKENS)break;
  }
  return out;
}
// Enough for any page of words; a stream with more isn't text.
const MAX_TOKENS=2e6;

// Windows-1252 characters a simple font may use in the 0x80-0x9F range.
const WIN={0x91:'‘',0x92:'’',0x93:'“',0x94:'”',0x96:'–',0x97:'—',0x95:'•',0x85:'…'};
function decode(bytes,font){
  if(!font)return [...bytes].map(ch=>WIN[ch.charCodeAt(0)]||ch).join('');
  let s='';
  for(let i=0;i<bytes.length;i+=font.width){
    const code=[...bytes.slice(i,i+font.width)].map(ch=>ch.charCodeAt(0).toString(16).toUpperCase().padStart(2,'0')).join('');
    s+=font.map.get(code)??(font.width===1?bytes[i]:'');
  }
  return s;
}

export async function pdfText(bytes){
  if(!(bytes instanceof Uint8Array)||latin1(bytes.subarray(0,5))!=='%PDF-')return '';
  const objects=await readObjects(bytes);
  // Font resource names (/F1) -> the font's ToUnicode table, when it has one.
  const ref=v=>{const m=String(v||'').match(/^\s*(\d+)\s+\d+\s+R/);return m?objects.get(Number(m[1])):null;};
  const unicodeOf=new Map();
  for(const [num,o] of objects){
    const t=o.dict.match(/\/ToUnicode\s+(\d+)\s+\d+\s+R/);
    if(/\/Type\s*\/Font\b/.test(o.dict)&&t){const c=objects.get(Number(t[1]));if(c?.stream)unicodeOf.set(num,cmap(latin1(c.stream)));}
  }
  const fonts=new Map();
  for(const o of objects.values()){
    for(const m of o.dict.matchAll(/\/Font\s*(<<([\s\S]*?)>>|(\d+\s+\d+\s+R))/g)){
      const body=m[2]??ref(m[3])?.dict??'';
      for(const f of body.matchAll(/\/([^\s/<>\[\]()]+)\s+(\d+)\s+\d+\s+R/g))if(!fonts.has(f[1])&&unicodeOf.has(Number(f[2])))fonts.set(f[1],unicodeOf.get(Number(f[2])));
    }
  }
  const lines=[];
  for(const o of objects.values()){
    // (a form, drawn by a page, holds text too: the House Clerk's newer reports draw their first page as one)
    if(!o.stream||/\/Type\s*\/(ObjStm|XRef)/.test(o.dict)||/\/Subtype\s*\/Image/.test(o.dict))continue;
    const text=latin1(o.stream);if(!/\bBT\b/.test(text)||!/T[jJ]|['"]/.test(text))continue;
    let line='',font=null,y=null,stack=[],arr=null;
    // (a glyph its font maps to nothing, such as small capitals in the House Clerk's headings, comes out as \0 and is dropped)
    const newline=()=>{const l=line.replace(/\0/g,'').replace(/\s+/g,' ').trim();if(l)lines.push(l);line='';};
    for(const t of tokens(text)){
      if(t.op==='['){arr=[];continue;}
      if(t.op===']'){stack.push({arr});arr=null;continue;}
      if(arr){arr.push(t);continue;}
      if(!t.op){stack.push(t);continue;}
      const args=stack;stack=[];
      switch(t.op){
        case 'Tf':font=fonts.get(args[0]?.name)||null;break;
        case 'Tj':line+=decode(args.at(-1)?.str||'',font);break;
        case "'":case '"':newline();line+=decode(args.at(-1)?.str||'',font);break;
        case 'TJ':for(const x of args.at(-1)?.arr||[]){if(x.str!=null)line+=decode(x.str,font);else if(x.num<-200)line+=' ';}break;
        case 'Td':case 'TD':if(Math.abs(args[1]?.num||0)>0.5)newline();else if((args[0]?.num||0)>0)line+=' ';break;
        case 'T*':newline();break;
        case 'Tm':{const ny=args[5]?.num;if(y!=null&&ny!=null&&Math.abs(ny-y)>0.5)newline();else if(line)line+=' ';y=ny;break;}
        case 'ET':line+=' ';break;
      }
    }
    newline();
  }
  return lines.join('\n');
}
