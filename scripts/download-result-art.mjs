import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {RESULT_ART} from '../result-art.js';
const root=new URL('../assets/results/',import.meta.url);
const manifest=[];
for(const [id,art] of Object.entries(RESULT_ART)) {
  await mkdir(new URL(id+'/',root),{recursive:true});
  for(const [kind,url] of Object.entries({card:`https://storage.sekai.best/sekai-jp-assets/character/member/${art.card}/card_after_training.png`,stamp:`https://storage.sekai.best/sekai-en-assets/stamp/${art.stamp}/${art.stamp}.png`})) {
    const response=await fetch(url);if(!response.ok)throw Error(`${id} ${kind}: ${response.status}`);
    const bytes=Buffer.from(await response.arrayBuffer());
    if(bytes.readUInt32BE(0)!==0x89504e47)throw Error('Expected PNG: '+url);
    await writeFile(new URL(`${id}/${kind}.png`,root),bytes);
    manifest.push({character:id,kind,title:kind==='card'?art.title:art.reaction,source:url,sha256:createHash('sha256').update(bytes).digest('hex')});
  }
  console.log('Downloaded '+id);
}
await writeFile(new URL('manifest.json',root),JSON.stringify(manifest,null,2)+'\n');
