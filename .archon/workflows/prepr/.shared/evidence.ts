import {join} from 'node:path';
export function artifact(name:string) {if(!Bun.env.ARTIFACTS_DIR)throw new Error('Archon ARTIFACTS_DIR is required.');if(!/^[a-zA-Z0-9_.-]+$/.test(name))throw new Error('Invalid artifact filename.');return join(Bun.env.ARTIFACTS_DIR,name);}
export const load=async(name:string)=>Bun.file(artifact(name)).json();
export const save=async(name:string,value:unknown)=>Bun.write(artifact(name),JSON.stringify(value,null,2)+'\n');
export function disputeIndex(value:string){if(!/^\d+$/.test(value))throw new Error('Invalid dispute index.');return Number(value);}
