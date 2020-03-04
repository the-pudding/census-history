import Constants from "../constants";
const { UID } = Constants;

const areListsEqual = (a, b) => {
  return a.length === b.length && a.reduce((t, v) => t && b.includes(v), true);
};

const areFiltersEqual = (a, b) => {
  return a.reduce((t, leftFilter) => {
    const rightFilter = b.find(d => d.key === leftFilter.key);
    if (!rightFilter) return false;
    return (
      t && areListsEqual(leftFilter.selectedValues, rightFilter.selectedValues)
    );
  }, true);
};

const areTooltipsEqual = (a, b) =>
  (a.d === null && b.d === null) || (a.d && b.d && a.d[UID] === b.d[UID]);

const stateChangedKeys = (prevState, nextState) => {
  let changedKeys = {};
  for (let k in prevState) {
    changedKeys[k] =
      (k === "filters" && !areFiltersEqual(prevState[k], nextState[k])) ||
      (k === "tooltip" && !areTooltipsEqual(prevState[k], nextState[k])) ||
      prevState[k] !== nextState[k];
  }
  return changedKeys;
};

export default stateChangedKeys;
