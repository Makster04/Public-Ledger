// The rows of an Excel workbook (.xlsx), with no library: an .xlsx file is a zip of XML parts. Its central directory
// lists the parts; each is stored or deflated. The shared strings and each worksheet are read into rows of cell text.
//   xlsxSheets(bytes) -> [{name, rows: [[cell, ...], ...]}]
import zlib from 'node:zlib';

// The files in a zip: name -> bytes (only the ones `want` accepts).
export function unzip(bytes,want=()=>true){
  const b=Buffer.from(bytes.buffer,bytes.byteOffset,bytes.byteLength),out=new Map();
  // The end of the central directory: its signature within the last 64 KB.
  let end=-1;for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--)if(b.readUInt32LE(i)===0x06054b50){end=i;break;}
  if(end<0)return out;
  let at=b.readUInt32LE(end+16);const n=b.readUInt16LE(end+10);
  for(let k=0;k<n&&at+46<=b.length&&b.readUInt32LE(at)===0x02014b50;k++){
    const method=b.readUInt16LE(at+10),size=b.readUInt32LE(at+20),nameLen=b.readUInt16LE(at+28),extra=b.readUInt16LE(at+30),note=b.readUInt16LE(at+32),local=b.readUInt32LE(at+42);
    const name=b.toString('utf8',at+46,at+46+nameLen);at+=46+nameLen+extra+note;
    if(!want(name)||local+30>b.length||b.readUInt32LE(local)!==0x04034b50)continue;
    const start=local+30+b.readUInt16LE(local+26)+b.readUInt16LE(local+28),data=b.subarray(start,start+size);
    try{out.set(name,method===0?Buffer.from(data):method===8?zlib.inflateRawSync(data,{maxOutputLength:64e6}):null);}catch{}
  }
  return out;
}
const XML_ENT={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"};
const unxml=s=>String(s).replace(/&(amp|lt|gt|quot|apos);/g,m=>XML_ENT[m]).replace(/&#(\d+);/g,(_,d)=>String.fromCodePoint(Number(d))).replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCodePoint(parseInt(h,16)));
// A column's letters as a number: A 0, Z 25, AA 26.
const col=ref=>{let n=0;for(const c of /^[A-Z]+/.exec(ref)?.[0]||'A')n=n*26+c.charCodeAt(0)-64;return n-1;};
export function xlsxSheets(bytes){
  const files=unzip(bytes,n=>/^xl\/(sharedStrings\.xml|workbook\.xml|worksheets\/sheet\d+\.xml)$/.test(n));
  const shared=[...String(files.get('xl/sharedStrings.xml')||'').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m=>unxml([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t=>t[1]).join('')));
  const names=[...String(files.get('xl/workbook.xml')||'').matchAll(/<sheet\b[^>]*name="([^"]*)"/g)].map(m=>unxml(m[1]));
  const sheets=[...files.keys()].filter(k=>/worksheets\/sheet\d+\.xml$/.test(k)).sort((a,b)=>Number(/(\d+)\.xml/.exec(a)[1])-Number(/(\d+)\.xml/.exec(b)[1]));
  return sheets.map((k,i)=>{
    const rows=[];
    for(const r of String(files.get(k)).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)){
      const row=[];
      for(const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
        const ref=/\br="([A-Z]+)\d+"/.exec(c[1])?.[1],type=/\bt="([^"]+)"/.exec(c[1])?.[1],body=c[2]||'';
        const v=/<v>([\s\S]*?)<\/v>/.exec(body)?.[1],inline=/<is>([\s\S]*?)<\/is>/.exec(body)?.[1];
        const val=type==='s'?shared[Number(v)]??'':type==='inlineStr'?unxml([...String(inline).matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t=>t[1]).join('')):v!=null?unxml(v):'';
        row[ref?col(ref):row.length]=val;
      }
      rows.push(Array.from(row,x=>x??''));
    }
    return {name:names[i]||`Sheet${i+1}`,rows};
  });
}
// A workbook as plain text, one line a row and cells split by tabs, each sheet under its name.
export const xlsxText=bytes=>xlsxSheets(bytes).map(s=>`# ${s.name}\n${s.rows.map(r=>r.join('\t')).join('\n')}`).join('\n\n');
