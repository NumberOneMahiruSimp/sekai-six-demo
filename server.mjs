import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
const port=Number(process.argv[2]||process.env.PORT||5173);
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.wav':'audio/wav','.mp3':'audio/mpeg','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}const s=await stat(file);if(!s.isFile())throw Error();const data=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}}).listen(port,'127.0.0.1',()=>console.log(`SEKAI / SIX running at http://127.0.0.1:${port}`));
