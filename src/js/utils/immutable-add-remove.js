function immutableAddRemove(arr, elem, acc = d => d) {
  const index = arr.findIndex(data => acc(data) === acc(elem));
  return ~index
    ? [...arr.slice(0, index), ...arr.slice(index + 1)]
    : [...arr, elem];
}

export default immutableAddRemove;
