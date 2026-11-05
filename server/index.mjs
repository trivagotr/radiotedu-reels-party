import {resolve} from 'node:path';
import {createApp} from './app.mjs';
const port=Number(process.env.PORT||'3100');
if(!Number.isInteger(port)||port<1||port>65535)throw Error('PORT geçerli bir TCP portu olmalıdır.');
const app=createApp({dbPath:resolve(process.env.DATA_FILE||'./data/party.sqlite'),publicUrl:process.env.PUBLIC_URL,adminPassword:process.env.ADMIN_PASSWORD,sessionSecret:process.env.SESSION_SECRET});
const server=app.listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`Reels Party ${port} portunda dinliyor.`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{app.close();process.exit(0)}));
