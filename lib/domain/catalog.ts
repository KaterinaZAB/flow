import type {Service} from './types.ts';
export const services:Service[]=[
{id:'yandex-plus',name:'Яндекс Плюс',category:'subscription',group:'bundle',merchantAliases:['YANDEX PLUS','YA PLUS','ЯНДЕКС ПЛЮС'],manageSubscriptionUrl:'https://plus.yandex.ru/ru/my/payments',cancellationUrl:'https://yandex.ru/support/plus/ru/manage/unsubscribe',color:'#ef5165',monogram:'Я'},
{id:'chatgpt',name:'ChatGPT',category:'software',group:'ai',merchantAliases:['OPENAI CHATGPT','CHATGPT','OPENAI PLUS'],website:'https://chatgpt.com',cancellationUrl:'https://help.openai.com/en/articles/7232927-how-do-i-cancel-my-chatgpt-subscription',color:'#4c8d7e',monogram:'G'},
{id:'netflix',name:'Netflix',category:'subscription',group:'video',merchantAliases:['NETFLIX','NETFLIX COM'],cancellationUrl:'https://help.netflix.com/en/node/407',color:'#e3444a',monogram:'N'},
{id:'spotify',name:'Spotify',category:'subscription',group:'music',merchantAliases:['SPOTIFY','SPOTIFY PREMIUM'],cancellationUrl:'https://support.spotify.com/us/article/cancel-premium/',color:'#37a86a',monogram:'S'},
{id:'ivi',name:'Иви',category:'subscription',group:'video',merchantAliases:['IVI','IVI RU','ИВИ'],color:'#e65591',monogram:'ivi'},
{id:'kinopoisk',name:'Кинопоиск',category:'subscription',group:'video',merchantAliases:['KINOPOISK','КИНОПОИСК'],color:'#ef8a42',monogram:'К'},
{id:'okko',name:'Okko',category:'subscription',group:'video',merchantAliases:['OKKO','OKKO TV'],color:'#8c6dce',monogram:'О'},
{id:'rostelecom',name:'Ростелеком',category:'internet',merchantAliases:['ROSTELECOM','РОСТЕЛЕКОМ'],color:'#8775ba',monogram:'Р'},
{id:'mts',name:'МТС',category:'mobile',merchantAliases:['MTS','МТС'],color:'#e05a60',monogram:'М'},
{id:'beeline',name:'Билайн',category:'mobile',merchantAliases:['BEELINE','БИЛАЙН'],color:'#c9a343',monogram:'Б'},
{id:'icloud',name:'iCloud',category:'cloud',merchantAliases:['ICLOUD','APPLE ICLOUD'],color:'#5e9ed4',monogram:'i'},
{id:'adobe',name:'Adobe',category:'software',merchantAliases:['ADOBE','ADOBE SYSTEMS'],color:'#d85b60',monogram:'A'}
];
export function normalizedText(merchant:string){return merchant.normalize('NFKC').toUpperCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ')}
export function findService(merchant:string){const normalized=normalizedText(merchant);return services.find(s=>s.merchantAliases.some(a=>{const alias=normalizedText(a);return normalized===alias||normalized.startsWith(alias+' ')}))}
export function normalizeMerchant(merchant:string){const service=findService(merchant);if(service)return 'service:'+service.id;return normalizedText(merchant).replace(/\s+(?:MOSCOW|МОСКВА|RUS|RUSSIA)$/,'').replace(/\s+(?:ORDER|ЗАКАЗ|REF)\s+\d+$/,'').trim()}
export function serviceById(id:string|null|undefined){return services.find(s=>s.id===id)}

