/* global d3 */
import enterView from "enter-view";
import loadData from "./load-data";
import Constants from "./constants";
import {
  currentStorySelector,
  nodesSelector,
  linksSelector,
  currentStoryStepYearLookupSelector,
  legendDataSelector
} from "./selectors";
import immutableAddRemove from "./utils/immutable-add-remove";
import isMobileUtil from "./utils/is-mobile";
import stateChangedKeys from "./utils/state-compare";

const {
  CATEGORIES,
  UNIT,
  ASKED_OF,
  ANSWER_TYPE,
  UID,
  QUESTION,
  DEFAULT,
  AGE_RANGE,
  START_YEAR,
  END_YEAR,
  EVENT,
  MOBILE_BREAKPT,
  COLORS,
  sortedCategories,
  years,
  answerTypeLookup,
  imageFilesLookup
} = Constants;

let firstDraw = true;
let state = {
  dataQuestions: [],
  dataLinks: [],
  dataHistory: [],
  storyMenu: [],

  currentStoryKey: DEFAULT,
  currentStoryStepIndex: 0,
  currentYearInView: years[0],
  filters: [
    {
      key: CATEGORIES,
      allValues: [],
      selectedValues: []
    },
    {
      key: UNIT,
      allValues: [],
      selectedValues: []
    },
    {
      key: ASKED_OF,
      allValues: [],
      selectedValues: []
    },
    {
      key: ANSWER_TYPE,
      allValues: [],
      selectedValues: []
    }
  ],
  tooltip: {
    x: 0,
    y: 0,
    d: null
  },
  isMobile: window.innerWidth < MOBILE_BREAKPT || isMobileUtil.any(),
  appHeight: 0,
  appWidth: 0
  // isFilterMenuOpen: false
};
const colorScale = d3.scaleOrdinal(COLORS).domain(sortedCategories);

function setState(nextState) {
  // console.log(nextState);
  const prevState = { ...state };
  state = { ...state, ...nextState };
  update(prevState);
}

function getTooltipOffsetHeight() {
  return Array.from(document.querySelectorAll(".tooltip-offset")).reduce(
    (t, v) => t + v.getBoundingClientRect().height,
    0
  );
}

function resize() {
  setState({
    appHeight: window.innerHeight,
    appWidth: window.innerWidth,
    isMobile: window.innerWidth < MOBILE_BREAKPT || isMobileUtil.any()
  });
}

function init() {
  loadData(["questions.csv", "links.csv", "storyMenu.json", "history.csv"])
    .then(([rawQuestions, rawLinks, { storyMenu }, history]) => {
      rawQuestions.forEach(e => {
        if (e.Categories.indexOf(", ") !== -1) {
          e.Categories = "[Multiple]";
        }
        if (e.Categories.indexOf(" - ") !== -1) {
          e.Categories = e.Categories.split(" - ")[0];
        }
      });
      let stack = [];
      history
        .sort(
          (a, b) =>
            d3.ascending(a[START_YEAR], b[START_YEAR]) ||
            d3.ascending(b[END_YEAR], a[END_YEAR])
        )
        .forEach(e => {
          const i = stack.findIndex(
            s => s[END_YEAR] <= e[START_YEAR] && s[START_YEAR] < e[START_YEAR]
          );
          e.xIndex = i === -1 ? stack.length : i;
          stack[e.xIndex] = e;
        });
      setState({
        storyMenu: storyMenu.map(s => ({
          ...s,
          steps: s.steps.map(p => ({ ...p, year: +p.year }))
        })),
        dataQuestions: rawQuestions
          .filter(e => e[CATEGORIES] !== "[Admin.]")
          .sort(
            (a, b) =>
              d3.ascending(+a.Year, +b.Year) ||
              d3.ascending(
                sortedCategories.indexOf(a.Categories),
                sortedCategories.indexOf(b.Categories)
              )
          ),
        dataLinks: rawLinks,
        dataHistory: history.map(d => ({
          ...d,
          [START_YEAR]: +d[START_YEAR],
          [END_YEAR]: +d[END_YEAR]
        })),
        filters: state.filters.map(f => {
          let allValues = Array.from(
            new Set(rawQuestions.map(d => d[f.key]).filter(d => !!d))
          ).sort();
          return {
            ...f,
            allValues,
            selectedValues: allValues
          };
        }),
        appHeight: window.innerHeight,
        appWidth: window.innerWidth,
        isMobile: window.innerWidth < MOBILE_BREAKPT || isMobileUtil.any()
      });
    })
    .catch(console.error);
}

// function makeFilters(filters, isFilterMenuOpen, currentYearInView) {
//   d3.select(".interactive__filter-toggle")
//     .classed("visible", currentYearInView >= years[0])
//     .on("click", () => {
//       setState({
//         isFilterMenuOpen: !isFilterMenuOpen
//       });
//     });
//   const filtersEl = d3
//     .select(".interactive__filters")
//     .classed("open", isFilterMenuOpen);
//   const category = filtersEl
//     .selectAll(".interactive__filter")
//     .data(filters, d => d.key)
//     .join(enter => {
//       enter = enter.append("div").attr("class", "interactive__filter");
//       enter
//         .append("div")
//         .attr("class", "interactive__filter_label")
//         .text(d => d.key);
//       enter.append("div").attr("class", "interactive__filter_multiselect");
//       return enter;
//     })
//     .attr("class", "interactive__filter")
//     .attr("tabIndex", -1)
//     .on("mousedown", function() {
//       if (this === document.activeElement) {
//         d3.event.preventDefault();
//         this.blur();
//       }
//     });
//   category
//     .select(".interactive__filter_multiselect")
//     .selectAll(".interactive__filter_multiselect_option")
//     .data(d =>
//       d.allValues.map(e => ({
//         label: d.key === ANSWER_TYPE ? answerTypeLookup[e] : e,
//         value: e,
//         selected: !!~d.selectedValues.indexOf(e),
//         key: d.key
//       }))
//     )
//     .join("div")
//     .attr("class", "interactive__filter_multiselect_option")
//     .classed("selected", d => d.selected)
//     .text(d => d.label)
//     .on("mousedown", function(d) {
//       d3.event.stopPropagation();
//       const filterIndex = filters.findIndex(f => f.key === d.key);
//       setState({
//         filters: [
//           ...filters.slice(0, filterIndex),
//           {
//             ...filters[filterIndex],
//             selectedValues: immutableAddRemove(
//               filters[filterIndex].selectedValues,
//               d.value
//             )
//           },
//           ...filters.slice(filterIndex + 1)
//         ]
//       });
//     });
// }

const tooltipConstant = r => r + (r / 2) * Math.sqrt(2) + 8 * Math.sqrt(2);
function makeTooltip({ x, y, d }, isMobile, storyKey) {
  const { x: svgX } = d3
    .select(".interactive__svg")
    .node()
    .getBoundingClientRect();
  const color = colorScale(d[CATEGORIES]);
  const imageId = imageFilesLookup[d[UID]];
  const tooltipOffsetHeight = getTooltipOffsetHeight();
  const yMargins = storyKey === DEFAULT ? 16 : 32;

  d3
    .select(".interactive__tooltip")
    .style(
      "top",
      isMobile
        ? "auto"
        : y + tooltipOffsetHeight + yMargins + tooltipConstant(d.r) + "px"
    )
    .style("left", isMobile ? "0px" : x + svgX + tooltipConstant(d.r) + "px")
    .style("border-color", color)
    .classed("visible", true)
    .html(`<div class='interactive__tooltip_tail' style='border-color:${color};'></div>
    <div class='interactive__tooltip_category' style='color:${color};'>
      ${d[CATEGORIES] === "National origin" ? "Nat'l origin" : d[CATEGORIES]}
    </div>
    ${
      d[AGE_RANGE]
        ? `<div class='interactive__tooltip_category' style='color:${color};'>By age range (${
            d[AGE_RANGE].split(",").length
          } brackets)</div>`
        : ""
    }
    <div class='interactive__tooltip_question'>
      ${d[QUESTION]}
    </div>
    ${
      imageId
        ? `<img class='image-question' src='assets/images/questions/${imageId}' >`
        : ""
    }
    `);
}

function onEnterView(el) {
  const isEnter = this.direction === "enter";
  const { currentYearInView, currentStoryKey, currentStoryStepIndex } = state;
  const currentStory = currentStorySelector(state);
  const [d] = d3.select(el).data();
  const i = years.indexOf(d);
  let nextStoryStepIndex;
  if (isEnter) {
    // when a new year enters into view
    // advance to the next story step IFF
    // - there is a story
    // - we are not at the end of the story
    // - new year is greater/equal to next story step's year
    nextStoryStepIndex =
      currentStoryKey !== "" &&
      currentStoryStepIndex !== null &&
      currentStoryStepIndex < currentStory.steps.length - 1 &&
      d >= currentStory.steps[currentStoryStepIndex + 1].year
        ? currentStoryStepIndex + 1
        : currentStoryStepIndex;
  } else {
    // when a year exits view
    // same idea but IFF
    // - we are not at the beginning of the story
    // - exiting year is less than/equal to current story step's year
    nextStoryStepIndex =
      currentStoryKey !== "" &&
      currentStoryStepIndex !== null &&
      currentStoryStepIndex > 0 &&
      d <= currentStory.steps[currentStoryStepIndex].year
        ? currentStoryStepIndex - 1
        : currentStoryStepIndex;
  }
  const nextYearInView = isEnter ? d : i === 0 ? years[0] : years[i - 1];
  if (
    (isEnter && d > currentYearInView) ||
    (!isEnter && d < currentYearInView)
  ) {
    // only update state with new year
    // if scrolling has entered a later year
    // or exited an earlier year
    setState({
      currentYearInView: nextYearInView,
      ...(nextStoryStepIndex === currentStoryStepIndex
        ? {}
        : { currentStoryStepIndex: nextStoryStepIndex })
      // ...(nextYearInView === years[0] ? { isFilterMenuOpen: false } : {})
    });
  }
}

function afterFirstDraw() {
  enterView({
    selector: ".label",
    enter: onEnterView.bind({ direction: "enter" }),
    exit: onEnterView.bind({ direction: "exit" }),
    offset: 0.5,
    once: false
  });
}

function makeStoryDropdownMenu(storyMenu, currentStoryKey) {
  const dropdown = d3
    .select(".story-menu_dropdown")
    .on("mousedown", function() {
      if (this === document.activeElement) {
        d3.event.preventDefault();
        this.blur();
      }
    });
  dropdown
    .selectAll(".story-menu_dropdown_option")
    .data(storyMenu)
    .join("div")
    .attr("class", "story-menu_dropdown_option")
    .classed("selected", d => d.key === currentStoryKey)
    .text(d => d.label)
    .on("mousedown", function(d) {
      setState({
        currentStoryKey: d.key,
        currentStoryStepIndex: 0
      });
    });

  d3.select(".interactive__story-restart").on("click", function() {
    setState({
      currentStoryKey: DEFAULT,
      currentStoryStepIndex: 0
    });
  });
}

function drawCirclesAndLinks(links, nodes /*, currentStory*/) {
  // const currentStoryCategories = currentStory.storyCategories;
  d3.select(".interactive_g_links")
    .selectAll(".line")
    .data(links, d => d.Source + d.Target)
    .join(
      enter =>
        enter
          .append("path")
          .attr("class", "line")
          .attr("d", d => d.svgPath)
          .attr("stroke-dasharray", function() {
            return this.getTotalLength();
          })
          .attr("stroke-dashoffset", function() {
            return this.getTotalLength();
          })
          .call(e =>
            e
              .transition()
              .duration(500)
              .delay(d => (d.indexByYear || 1) * 3)
              .attr("stroke-dashoffset", 0)
          ),
      update =>
        update.call(u =>
          u
            .transition()
            .duration(500)
            .delay(d => (d.indexByYear || 1) * 3)
            .attr("d", d => d.svgPath)
            .attr("stroke-dashoffset", 0)
        ),
      exit =>
        exit.call(e =>
          e
            .transition()
            .duration(500)
            .delay(d => (d.indexByYear || 1) * 3)
            .attr("stroke-dashoffset", function() {
              return this.getTotalLength();
            })
            .remove()
        )
    )
    .attr("stroke-width", 2)
    .attr("stroke", d => colorScale(d.Category));

  const circles = d3.select(".interactive_g_circles");
  circles
    .selectAll("circle.node")
    .data(Array.from(nodes.values()), d => d.UID)
    .join(
      enter =>
        enter
          .append("circle")
          .attr("data-id", d => d[UID])
          .attr("class", "node")
          .attr("cx", d => d.x)
          .attr("r", 0)
          .call(e =>
            e
              .transition()
              .duration(500)
              .delay(d => (d.indexByYear || 1) * 3)
              .attr("r", d => d.r)
          ),
      update =>
        update.call(u =>
          u
            .transition()
            .duration(500)
            .delay(d => (d.indexByYear || 1) * 3)
            .attr("cx", d => d.x)
            .attr("r", d => d.r)
        ),
      exit =>
        exit.call(e =>
          e
            .transition()
            .duration(500)
            .delay(d => (d.indexByYear || 1) * 3)
            .attr("r", 0)
            .remove()
        )
    )
    .attr("cy", d => d.y)
    .attr("fill", d =>
      d["Age range"] ? "url(#stripe)" : colorScale(d[CATEGORIES])
    )
    .attr("stroke", d => colorScale(d[CATEGORIES]))
    .attr("stroke-width", d => (d["Age range"] ? 2 : 0))
    // TODO decide if we want this
    // .classed(
    //   "out-of-story",
    //   d =>
    //     currentStory.key !== DEFAULT &&
    //     !~currentStoryCategories.indexOf(d[CATEGORIES])
    // )
    .on("mouseenter", function(d) {
      const { x, y } = this.getBBox();
      setState({
        tooltip: {
          x,
          y,
          d
        }
      });
    })
    .on("mouseleave", () => {
      setState({ tooltip: { ...state.tooltip, d: null } });
    });
}

function makeLabelsAndStoryStep(
  yScale,
  story,
  storyStepIndex,
  storyStepYearLookup,
  yearInView,
  legendData
) {
  const keys = Array.from(storyStepYearLookup.keys());
  d3.select(".interactive__story-intro")
    .classed("populated", story.key !== DEFAULT)
    .html(story.storyIntro);
  d3.select(".interactive__img")
    .classed("populated", story.key !== DEFAULT)
    .attr("src", story.img && `assets/images/${story.img}.jpg`);
  d3.select(".interactive__labels")
    .selectAll(".label")
    .data(years)
    .join("div")
    .attr("class", d => `label year-${d}`)
    .classed("has-story-step", d => storyStepYearLookup.has(d))
    .classed("current", d => d === yearInView) // initialize
    .style("top", d => yScale(d) - 40 + "px") // vertically center
    .html(d => {
      const storyStep = storyStepYearLookup.has(d)
        ? storyStepYearLookup.get(d)
        : null;
      const yearLegendData = legendData.get(d);
      return `<div class='year'>${d}</div>
      <div class='story-step'>
        <div class='story-step-header'>
          ${storyStep && storyStep.label}
        </div>
        <div class='story-step-body'>
          ${storyStep && storyStep.text}
        </div>
        ${
          d !== keys[keys.length - 1]
            ? `<div class='story-step-down'>
          <img src='assets/images/icons/arrow-down.svg'>
          Next
        </div>`
            : ""
        }
        ${
          d !== keys[0]
            ? `<div class='story-step-up'>
          <img src='assets/images/icons/arrow-up.svg'>
          Back to top
        </div>`
            : ""
        }
        <div class='step-legend'>
          ${
            yearLegendData
              ? Array.from(yearLegendData.keys())
                  .map(
                    k =>
                      `<div class='step-legend-row'>
                        <div class='step-legend-row-circle' style='background-color:${colorScale(
                          k
                        )};'></div>
                        <div class='step-legend-row-term'>${k}</div>
                        <div class='step-legend-row-number'>${yearLegendData.get(
                          k
                        )}</div>
                      </div>`
                  )
                  .join("")
              : ""
          }
        </div>
      </div>
    `;
    });
  d3.selectAll(".story-step-down").on("click", () => {
    setState({
      currentStoryStepIndex: Math.min(
        storyStepIndex + 1,
        story.steps.length - 1
      )
    });
  });
  d3.selectAll(".story-step-up").on("click", () => {
    d3.select(`.interactive__labels .label.year-${years[0]}`)
      .node()
      .scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center"
      });
  });
}

function makeHistory(dataHistory, yScale) {
  d3.select(".interactive__history")
    .selectAll(".interactive__history_tick")
    .data(d3.range(dataHistory[0][START_YEAR], years[years.length - 1]))
    .join("div")
    .attr("class", "interactive__history_tick")
    .style("top", d => yScale(d) + "px");
  d3.select(".interactive__history")
    .selectAll(".interactive__history_flag")
    .data(dataHistory)
    .join("div")
    .attr("class", "interactive__history_flag")
    .style("top", d => yScale(d[START_YEAR]) + "px")
    .style("left", d => 10 * d.xIndex + "px")
    .classed("one-year-only", d => d[START_YEAR] >= d[END_YEAR])
    .classed("y-offset", d => d[START_YEAR] === 1990 && d[END_YEAR] === 1991)
    .style(
      "height",
      d =>
        (d[START_YEAR] >= d[END_YEAR]
          ? 0
          : yScale(d[END_YEAR]) - yScale(d[START_YEAR])) +
        1 +
        "px"
    )
    .html(
      d => `<div class='interactive__history_flag_years'>${d[START_YEAR]}${
        d[END_YEAR] > d[START_YEAR] ? ` - ${d[END_YEAR]}` : ""
      }</div>
            <div class='interactive__history_flag_event'>${d[EVENT]}</div>
      `
    );
}

function update(prevState) {
  const {
    currentStoryKey,
    currentStoryStepIndex,
    currentYearInView,
    filters,
    dataHistory,
    appHeight,
    appWidth,
    storyMenu,
    tooltip,
    isMobile
  } = state;
  const svgHeight = 8.333 * appHeight;
  const svgWidth = isMobile ? appWidth : appWidth * (3 / 7);
  const changedKeys = stateChangedKeys(prevState, state);

  /**
   * STORY NAVIGATION
   */
  if (firstDraw) {
    makeStoryDropdownMenu(storyMenu, currentStoryKey, filters);
  }

  /**
   * NODES
   * LINKS
   */
  const yScale = d3
    .scaleLinear()
    .domain([years[0], years[years.length - 1]])
    .range([appHeight / 6, svgHeight - appHeight / 6]);
  const nodes = nodesSelector(state, { svgWidth, yScale });
  const links = linksSelector(state, { svgWidth, yScale });

  /**
   * DRAWING VIZ
   */
  if (changedKeys.appHeight || changedKeys.appWidth || changedKeys.isMobile) {
    d3.select(".interactive__svg")
      .attr("height", svgHeight)
      .attr("width", svgWidth);
  }

  if (
    changedKeys.dataQuestions ||
    changedKeys.dataLinks ||
    changedKeys.filters ||
    changedKeys.appHeight ||
    changedKeys.appWidth ||
    changedKeys.isMobile ||
    changedKeys.currentYearInView
    // || changedKeys.currentStoryKey
  ) {
    // const currentStory = currentStorySelector(state);
    drawCirclesAndLinks(links, nodes /*, currentStory*/);
  }

  /**
   * TOOLTIP
   */
  if (
    changedKeys.isMobile ||
    changedKeys.tooltip ||
    changedKeys.currentYearInView
  ) {
    d3.selectAll(".annotation").style("opacity", 0);
    d3.select(".interactive_g_circles")
      .selectAll("circle.node")
      .classed("active", d => tooltip.d && d[UID] === tooltip.d[UID])
      .classed("inactive", d => tooltip.d && d[UID] !== tooltip.d[UID]);
    d3.select(".interactive_g_links")
      .selectAll("path.line")
      .classed(
        "inactive",
        d =>
          tooltip.d &&
          d.Source !== tooltip.d[UID] &&
          d.Target !== tooltip.d[UID]
      );
    // if user scrolls (mobile) or taps/mouses away,
    // hide tooltip and reset nodes
    if (changedKeys.currentYearInView || !tooltip.d) {
      console.log("here");
      d3.select(".interactive__tooltip").classed("visible", false);
      d3.select(".interactive_g_links")
        .selectAll("path.line")
        .classed("inactive", false);
      d3.select(".interactive_g_circles")
        .selectAll("circle.node")
        .classed("active", false)
        .classed("inactive", false);
    } else {
      makeTooltip(tooltip, isMobile, currentStoryKey);
    }
  }
  /**
   * STORY STEP
   */
  if (
    firstDraw ||
    changedKeys.currentStoryKey ||
    changedKeys.currentStoryStepIndex ||
    changedKeys.isMobile ||
    changedKeys.appHeight
  ) {
    const currentStory = currentStorySelector(state);
    const currentStoryStepYearLookup = currentStoryStepYearLookupSelector(
      state
    );
    const legendData = legendDataSelector(state);
    makeLabelsAndStoryStep(
      yScale,
      currentStory,
      currentStoryStepIndex,
      currentStoryStepYearLookup,
      currentYearInView,
      legendData
    );
    if (changedKeys.currentStoryKey) {
      d3.select(".story-menu_dropdown")
        .selectAll(".story-menu_dropdown_option")
        .classed("selected", d => d.key === currentStoryKey);
      d3.select(".interactive__story-intro")
        .node()
        .scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "center"
        });
    } else if (
      changedKeys.currentStoryStepIndex &&
      !changedKeys.currentYearInView
    ) {
      // only scroll to next story
      // when state change triggered by clicking Next
      // not after scrolling a new year into view
      d3.select(
        `.interactive__labels .label.year-${currentStory.steps[currentStoryStepIndex].year}`
      )
        .node()
        .scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "center"
        });
    }
  }
  if (changedKeys.currentYearInView) {
    d3.select(".interactive__labels")
      .selectAll(".label")
      .classed("current", d => d === currentYearInView);
  }

  /**
   * HISTORY FLAGS
   * VIZ LABELS
   */
  if (changedKeys.appHeight || changedKeys.isMobile) {
    makeHistory(dataHistory, yScale);
  }

  if (firstDraw) {
    firstDraw = false;
    afterFirstDraw();
  }
}

export default { init, resize };
