import {randomUUID} from 'node:crypto';
export const menuKey=menu=>String(menu||'').toLowerCase().replace(/\s+/g,' ').trim();
const avg=rows=>rows.length?rows.reduce((n,x)=>n+x,0)/rows.length:0;
const weekday=date=>new Date(date+'T12:00:00Z').getUTCDay();
export function initDining(s){
 s.inventory??={Breakfast:0,Lunch:0,Dinner:0};
 if(s.inventory[s.meal]===0&&!s.inventoryMigrated)s.inventory[s.meal]=s.stock||0;
 s.inventoryMigrated=true;s.stock=s.inventory[s.meal]||0;s.attendance??={date:s.date,total:null,present:null};s.ratings??=[];
}
export function planning(s,meal=s.meal){
 const currentKey=menuKey(s.menu[meal]);const records=s.history.filter(h=>h.meal===meal&&h.date<s.date&&(h.prepared>0||h.served>0||h.source==='manual')).sort((a,b)=>a.date.localeCompare(b.date));
 const recent=records.slice(-7),sameDay=records.filter(h=>weekday(h.date)===weekday(s.date)).slice(-4);
 const recentMean=avg(recent.map(h=>h.served)),weekdayMean=avg(sameDay.map(h=>h.served));
 const pastAttendance=avg(recent.filter(h=>h.attendance>0).map(h=>h.attendance));const present=s.attendance?.date===s.date?s.attendance.present:null;
 const attendanceFactor=present!==null&&pastAttendance>0?present/pastAttendance:1;
 const votes=(s.ratings||[]).filter(v=>v.meal===meal&&v.menuKey===currentKey);const score=avg(votes.map(v=>v.rating));
 const popularityFactor=votes.length>=3?Number((0.8+(score-1)*0.1).toFixed(4)):1;
 let baseline=recent.length?(sameDay.length?recentMean*0.6+weekdayMean*0.4:recentMean):(present??0);
 const tickets=s.tickets.filter(t=>t.meal===meal),served=tickets.filter(t=>t.status==='served').length,waiting=tickets.filter(t=>t.status==='waiting').length,called=tickets.filter(t=>t.status==='called').length;
 const confirmations=(s.intents||[]).filter(i=>i.meal===meal&&i.attending).length;
 const predicted=Math.ceil(baseline*attendanceFactor*popularityFactor);
 const target=Math.max(present===null?predicted:Math.min(predicted,present),served+waiting+called,confirmations);
 const ready=s.inventory?.[meal]??(meal===s.meal?s.stock:0);const remaining=Math.max(0,target-served-called);
 const logs=s.logs.filter(l=>l.date===s.date&&l.meal===meal);const sum=type=>logs.filter(l=>l.type===type).reduce((n,l)=>n+l.portions,0);
 return {meal,ready,called,waiting,served,prepared:sum('prepared'),waste:sum('waste'),redistributed:sum('redistributed'),confirmations,target,additional:Math.max(0,Math.ceil(remaining*1.05)-ready),surplus:Math.max(0,ready-remaining),recentMean:Math.round(recentMean),recentDays:recent.length,weekdayMean:Math.round(weekdayMean),weekdayDays:sameDay.length,weekday:new Date(s.date+'T12:00:00Z').toLocaleDateString('en-IN',{weekday:'long',timeZone:'UTC'}),present,total:s.attendance?.total??null,pastAttendance:Math.round(pastAttendance),attendanceFactor:Number(attendanceFactor.toFixed(2)),popularity:score?Number(score.toFixed(1)):null,votes:votes.length,popularityFactor:Number(popularityFactor.toFixed(2)),basis:recent.length?'Recorded same-meal consumption':present!==null?'Present hostel residents (no meal history yet)':'Queue and meal confirmations only'};
}
export function diningChange(s,action,b,user){
 if(action==='attendance'){const total=Number(b.total),present=Number(b.present);if(!Number.isInteger(total)||!Number.isInteger(present)||total<0||total>10000||present<0||present>total)throw Error('Present residents must be between 0 and total hostel residents (maximum 10000)');s.attendance={date:s.date,total,present};}
 else if(action==='rating'){if(!['Breakfast','Lunch','Dinner'].includes(b.meal))throw Error('Invalid meal');const rating=Number(b.rating);if(!Number.isInteger(rating)||rating<1||rating>5)throw Error('Choose a menu rating between 1 and 5');const key=menuKey(s.menu[b.meal]);const existing=s.ratings.find(r=>r.user===user&&r.date===s.date&&r.meal===b.meal&&r.menuKey===key);if(existing)existing.rating=rating;else s.ratings.push({user,date:s.date,meal:b.meal,menuKey:key,rating});s.ratings=s.ratings.filter(r=>new Date(s.date+'T12:00:00Z')-new Date(r.date+'T12:00:00Z')<=90*86400000);}
 else if(action==='redistribute'){const n=Number(b.portions),reason=String(b.reason||'').trim();if(!Number.isInteger(n)||n<1||n>s.stock)throw Error('Redistributed portions must be between 1 and the food left');if(!reason||reason.length>150)throw Error('Record a destination or reason (maximum 150 characters)');s.stock-=n;s.logs.push({id:randomUUID(),date:s.date,meal:s.meal,type:'redistributed',portions:n,reason});}
 else if(action==='consumption'){const date=String(b.date||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date||date>=s.date)throw Error('Choose a valid previous date');if(!['Breakfast','Lunch','Dinner'].includes(b.meal))throw Error('Invalid meal');const values=['prepared','served','waste','attendance'].map(k=>Number(b[k]));if(values.some(n=>!Number.isInteger(n)||n<0||n>10000))throw Error('Enter whole counts between 0 and 10000');const [prepared,served,waste,attendance]=values;if(served+waste>prepared)throw Error('Served plus wasted cannot exceed prepared portions');const row={date,meal:b.meal,prepared,served,waste,attendance,menuKey:menuKey(b.menu),source:'manual'};const old=s.history.findIndex(h=>h.date===date&&h.meal===b.meal);if(old>=0)s.history[old]=row;else s.history.push(row);s.history.sort((a,b)=>a.date.localeCompare(b.date));s.history=s.history.slice(-270);}
 else return false;
 return true;
}
