import test from 'node:test';import assert from 'node:assert/strict';
import {formatSpiceValue,parseSpice,parseSpiceValue,serializeSpice,SpiceSyntaxError,toOpenCircuit} from '../src/index.js';
test('parses engineering values',()=>{assert.equal(parseSpiceValue('4.7k'),4700);assert.equal(parseSpiceValue('10meg'),1e7);assert.equal(parseSpiceValue('22uF'),22e-6);assert.equal(formatSpiceValue(4700),'4.7k');});
test('parses and converts a netlist',()=>{const doc=parseSpice('Divider\nV1 in 0 DC 10\nR1 in out 1k\nR2 out 0 1k\n.end');assert.equal(doc.components.length,3);const circuit=toOpenCircuit(doc);assert.equal(circuit.components[1].resistance,1000);assert.equal(circuit.ground,'0');});
test('parses continuations, comments, and diode parameters',()=>{const doc=parseSpice('Diode\n* model demo\nD1 a 0 DFAST\n+ area=2\n.end');assert.equal(doc.comments[0].text,'model demo');assert.equal(doc.components[0].parameters.area,'2');});
test('round trips supported elements',()=>{const first=parseSpice('RC\nV1 in 0 5\nR1 in out 1k\nC1 out 0 1u\n.end');const second=parseSpice(serializeSpice(first));assert.deepEqual(second.components.map(c=>c.type),first.components.map(c=>c.type));});
test('reports syntax diagnostics',()=>{assert.throws(()=>parseSpice('Bad\nX1 a b model\n.end'),SpiceSyntaxError);const doc=parseSpice('Bad\nX1 a b model',{strict:false});assert.equal(doc.diagnostics.length,1);});
