/**
 * @param {*} modalLists
 */
function parseTags(modalLists) {
  let lists = modalLists.genre_lists;
  if (!Array.isArray(lists)) {
    const newLists = [];
    for (let i = 1;; ++i) {
      const list = lists[i];
      if (!list) {
        break;
      }
      newLists.push(list);
    }
    lists = newLists;
  }

  const tagValues = [];
  for (const { values } of lists) {
    tagValues.push(...values);
  }
  tagValues.sort((a, b) => (parseInt(a.value) - parseInt(b.value)));

  const tagMap = {};
  for (const { value, name } of tagValues) {
    tagMap[value] = name;
  }
  return tagMap;
}
