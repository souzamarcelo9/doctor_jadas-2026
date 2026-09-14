/** `x || []` NÃO protege contra `x` ser um objeto truthy que não é array
 * (ex: `{0: {...}, 1: {...}}` em vez de `[{...}, {...}]`) — isso já causou
 * um "TypeError: x is not iterable" em produção quando um documento do
 * Firestore ficou com um campo de array salvo/editado de um jeito que
 * virou objeto. Usar esta função em vez de `|| []` sempre que ler um campo
 * que deveria ser array mas vem de fora (Firestore, API externa, etc). */
export function paraArray(valor) {
  return Array.isArray(valor) ? valor : [];
}
