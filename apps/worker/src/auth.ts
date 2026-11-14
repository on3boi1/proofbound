import { createHash, createPublicKey, randomBytes, randomUUID, verify as verifyEd25519 } from "node:crypto";
import type { Session } from "../../../packages/shared/src/index.ts";
import type { RuntimeConfig } from "./config.ts";
import { Store } from "./store.ts";
import { boundedText, invariant } from "./errors.ts";
import { sha256 } from "./hash.ts";

export function base58decode(value:string):Buffer{
  const alphabet="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";let n=0n;
  for(const c of value){const digit=alphabet.indexOf(c);invariant(digit>=0,"INVALID_SIGNATURE","Invalid base58 key.");n=n*58n+BigInt(digit);}
  const bytes:number[]=[];while(n>0n){bytes.unshift(Number(n&255n));n>>=8n;}for(const c of value){if(c!=="1")break;bytes.unshift(0);}return Buffer.from(bytes);
}
function borshString(s:string):Buffer{const b=Buffer.from(s),length=Buffer.alloc(4);length.writeUInt32LE(b.length);return Buffer.concat([length,b]);}
export function nep413Digest(message:string,nonce:Uint8Array,recipient:string,callbackUrl?:string):Buffer{
  invariant(nonce.length===32,"INVALID_NONCE","NEP-413 nonce must contain exactly 32 bytes.");const tag=Buffer.alloc(4);tag.writeUInt32LE(2147484061);
  return createHash("sha256").update(Buffer.concat([tag,borshString(message),Buffer.from(nonce),borshString(recipient),Buffer.from([callbackUrl?1:0]),...(callbackUrl?[borshString(callbackUrl)]:[])])).digest();
}
export function verifyNep413(publicKey:string,signature:string,digest:Buffer):boolean{
  if(!publicKey.startsWith("ed25519:")||!/^[A-Za-z0-9+/]+={0,2}$/.test(signature))return false;
  const bytes=base58decode(publicKey.slice(8)),sig=Buffer.from(signature,"base64");if(bytes.length!==32||sig.length!==64)return false;
  const key=createPublicKey({key:Buffer.concat([Buffer.from("302a300506032b6570032100","hex"),bytes]),format:"der",type:"spki"});return verifyEd25519(null,digest,key,sig);
}
interface Challenge {id:string;accountId:string;message:string;nonce:string;recipient:string;callbackUrl?:string;state:string;expires:number;used:boolean;}
export class Auth {
  constructor(readonly store:Store,readonly config:RuntimeConfig,readonly accessKey:(account:string,key:string)=>Promise<unknown>){}
  createSession(accountId:string):{session:Session;token:string}{const token=randomBytes(32).toString("base64url"),session:Session={accountId,mode:this.config.mode,expiresAt:new Date(Date.now()+8*60*60*1000).toISOString()};this.store.put("session",sha256(token),session);return{session,token};}
  session(token:string|null):Session|null{if(!token)return null;const session=this.store.get<Session>("session",sha256(token));if(!session||session.mode!==this.config.mode||Date.parse(session.expiresAt)<=Date.now())return null;return session;}
  revoke(token:string|null):void{if(token)this.store.delete("session",sha256(token));}
  challenge(input:Record<string,unknown>){
    invariant(this.config.mode==="testnet","LOCAL_MODE","Wallet authentication is available in testnet mode.");
    const accountId=boundedText(input.accountId,2,64,"Account");invariant(/^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/.test(accountId)&&accountId.endsWith(".testnet"),"WRONG_NETWORK","Use a named NEAR testnet account.");
    let callbackUrl:string|undefined;if(input.callbackUrl){callbackUrl=boundedText(input.callbackUrl,1,300,"Callback URL");invariant(new URL(callbackUrl).origin===new URL(this.config.origin).origin,"BAD_CALLBACK","Callback must belong to this application.");}
    const id=randomUUID(),state=randomBytes(32).toString("base64url"),expires=Date.now()+5*60*1000,recipient=new URL(this.config.origin).host;
    const message=`Sign in to PROOFBOUND on NEAR testnet as ${accountId}. This authenticates an 8-hour session and does not authorize a transaction. Challenge ${id}. Expires ${new Date(expires).toISOString()}.`;
    const c:Challenge={id,accountId,message,nonce:randomBytes(32).toString("hex"),recipient,callbackUrl,state,expires,used:false};this.store.put("challenge",id,c);return{challengeId:id,message,nonce:[...Buffer.from(c.nonce,"hex")],recipient,callbackUrl,state};
  }
  async verify(input:Record<string,unknown>){
    const id=boundedText(input.challengeId,1,100,"Challenge"),c=this.store.get<Challenge>("challenge",id);
    invariant(c&&!c.used&&c.expires>Date.now(),"EXPIRED_CHALLENGE","Challenge is expired or already used. Request a new signature.",401);
    invariant(input.accountId===c.accountId&&input.state===c.state,"CHALLENGE_MISMATCH","Account or state does not match the issued challenge.",401);
    const publicKey=boundedText(input.publicKey,8,100,"Public key"),signature=boundedText(input.signature,20,200,"Signature");
    invariant(verifyNep413(publicKey,signature,nep413Digest(c.message,Buffer.from(c.nonce,"hex"),c.recipient,c.callbackUrl)),"INVALID_SIGNATURE","Wallet signature is invalid.",401);
    const access=await this.accessKey(c.accountId,publicKey) as {permission?:unknown};invariant(access?.permission==="FullAccess","KEY_NOT_AUTHORIZED","The signing key is not a current FullAccess key on this testnet account.",401);
    return this.store.transaction(()=>{const current=this.store.get<Challenge>("challenge",id);invariant(current&&!current.used&&current.expires>Date.now(),"REPLAY","Challenge has already been used.",401);this.store.put("challenge",id,{...current,used:true});return this.createSession(c.accountId);});
  }
}
