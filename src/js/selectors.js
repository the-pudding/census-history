import { rollup, max } from "d3-array";
import { createSelector } from "reselect";
import getIthPoint from "./utils/get-ith-point";
import makeSvgPath from "./utils/make-svg-path";
import Constants from "./constants";
const { YEAR, UID, AGE_RANGE, CATEGORIES, START_ACS } = Constants;

export const dataQuestionsSelector = state => state.dataQuestions;
export const dataLinksSelector = state => state.dataLinks;
export const filtersSelector = state => state.filters;
export const currentStorySelector = state =>
  state.storyMenu.find(d => d.key === state.currentStoryKey);
export const appHeightSelector = state => state.appHeight;
export const svgWidthSelector = (state, props) => props.svgWidth;
export const yScaleSelector = (state, props) => props.yScale;
export const currentYearInViewSelector = state => state.currentYearInView;
export const isMobileSelector = state => state.isMobile;

export const interimDataQuestionsSelector = createSelector(
  dataQuestionsSelector,
  filtersSelector,
  currentYearInViewSelector,
  (questions, filters, currentYearInView) => {
    const interimDataQuestions = questions.slice().filter(
      d =>
        d[YEAR] <= currentYearInView + 10 && // stay one decade ahead
        filters.reduce(
          (acc, f) =>
            acc && (d[f.key] === "" || f.selectedValues.indexOf(d[f.key]) > -1),
          true
        )
    );
    // only works if dataQuestions is sorted by Year
    let indexByYear = 0;
    let year = questions[0][YEAR];
    interimDataQuestions.forEach(e => {
      if (e[UID] === START_ACS) {
        return;
      }
      if (e[YEAR] === year) {
        e.indexByYear = indexByYear;
      } else {
        e.indexByYear = indexByYear = 0;
        year = e[YEAR];
      }
      indexByYear++;
    });
    return interimDataQuestions;
  }
);

export const qsByYearLookupSelector = createSelector(
  interimDataQuestionsSelector,
  questions =>
    rollup(
      questions,
      values => values.length,
      d => d[YEAR]
    )
);

export const maxYearsSelector = createSelector(
  interimDataQuestionsSelector,
  questions => max(qsByYearLookupSelector(questions), d => d[1])
);

// define xScale after indexByYear has been assigned
export const xScaleSelector = createSelector(
  svgWidthSelector,
  qsByYearLookupSelector,
  isMobileSelector,
  (svgWidth, qsByYearLookup, isMobile) => {
    const m1 = isMobile ? 0.05 : 0.15;
    const m2 = isMobile ? 0.8 : 0.7;
    return d =>
      m1 * svgWidth +
      m2 * svgWidth * ((1 + d.indexByYear) / (1 + qsByYearLookup.get(d[YEAR])));
  }
);

export const currentStoryStepYearLookupSelector = createSelector(
  currentStorySelector,
  currentStory =>
    rollup(
      currentStory.steps,
      d => d[0],
      d => d.year
    )
);

// position questions that are in filter
export const nodesSelector = createSelector(
  interimDataQuestionsSelector,
  appHeightSelector,
  qsByYearLookupSelector,
  svgWidthSelector,
  xScaleSelector,
  yScaleSelector,
  (questions, appHeight, qsByYearLookup, svgWidth, xScale, yScale) =>
    new Map(
      questions.map(d => {
        let x, y, r;
        if (d[UID] === START_ACS) {
          x = 0.9 * svgWidth;
          y = yScale(d[YEAR]) - appHeight / 6;
          r = 10;
        } else if (d[UID].slice(-2) === "_H") {
          x = 0.9 * svgWidth;
          y = yScale(d[YEAR]);
          r = 10;
        } else {
          x = xScale(d);
          y = yScale(d[YEAR]);
          r = Math.min(125, 180 / qsByYearLookup.get(d[YEAR]));
        }
        return [
          d[UID],
          {
            ...d,
            x,
            y,
            r
          }
        ];
      })
    )
);

export const miniNodesSelector = createSelector(
  interimDataQuestionsSelector,
  nodesSelector,
  (questions, nodes) =>
    questions
      .filter(d => d[AGE_RANGE])
      .map(d => {
        const range = d[AGE_RANGE].split(",");
        const n = range.length;
        const { x, y, r } = nodes.get(d[UID]);
        return range.map((e, i) => {
          const [xi, yi] = getIthPoint(i, n, r - r / n);
          return {
            value: e.trim(),
            x: x + xi,
            y: y + yi,
            r: r / n
          };
        });
      })
      .flat()
);

export const linksSelector = createSelector(
  dataLinksSelector,
  nodesSelector,
  svgWidthSelector,
  (links, nodes, svgWidth) =>
    links
      .filter(d => nodes.has(d.Source) && nodes.has(d.Target))
      .map(d => {
        // use Category from source node instead of Links file
        const { x: sourceX, y: sourceY, [CATEGORIES]: Category } = nodes.get(
          d.Source
        );
        const { x: targetX, y: targetY } = nodes.get(d.Target);
        if (Category.indexOf(", ") !== -1) {
          Category = "[Multiple]";
        }
        if (Category.indexOf(" - ") !== -1) {
          Category = Category.split(" - ")[0];
        }
        const svgPath = makeSvgPath(
          sourceX,
          sourceY,
          targetX,
          targetY,
          +d.Target.slice(0, 4) - +d.Source.slice(0, 4) > 10,
          svgWidth,
          d.Target === START_ACS
        );
        return { ...d, sourceX, sourceY, targetX, targetY, Category, svgPath };
      })
);
