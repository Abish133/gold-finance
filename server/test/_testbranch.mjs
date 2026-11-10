// Tests that write data use their own branch, never the shop's Head Office (its books stay untouched).
// call(method, url, body) must already be logged in as admin; returns the branch id as a string.
export const testBranch = async (call) => {
  const list = (await call('GET', '/admin/branches')).data;
  const rows = list.rows || list.items || list;
  const found = rows.find((b) => b.code === 'ZTEST');
  if (found) return String(found.id);
  const b = (await call('POST', '/admin/branches', { code: 'ZTEST', name: 'Automatic Tests', phone: '9000000099', loan_prefix: 'Z', opening_cash: 500000 })).data;
  return String(b.id);
};
