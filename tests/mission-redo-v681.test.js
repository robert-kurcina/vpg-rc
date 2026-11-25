const assert=require('node:assert/strict');const {redoHistory}=require('../core/mission_storage.js');
const h=redoHistory(),a={},b={},c={},d={};
assert.equal(h.available(a),false);h.recordUndo(c,b);h.recordUndo(b,a);assert.equal(h.take(a),b);assert.equal(h.take(b),c);assert.equal(h.available(c),false);h.recordUndo(c,b);assert.equal(h.available(b),true);assert.equal(h.available(d),false);assert.equal(h.take(d),null);h.recordUndo(d,a);h.clear();assert.equal(h.available(a),false);console.log('PASS redo history order, divergent action and reset');
