// PostgREST caps an unpaginated select at 1000 rows by default — silently,
// no error, no truncation flag. knowledge_chunks already has 1491 rows, so
// any script fetching full row sets (not just a count) must page through
// explicitly or it silently undercounts. One helper, used by every script
// that reads knowledge_chunks in bulk.
export async function fetchAllRows(buildQuery) {
  const pageSize = 1000;
  let from = 0;
  const all = [];
  while (true) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) throw error;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
