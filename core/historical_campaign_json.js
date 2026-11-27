/* Ordinary JSON helpers for historical session envelopes and action views.
 * Preserve JSON.stringify ordering, coercions and exceptions.
 * Canonical campaign receipt serialization remains separate.
 */
'use strict';
const crypto=require('node:crypto');
const clone=value=>JSON.parse(JSON.stringify(value));
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const checksum=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
module.exports=Object.freeze({clone,object,equal,checksum});
