export function parseMinor(value:string|number):number {
  const clean=String(value).trim().replace(/[\s\u00a0₽$€£]/g,'').replace(/(?:RUB|USD|EUR|руб\.?)/gi,'').replace(',','.');
  if(!/^[+-]?\d{1,10}(?:\.\d{1,2})?$/.test(clean)) throw new Error('Укажите сумму с точностью до двух знаков после запятой.');
  const negative=clean.startsWith('-'); const [whole,fraction='']=clean.replace(/^[+-]/,'').split('.');
  const amount=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  if(!Number.isSafeInteger(amount)||amount>100_000_000_000) throw new Error('Сумма слишком велика.');
  return negative?-amount:amount;
}
export function divideRounded(n:number,d:number):number {if(!Number.isSafeInteger(n)||!Number.isInteger(d)||d<=0)throw new Error('Invalid money operation');return Number((BigInt(n)*2n+BigInt(d))/(2n*BigInt(d)));}
export function money(n:number,currency='RUB',decimals=false){return new Intl.NumberFormat('ru-RU',{style:'currency',currency,maximumFractionDigits:decimals||n%100!==0?2:0,minimumFractionDigits:0}).format(n/100)}
