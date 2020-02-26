import { rollup, max } from "d3-array";
// TODO actually implement reselect

export const qsByYearLookupSelector = questions =>
  rollup(
    questions,
    values => values.length,
    d => d.Year
  );

export const maxYearsSelector = questions =>
  max(qsByYearLookupSelector(questions), d => d[1]);

export const currentStorySelector = state =>
  state.storyMenu.find(d => d.key === state.currentStoryKey);
