import {deviceGet,devicePut,readWorkspace,updateWorkspace} from '../local/repository';
import {workspaceSchema} from '../local/schema';
import {deriveKeys,encrypt,decrypt,parseRecovery,recoveryString,type Envelope} from './crypto';
export type Device={vaultId:string;encryptionKey:CryptoKey;authSecret:string;version:number;syncedRevision:number;lastSyncAt:string|null;acknowledged:boolean};
export type SyncStatus='local'|'syncing'|'synced'|'offline'|'conflict'|'error';
export const getDevice=()=>deviceGet<Device>('sync');
function notify(status:SyncStatus){window.dispatchEvent(new CustomEvent('potok:sync-status',{detail:status}));}
export class SyncConflict extends Error {}
async function request(device:Device,method:string='GET',body?:unknown):Promise<{version:number;envelope:Envelope}>{
  const r=await fetch('/api/vaults'+(method==='POST'?'':'/'+device.vaultId),{method,credentials:'omit',cache:'no-store',headers:{Authorization:'Bearer '+device.authSecret,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  if(r.status===409)throw new SyncConflict('На другом устройстве есть более новая версия данных.');
  if(!r.ok)throw new Error(r.status===404?'Сейф не найден или удалён.':'Не удалось открыть сейф. Проверьте ключ восстановления и подключение.');
  return r.json();
}
export async function enableSync(){
  return navigator.locks.request('potok-sync',async()=>{
    if(await getDevice())throw new Error('Синхронизация уже настроена.');
    const vaultId=crypto.randomUUID(),secret=crypto.getRandomValues(new Uint8Array(32)),keys=await deriveKeys(secret,vaultId),state=await readWorkspace();
    const key=recoveryString(vaultId,secret);secret.fill(0);
    const device:Device={vaultId,...keys,version:1,syncedRevision:state.revision,lastSyncAt:null,acknowledged:false};
    // Pending setup survives closing the tab. Recovery material is wrapped under a non-extractable device key.
    await devicePut('recovery',await encrypt(key,device.encryptionKey,vaultId));
    await devicePut('sync',device);
    await request(device,'POST',{id:vaultId,envelope:await encrypt(state,device.encryptionKey,vaultId)});device.lastSyncAt=new Date().toISOString();await devicePut('sync',device);
    return key;
  });
}
export async function showRecovery(){const d=await getDevice(),e=await deviceGet<Envelope>('recovery');if(!d||!e)throw new Error('Ключ не найден на устройстве.');return String(await decrypt(e,d.encryptionKey,d.vaultId));}
export async function acknowledgeRecovery(){const d=await getDevice();if(d){d.acknowledged=true;await devicePut('sync',d);}}
async function receive(d:Device,remote:{version:number;envelope:Envelope},expectedRevision:number){const state=workspaceSchema.parse(await decrypt(remote.envelope,d.encryptionKey,d.vaultId));await updateWorkspace(current=>{if(current.revision!==expectedRevision)throw new SyncConflict('Локальные данные изменились. Повторите действие.');state.revision=current.revision;return state;});d.version=remote.version;d.syncedRevision=expectedRevision+1;d.lastSyncAt=new Date().toISOString();await devicePut('sync',d);}
export async function syncNow(choice?:'cloud'|'local'){
  return navigator.locks.request('potok-sync',async()=>{
    const d=await getDevice();if(!d){notify('local');return;}if(!d.acknowledged)return;
    notify('syncing');
    try{
      const local=await readWorkspace(),remote=await request(d);
      if(choice==='cloud'){await receive(d,remote,local.revision);notify('synced');return;}
      if(remote.version!==d.version&&!choice){if(local.revision!==d.syncedRevision)throw new SyncConflict('На другом устройстве есть более новая версия данных.');await receive(d,remote,local.revision);notify('synced');return;}
      if(local.revision!==d.syncedRevision||choice==='local'){
        const result=await request(d,'PUT',{expectedVersion:choice==='local'?remote.version:d.version,envelope:await encrypt(local,d.encryptionKey,d.vaultId)});
        d.version=result.version;d.syncedRevision=local.revision;d.lastSyncAt=new Date().toISOString();await devicePut('sync',d);
      }
      notify('synced');
    }catch(e){notify(e instanceof SyncConflict?'conflict':navigator.onLine?'error':'offline');throw e;}
  });
}
export async function restore(key:string,backup?:unknown){return navigator.locks.request('potok-sync',async()=>{try{const {vaultId,secret}=parseRecovery(key),keys=await deriveKeys(secret,vaultId);secret.fill(0);const d:Device={vaultId,...keys,version:0,syncedRevision:0,lastSyncAt:null,acknowledged:true};const local=await readWorkspace();const remote=backup?{version:0,envelope:backup as Envelope}:await request(d);await receive(d,remote,local.revision);await devicePut('recovery',await encrypt(key,d.encryptionKey,vaultId));if(backup){await devicePut('sync',undefined);await devicePut('recovery',undefined);}notify(backup?'local':'synced');}catch{throw new Error('Не удалось открыть сейф. Проверьте ключ восстановления. Данные не заменены, если проверка не пройдена.');}});}
export async function deleteCloud(){await navigator.locks.request('potok-sync',async()=>{const d=await getDevice();if(d)await request(d,'DELETE');await devicePut('sync',undefined);await devicePut('recovery',undefined);notify('local');});}
export async function encryptedBackup(){const vaultId=crypto.randomUUID(),secret=crypto.getRandomValues(new Uint8Array(32)),keys=await deriveKeys(secret,vaultId);const key=recoveryString(vaultId,secret);secret.fill(0);return {key,backup:{vaultId,envelope:await encrypt(await readWorkspace(),keys.encryptionKey,vaultId)}};}
