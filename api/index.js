import {prototypeChange,publicPrototype} from '../lib/prototype.mjs';
import {createHmac,randomBytes,randomUUID,timingSafeEqual,scrypt as scryptCallback} from 'node:crypto';
import {promisify} from 'node:util';
import {store} from '../lib/store.mjs';
import {change,view,rollover} from '../lib/engine.mjs';
const scrypt=promisify(scryptCallback),localSecret=randomBytes(32).toString('hex');
const sign=s=>createHmac('sha256',process.env.SESSION_SECRET||localSecret).update(s).digest('hex');
const equal=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&timingSafeEqual(x,y);};
const signed=value=>`${value}.${sign(value)}`;
function verify(value){if(!value)return null;const i=value.lastIndexOf('.'),payload=value.slice(0,i);return i>0&&equal(value.slice(i+1),sign(payload))?payload:null;}
function authCookie(name,value,age=28800){return `${name}=${value}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${age}${process.env.VERCEL?'; Secure':''}`;}
async function hash(password,salt){return (await scrypt(password,salt,64)).toString('hex');}
async function limit(req){const key=sign(String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'local').split(',')[0]);const now=Date.now();const fn=s=>{s.limits=(s.limits||[]).filter(x=>x.until>now);let item=s.limits.find(x=>x.key===key);if(!item){item={key,until:now+600000,count:0};s.limits.push(item);}item.count++;s.version++;return item.count<=20;};fn.mutate=true;if(!await store(fn)){const e=Error('Too many sign-in attempts. Try again in 10 minutes.');e.status=429;throw e;}}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');res.setHeader('X-Content-Type-Options','nosniff');
 try{
 if(process.env.VERCEL&&(!process.env.SESSION_SECRET||process.env.SESSION_SECRET.length<32))throw Error('Server setup incomplete: configure a SESSION_SECRET of at least 32 characters');
 const cookie=Object.fromEntries((req.headers.cookie||'').split(';').map(x=>x.trim().split('=')));
 const identity=verify(cookie.mw_student),[studentId,studentExp]=(identity||'').split(':');const uid=Number(studentExp)>Date.now()?studentId:null;
 const adminExp=verify(cookie.mw_admin);const admin=!!adminExp&&Number(adminExp)>Date.now()&&req.headers['x-messwise-portal']==='staff';
 if(req.method==='GET'){if(!uid&&!admin)return res.end('{"profile":null,"admin":false}');const fn=s=>{fn.mutate=rollover(s);return view(s,uid,admin);};const data=await store(fn);return res.end(JSON.stringify(data));}
 if(req.method!=='POST'){res.statusCode=405;return res.end(JSON.stringify({error:'Method not allowed'}));}
 if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)throw Error('Invalid origin');
 let b=req.body;if(!b){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>10000)throw Error('Request too large');}b=JSON.parse(raw||'{}');}if(typeof b==='string')b=JSON.parse(b);if(!b||typeof b!=='object'||Array.isArray(b)||JSON.stringify(b).length>10000)throw Error('Invalid request');
 if(b.action==='login'&&req.headers['x-messwise-portal']!=='staff'){res.statusCode=403;return res.end('{"error":"Staff portal required"}');}
 if(['signup','signin','login'].includes(b.action))await limit(req);
 if(b.action==='signup'||b.action==='signin'){
 const email=String(b.email||'').trim().toLowerCase(),password=String(b.password||'');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>150)throw Error('Enter a valid email address');if(password.length<10||password.length>128)throw Error('Use a password between 10 and 128 characters');
 let user;if(b.action==='signup'){const name=String(b.name||'').trim();if(name.length<2||name.length>60)throw Error('Enter your name, between 2 and 60 characters');const salt=randomBytes(16).toString('hex');const passwordHash=await hash(password,salt);const fn=s=>{rollover(s);if(s.users.some(u=>u.email===email))throw Error('This email is registered. Please sign in.');user={id:randomUUID(),name,email,salt,passwordHash};s.users.push(user);s.version++;return user;};fn.mutate=true;user=await store(fn);}else{user=await store(s=>(s.users||[]).find(u=>u.email===email));const calculated=await hash(password,user?.salt||'unknown-user-salt');if(!user||!equal(calculated,user.passwordHash))throw Error('Email or password is incorrect');}
 res.setHeader('Set-Cookie',authCookie('mw_student',signed(`${user.id}:${Date.now()+7*86400000}`),7*86400));return res.end('{"ok":true}');}
 if(b.action==='studentLogout'){res.setHeader('Set-Cookie',authCookie('mw_student','',0));return res.end('{"ok":true}');}
 if(b.action==='login'){if(req.headers['x-messwise-portal']!=='staff'){res.statusCode=403;return res.end('{"error":"Staff portal required"}');}if(!process.env.ADMIN_PASSWORD)throw Error('Set ADMIN_PASSWORD in the server environment first');if(!equal(String(b.password||''),process.env.ADMIN_PASSWORD))throw Error('Incorrect admin password');res.setHeader('Set-Cookie',authCookie('mw_admin',signed(String(Date.now()+8*3600000))));return res.end('{"ok":true}');}
 if(b.action==='logout'){res.setHeader('Set-Cookie',authCookie('mw_admin','',0));return res.end('{"ok":true}');}
 if(['join','leave','attend','feedback','rating'].includes(b.action)){if(!uid){res.statusCode=401;return res.end('{"error":"Sign in as a student to save your place"}');}}
 else if(!admin){res.statusCode=403;return res.end('{"error":"Admin sign-in required"}');}
 if(['project','feedback','validation','improvement','evidence'].includes(b.action)){const fn=s=>{prototypeChange(s,b.action,b,uid);return view(s,uid,admin);};fn.mutate=true;return res.end(JSON.stringify(await store(fn)));}
 const fn=s=>view(change(s,b.action,b,uid),uid,admin);fn.mutate=true;const data=await store(fn);res.end(JSON.stringify(data));
 }catch(e){res.statusCode=e.status||400;res.end(JSON.stringify({error:e.message}));}
}
