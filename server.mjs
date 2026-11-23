import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import handler from './api/index.js';
const root=resolve('public');
http.createServer(async(req,res)=>{if(req.url.startsWith('/api/'))return handler(req,res);try{const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(path!==root&&!path.startsWith(root+String.fromCharCode(92))&&!path.startsWith(root+'/'))throw Error();const target=(path===root||path===resolve(root,'staff'))?resolve(root,'index.html'):path;const data=await readFile(target);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[extname(target)]||'application/octet-stream');res.end(data);}catch{res.statusCode=404;res.end('Not found');}}).listen(Number(process.env.PORT)||3000,'127.0.0.1',()=>console.log('MessWise running at http://localhost:3000'));
