// The PDF reader (src/pdf.mjs) on the House Clerk's newer annual reports (2025 on): encrypted with a blank password (the
// Standard handler, RC4 128-bit), and compressed with a header that declares a smaller window than the data uses. The
// encrypted files here are built with Node's own md5 and AES and an RC4 written out below, apart from the reader's.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {pdfText,md5,rc4,pdfDecryptor} from '../src/pdf.mjs';

const PAD=Buffer.from('28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a','hex');
const nodeMd5=b=>crypto.createHash('md5').update(b).digest();
function rc4Plain(key,data){
  const S=[...Array(256).keys()];let j=0;
  for(let i=0;i<256;i++){j=(j+S[i]+key[i%key.length])&255;[S[i],S[j]]=[S[j],S[i]];}
  const out=Buffer.alloc(data.length);let i=0;j=0;
  for(let n=0;n<data.length;n++){i=(i+1)&255;j=(j+S[i])&255;[S[i],S[j]]=[S[j],S[i]];out[n]=data[n]^S[(S[i]+S[j])&255];}
  return out;
}
// A one-page PDF whose content stream is encrypted the way the Standard handler does it (revision 3, a 128-bit key).
function encryptedPdf(content,{aes=false,deflate=false}={}){
  const O=Buffer.alloc(32,7),ID=Buffer.from('00112233445566778899aabbccddeeff','hex'),P=-1028;
  const p=Buffer.alloc(4);p.writeInt32LE(P);
  let k=nodeMd5(Buffer.concat([PAD,O,p,ID]));for(let i=0;i<50;i++)k=nodeMd5(k.subarray(0,16));
  const objKey=nodeMd5(Buffer.concat([k.subarray(0,16),Buffer.from([4,0,0,0,0]),aes?Buffer.from('sAlT','latin1'):Buffer.alloc(0)])).subarray(0,16);
  let data=Buffer.from(content,'latin1');if(deflate)data=zlib.deflateSync(data);
  if(aes){const iv=Buffer.alloc(16,3),c=crypto.createCipheriv('aes-128-cbc',objKey,iv);data=Buffer.concat([iv,c.update(data),c.final()]);}
  else data=rc4Plain(objKey,data);
  const enc=aes?`<< /Filter /Standard /V 4 /R 4 /Length 128 /CF << /StdCF << /CFM /AESV2 /Length 16 >> >> /StmF /StdCF /StrF /StdCF /O <${O.toString('hex')}> /U <${Buffer.alloc(32).toString('hex')}> /P ${P} >>`
    :`<< /Filter /Standard /V 2 /R 3 /Length 128 /O <${O.toString('hex')}> /U <${Buffer.alloc(32).toString('hex')}> /P ${P} >>`;
  const head=`%PDF-1.6\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n`+
    `3 0 obj << /Type /Page /Parent 2 0 R /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n`+
    `5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n`+
    // (the stream's length kept in another object, as the House Clerk's files do)
    `6 0 obj ${data.length} endobj\n9 0 obj ${enc} endobj\n4 0 obj << /Length 6 0 R${deflate?' /Filter /FlateDecode':''} >> stream\n`;
  const tail=`\nendstream\nendobj\ntrailer << /Root 1 0 R /Encrypt 9 0 R /ID [<${ID.toString('hex')}> <${ID.toString('hex')}>] >>\n%%EOF`;
  return new Uint8Array(Buffer.concat([Buffer.from(head,'latin1'),data,Buffer.from(tail,'latin1')]));
}

test('md5 and RC4 as the reader computes them match Node\'s md5 and a plain RC4',()=>{
  for(const s of ['','abc','The quick brown fox jumps over the lazy dog',Buffer.alloc(200,9).toString('latin1')]){
    const b=Buffer.from(s,'latin1');assert.equal(Buffer.from(md5(new Uint8Array(b))).toString('hex'),nodeMd5(b).toString('hex'));
  }
  const key=Buffer.from('0123456789abcdef'),data=Buffer.from('Schedule C: Earned Income','latin1');
  assert.deepEqual(Buffer.from(rc4(new Uint8Array(key),new Uint8Array(data))),rc4Plain(key,data));
});

test('an encrypted report (blank password, RC4 128-bit) is read, its stream length kept in another object',async()=>{
  const content='BT /F1 12 Tf 72 720 Td (Schedule E: Positions) Tj 0 -14 Td (Trustee The Anastasia Fund) Tj ET';
  assert.match(await pdfText(encryptedPdf(content)),/Trustee The Anastasia Fund/);
  assert.match(await pdfText(encryptedPdf(content,{deflate:true})),/Schedule E: Positions/,'decrypted, then inflated');
  assert.match(await pdfText(encryptedPdf(content,{aes:true,deflate:true})),/Anastasia/,'AES-128 too');
});

test('a password the reader can\'t supply, or another security handler, reads as no text rather than as garbage',async()=>{
  assert.equal(pdfDecryptor('1 0 obj << /Filter /Adobe.PubSec >> endobj trailer << /Encrypt 1 0 R >>').unsupported,true);
  assert.equal(pdfDecryptor('1 0 obj << /Type /Catalog >> endobj'),null,'not encrypted');
  const pdf=new TextEncoder().encode('%PDF-1.6\n4 0 obj << /Length 10 >> stream\nBT (x) Tj \nendstream endobj\n9 0 obj << /Filter /FooSecurity >> endobj\ntrailer << /Encrypt 9 0 R >>\n%%EOF');
  assert.equal(await pdfText(pdf),'');
});

test('a stream whose header declares a 1 KB window but reaches further back is inflated in full',async()=>{
  // The House Clerk's streams start 58 47 (a 1 KB window) and repeat text from further back, over more than 16 KB.
  // (Their own compressor's output fails "invalid distance too far back" unless the window is set to 32 KB; Node's
  // compressor doesn't reproduce that, so this checks only that such a header is read in full. The real reports were
  // checked by hand: Kaptur, Gluesenkamp Perez, Castor, Pappas, Bacon, Barr and Hern, Nov. 24, 2026.)
  const block=Array.from({length:60},(_,i)=>`(Asset ${i} Fund ${(i*7919)%1000} [MF] JT $1,001 - $15,000) Tj 0 -12 Td`).join(' ');
  const content=`BT /F1 9 Tf 72 720 Td ${Array(8).fill(block).join(' ')} (END OF SCHEDULE) Tj ET`;
  const d=zlib.deflateSync(Buffer.from(content,'latin1'));d[0]=0x58;d[1]=0x47;
  const pdf=new Uint8Array(Buffer.concat([Buffer.from(`%PDF-1.6\n1 0 obj << /Type /Page /Contents 2 0 R /Resources << /Font << /F1 3 0 R >> >> >> endobj\n2 0 obj << /Length ${d.length} /Filter /FlateDecode >> stream\n`,'latin1'),d,
    Buffer.from('\nendstream endobj\n3 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n%%EOF','latin1')]));
  assert.match(await pdfText(pdf),/END OF SCHEDULE/);
});
