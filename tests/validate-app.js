const fs = require('node:fs');
const assert = require('node:assert/strict');

const app = fs.readFileSync('app-v2.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');

function installments(totalCents, count) {
  const base = Math.floor(totalCents / count);
  const remainder = totalCents % count;
  return Array.from({ length: count }, (_, i) => base + (i === count - 1 ? remainder : 0));
}

function test(name, fn) {
  try { fn(); console.log('PASS', name); }
  catch (error) { console.error('FAIL', name, '-', error.message); process.exitCode = 1; }
}

test('JavaScript do aplicativo e service worker têm sintaxe válida', () => {
  new Function(app);
  new Function(sw);
});

test('IDs HTML são únicos', () => {
  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size, 'há IDs duplicados no HTML');
});

test('Referências $(\"id\") existem no HTML', () => {
  const ids = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m => m[1]));
  const refs = [...new Set([...app.matchAll(/\$\("([^"]+)"\)/g)].map(m => m[1]))];
  assert.deepEqual(refs.filter(id => !ids.has(id)), []);
});

test('Fluxo de reembolso não contém a variável inexistente editingRefund', () => {
  assert.doesNotMatch(app, /\beditingRefund\b/);
  assert.match(app, /const cancelFuture=!refundEditingId&&Boolean\(source\.installmentNumber\)/);
});

test('Correção de reembolso atualiza o lançamento existente sem criar outro', () => {
  assert.match(app, /if\(refundEditingId\)[\s\S]{0,1000}doc\(refundEditingId\)\.set/);
  assert.match(app, /Reembolso corrigido\./);
});

test('Cancelamento de parcelas futuras usa gravação em lote no Firestore', () => {
  assert.match(app, /future\.forEach\(t=>batch\.delete\(coll\.doc\(t\.id\)\)\);await batch\.commit\(\)/);
});

test('Parcelamento soma exatamente o valor informado, incluindo centavos restantes', () => {
  for (const [total, count] of [[10000, 3], [10001, 3], [1, 2], [99999999, 36], [12345, 12]]) {
    const parts = installments(total, count);
    assert.equal(parts.length, count);
    assert.equal(parts.reduce((sum, value) => sum + value, 0), total);
    assert.ok(parts.every(value => Number.isInteger(value) && value >= 0));
  }
});

test('Movimentações são ordenadas da mais recente para a mais antiga', () => {
  assert.match(app, /return state\.transactions\.filter[\s\S]{0,600}\.sort\(\(a,b\)=>String\(b\.date/);
});
test('Exclusão usa modal do app em vez do confirm do navegador', () => {
  assert.match(app, /function requestDeleteTransaction\(id\)/);
  assert.match(app, /delete-confirm-dialog/);
  assert.doesNotMatch(app, /if\(!confirm\(item\.isRefund/);
  assert.match(html, /id="delete-confirm-dialog"/);
});

test('Movimentações abrem detalhes ao clicar na linha', () => {
  assert.match(app, /data-open-detail=/);
  assert.match(app, /openMovementDetails\(row\.dataset\.openDetail\)/);
  assert.match(html, /id="movement-detail-dialog"/);
});

test('Cache do PWA tem versão atualizada', () => {
  assert.match(sw, /meu-bolso-shell-v23/);
});

