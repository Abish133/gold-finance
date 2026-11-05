/**
 * Gap-free, concurrency-safe running numbers per branch (and optionally per financial year).
 * Must be called inside a transaction (tx) so the row lock holds until commit.
 */
export const nextNumber = async (tx, { branchId, key, fyId = 0, startAt = 1 }) => {
  await tx.query(
    `INSERT INTO number_sequences (branch_id, seq_key, fy_id, last_no) VALUES (:b, :k, :f, :s)
     ON DUPLICATE KEY UPDATE last_no = last_no`,
    { b: branchId, k: key, f: fyId, s: startAt - 1 },
  );
  const row = await tx.queryOne(
    'SELECT last_no FROM number_sequences WHERE branch_id = :b AND seq_key = :k AND fy_id = :f FOR UPDATE',
    { b: branchId, k: key, f: fyId },
  );
  const next = row.last_no + 1;
  await tx.query(
    'UPDATE number_sequences SET last_no = :n WHERE branch_id = :b AND seq_key = :k AND fy_id = :f',
    { n: next, b: branchId, k: key, f: fyId },
  );
  return next;
};

/** Peek the next number without consuming it (for showing on screen). */
export const peekNumber = async (db, { branchId, key, fyId = 0 }) => {
  const row = await db.queryOne(
    'SELECT last_no FROM number_sequences WHERE branch_id = :b AND seq_key = :k AND fy_id = :f',
    { b: branchId, k: key, f: fyId },
  );
  return (row?.last_no || 0) + 1;
};

/** Manually move a sequence (Bill Book No change). */
export const setNumber = async (db, { branchId, key, fyId = 0, lastNo }) =>
  db.query(
    `INSERT INTO number_sequences (branch_id, seq_key, fy_id, last_no) VALUES (:b, :k, :f, :n)
     ON DUPLICATE KEY UPDATE last_no = :n`,
    { b: branchId, k: key, f: fyId, n: lastNo },
  );
