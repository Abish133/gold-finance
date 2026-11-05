/** Parse ?page=&pageSize=&sort=&order= safely. `sortable` whitelists columns. */
export const parseListQuery = (q, { sortable = {}, defaultSort, defaultOrder = 'desc', maxPageSize = 200 } = {}) => {
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const pageSize = Math.min(maxPageSize, Math.max(1, parseInt(q.pageSize, 10) || 25));
  const sortCol = sortable[q.sort] || sortable[defaultSort] || Object.values(sortable)[0];
  const order = String(q.order || defaultOrder).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  return {
    page, pageSize, offset: (page - 1) * pageSize,
    orderBy: sortCol ? `ORDER BY ${sortCol} ${order}` : '',
    search: (q.search || q.q || '').toString().trim(),
  };
};

export const paged = (rows, total, { page, pageSize }) => ({
  data: rows, meta: { total, page, pageSize, pages: Math.ceil(total / pageSize) || 1 },
});
