/* global d3 */
import enterView from "enter-view";
import loadData from "./load-data";
import Constants from "./constants";
import {
  currentStorySelector,
  nodesSelector,
  linksSelector,
  currentStoryStepYearLookupSelector
} from "./selectors";
import getDynamicFontSize from "./utils/dynamic-font-size";
import immutableAddRemove from "./utils/immutable-add-remove";

import stateChangedKeys from "./utils/state-compare";

const {
  CATEGORIES,
  UNIT,
  ASKED_OF,
  ANSWER_TYPE,
  UID,
  QUESTION,
  AGE_RANGE,
  OPTIONS,
  DEFAULT,
  START_YEAR,
  END_YEAR,
  EVENT,
  MOBILE_BREAKPT,
  START_ACS,
  COLORS,
  sortedCategories,
  years,
  answerTypeLookup,
  unitReverseLookup,
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
  currentYearInView: years[0] - 1, // hack to trigger update on 1790
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
  isMobile: window.innerWidth < MOBILE_BREAKPT,
  appHeight: 0,
  appWidth: 0,
  // tooltipOffsetHeight: 0,
  isFilterMenuOpen: false,
  isInteractiveInView: false
};
const colorScale = d3.scaleOrdinal(COLORS).domain(sortedCategories);

function setState(nextState) {
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
    isMobile: window.innerWidth < MOBILE_BREAKPT
    // tooltipOffsetHeight: getTooltipOffsetHeight()
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
            d3.ascending(a[END_YEAR], b[END_YEAR])
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
        isMobile: window.innerWidth < MOBILE_BREAKPT
        // tooltipOffsetHeight: getTooltipOffsetHeight()
      });
    })
    .catch(console.error);
}

function makeFilters(filters, isFilterMenuOpen, currentYearInView) {
  d3.select(".interactive__filter-toggle")
    .classed("visible", currentYearInView >= years[0])
    .on("click", () => {
      setState({
        isFilterMenuOpen: !isFilterMenuOpen
      });
    });
  const filtersEl = d3
    .select(".interactive__filters")
    .classed("open", isFilterMenuOpen);
  const category = filtersEl
    .selectAll(".interactive__filter")
    .data(filters, d => d.key)
    .join(enter => {
      enter = enter.append("div").attr("class", "interactive__filter");
      enter
        .append("div")
        .attr("class", "interactive__filter_label")
        .text(d => d.key);
      enter.append("div").attr("class", "interactive__filter_multiselect");
      return enter;
    })
    .attr("class", "interactive__filter")
    .attr("tabIndex", -1)
    .on("mousedown", function() {
      if (this === document.activeElement) {
        d3.event.preventDefault();
        this.blur();
      }
    });
  category
    .select(".interactive__filter_multiselect")
    .selectAll(".interactive__filter_multiselect_option")
    .data(d =>
      d.allValues.map(e => ({
        label: d.key === ANSWER_TYPE ? answerTypeLookup[e] : e,
        value: e,
        selected: !!~d.selectedValues.indexOf(e),
        key: d.key
      }))
    )
    .join("div")
    .attr("class", "interactive__filter_multiselect_option")
    .classed("selected", d => d.selected)
    .text(d => d.label)
    .on("mousedown", function(d) {
      d3.event.stopPropagation();
      const filterIndex = filters.findIndex(f => f.key === d.key);
      setState({
        filters: [
          ...filters.slice(0, filterIndex),
          {
            ...filters[filterIndex],
            selectedValues: immutableAddRemove(
              filters[filterIndex].selectedValues,
              d.value
            )
          },
          ...filters.slice(filterIndex + 1)
        ]
      });
    });
}

function makeTooltip({ x, y, d }, isMobile /*, tooltipOffsetHeight*/) {
  const { x: svgX } = d3
    .select(".interactive__svg")
    .node()
    .getBoundingClientRect();
  const color = colorScale(d[CATEGORIES]);
  const imageId = imageFilesLookup[d[UID]];
  const tooltipOffsetHeight = getTooltipOffsetHeight();

  // let listItems = [];
  // let listTitle = "";
  // // these should be mutually exclusive but may not always be
  // if (d[OPTIONS]) {
  //   listItems = d[OPTIONS].split(",");
  //   listTitle = "Options provided";
  // } else if (d[AGE_RANGE]) {
  //   listItems = d[AGE_RANGE].split(",");
  //   listTitle = "Asked of the same demographic group by age range";
  // }
  // if (listItems.length > 11) {
  //   listItems = [...listItems.slice(0, 11), "etc."];
  // }
  d3
    .select(".interactive__tooltip")
    .style(
      "top",
      isMobile ? "auto" : y + tooltipOffsetHeight + 16 + 2 * d.r + "px"
    )
    .style("left", isMobile ? "0px" : x + svgX + 2 * d.r + "px")
    .style("border-color", color)
    // .style("box-shadow", "0px 0px 3px 0px " + color)
    .classed("visible", true)
    .html(`<div class='interactive__tooltip_category' style='color:${color};'>
      ${d[CATEGORIES] === "National origin" ? "Nat'l origin" : d[CATEGORIES]}
    </div>
    <div class='interactive__tooltip_question'>
      ${d[QUESTION]}
    </div>
    ${
      imageId
        ? `<img class='image-question' src='assets/images/questions/${imageId}' >`
        : ""
    }
    `);
  // .html(
  //   `<div class='interactive__tooltip_question' style='border-bottom-color:${color};${getDynamicFontSize(
  //     d[QUESTION]
  //   )}'>${d[QUESTION]}
  //       <div class='interactive__tooltip_question_category' style='background-color:${color};'>${
  //     d[CATEGORIES] === "National origin" ? "Nat'l origin" : d[CATEGORIES]
  //   }</div>
  //     </div>
  //     ${
  //       imageId
  //         ? `<img class='image-question' src='assets/images/questions/${imageId}' >`
  //         : ""
  //     }
  //     <div class='interactive__tooltip_right-col ${imageId ? "" : "dblwide"}'>
  //       <div class='interactive__tooltip_right-col_unit'><img class='image-unit' src='assets/images/icons/census_unit_${
  //         unitReverseLookup[d[UNIT]]
  //       }.png' ><span>${d[UNIT]}</span></div>
  //       ${
  //         d[ASKED_OF]
  //           ? `<div class='interactive__tooltip_right-col_asked-of'>
  //             <img class='image-asked-of' src='assets/images/icons/help-circle.svg' >
  //             <span>${d[ASKED_OF]}<span>
  //           </div>`
  //           : ""
  //       }
  //       <div class='interactive__tooltip_right-col_qtype'><img class='image-qtype' src='assets/images/icons/census_qtype_${
  //         d[ANSWER_TYPE]
  //       }.png' ><span>${answerTypeLookup[d[ANSWER_TYPE]]}</span></div>
  //       ${
  //         listItems.length
  //           ? `<div class='interactive__tooltip_right-col_options'>
  //           ${listTitle}:
  //         <ul class='${isMobile || listItems.length > 10 ? "wrap" : ""}'>
  //           ${listItems.map(d => `<li>-${d.trim()}</li>`).join("")}
  //         </ul>
  //       </div>`
  //           : ""
  //       }
  //       ${
  //         d[UID] === START_ACS
  //           ? `<div class='interactive__tooltip_right-col_notes'>Many questions previously asked on the censes moved to the American Community Survey between 2000 and 2010.</div>`
  //           : ""
  //       }
  //       ${
  //         d[UID].slice(-2) === "_H"
  //           ? `<div class='interactive__tooltip_right-col_notes'>The long form census included around 40 questions about housing infrastructure, condition, size, and value.</div>`
  //           : ""
  //       }
  //     </div>
  //     `
  // );
}

// function makeStoryStep(
//   story,
//   storyStepIndex,
//   isInteractiveInView,
//   isMobile,
//   currentYearInView
// ) {
//   const storyStepEl = d3.select(".interactive__story-step");

//   d3.select(".interactive__story-intro").html(story.storyIntro);
//   storyStepEl.classed(
//     "visible",
//     isMobile ? currentYearInView >= years[0] : isInteractiveInView
//   );

//   const storyStep = story.steps[storyStepIndex];
//   storyStepEl
//     .select(".interactive__story-stepper-dots")
//     .selectAll(".step-dot")
//     .data(story.steps, d => d.key)
//     .join("div")
//     .attr("class", "step-dot")
//     .classed("current", (_, i) => i === storyStepIndex);

//   storyStepEl
//     .select(".interactive__story-step-title")
//     .html(`${storyStep.year}: ${storyStep.label}`);
//   storyStepEl.select(".interactive__story-step-body").html(storyStep.text);
//   storyStepEl.select(".interactive__story-stepper-up").on("click", () => {
//     setState({
//       currentStoryStepIndex:
//         (storyStepIndex - 1 + story.steps.length) % story.steps.length
//     });
//   });
//   storyStepEl.select(".interactive__story-stepper-down").on("click", () => {
//     setState({
//       currentStoryStepIndex: (storyStepIndex + 1) % story.steps.length
//     });
//   });
// }

function makeLegend(isMobile, currentYearInView, currentStory) {
  const currentStoryCategories = currentStory.storyCategories;
  const legendData = colorScale
    .domain()
    .map(d => ({ in: d, out: colorScale(d) }))
    .sort((a, b) =>
      d3.ascending(
        sortedCategories.indexOf(a.in),
        sortedCategories.indexOf(b.in)
      )
    );
  d3.select(".interactive__legend")
    .classed(
      "visible",
      !isMobile &&
        currentYearInView >= years[0] &&
        currentYearInView < years[years.length - 1]
    )
    .selectAll(".interactive__legend_tile")
    .data(legendData)
    .join("div")
    .attr("class", "interactive__legend_tile")
    .style("background-color", d => d.out)
    .classed(
      "out-of-story",
      d =>
        currentStory.key !== DEFAULT && !~currentStoryCategories.indexOf(d.in)
    )
    .text(d => d.in);
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
  const nextYearInView = isEnter ? d : i === 0 ? years[0] - 1 : years[i - 1];
  if (
    (isEnter && d !== currentYearInView) ||
    (!isEnter && d === currentYearInView)
  ) {
    setState({
      currentYearInView: nextYearInView,
      ...(nextStoryStepIndex === currentStoryStepIndex
        ? {}
        : { currentStoryStepIndex: nextStoryStepIndex }),
      ...(nextYearInView === years[0] ? { isFilterMenuOpen: false } : {})
    });
  }
}

function afterFirstDraw() {
  enterView({
    selector: ".interactive",
    enter: function() {
      if (state.isInteractiveInView) return;
      setState({
        isInteractiveInView: true
      });
    },
    exit: function() {
      if (!state.isInteractiveInView) return;
      setState({
        isInteractiveInView: false
      });
    },
    once: false
  });
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

function drawCirclesAndLinks(links, nodes, currentStory) {
  const currentStoryCategories = currentStory.storyCategories;
  d3.select(".interactive_g_links")
    .selectAll(".line")
    .data(links, d => d.Source + d.Target)
    .join(
      enter =>
        enter
          .append("path")
          .attr("d", d => d.svgPath)
          .attr("stroke-dasharray", function() {
            return this.getTotalLength();
          })
          .attr("stroke-dashoffset", function() {
            return this.getTotalLength();
          })
          .call(e => e.transition().attr("stroke-dashoffset", 0)),
      update =>
        update.call(u =>
          u
            .transition()
            .attr("d", d => d.svgPath)
            .attr("stroke-dashoffset", 0)
        ),
      exit =>
        exit.call(e =>
          e
            .transition()
            .attr("stroke-dashoffset", function() {
              return this.getTotalLength();
            })
            .remove()
        )
    )
    .attr("class", "line")
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
          .call(e => e.transition().attr("r", d => d.r)),
      update =>
        update.call(u =>
          u
            .transition()
            .attr("cx", d => d.x)
            .attr("r", d => d.r)
        ),
      exit =>
        exit.call(e =>
          e
            .transition()
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
    .classed(
      "out-of-story",
      d =>
        currentStory.key !== DEFAULT &&
        !~currentStoryCategories.indexOf(d[CATEGORIES])
    )
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
  isMobile,
  svgWidth,
  story,
  storyStepIndex,
  storyStepYearLookup,
  yearInView
) {
  d3.select(".interactive__story-intro")
    .classed("populated", story.key !== DEFAULT)
    .html(story.storyIntro);
  d3.select(".interactive__labels")
    .selectAll(".label")
    .data(years)
    .join("div")
    .attr("class", "label")
    .classed("has-story-step", d => storyStepYearLookup.has(d))
    .classed("current", d => d === yearInView)
    .style("top", d => yScale(d) - 40 + "px") // vertically center
    .style("left", isMobile ? svgWidth / 2 : 0 + "px")
    .html(d => {
      const storyStep = storyStepYearLookup.has(d)
        ? storyStepYearLookup.get(d)
        : null;
      return `<div>${d}</div>
      <div class='story-step'>
        <div class='story-step-header'>
          ${storyStep && storyStep.label}
        </div>
        <div class='story-step-body'>
          ${storyStep && storyStep.text}
        </div>
        <div class='story-step-down'>
          <img src='assets/images/icons/arrow-down.svg'>
          Next
        </div>
        <div class='story-step-up'>
          <img src='assets/images/icons/arrow-up.svg'>
          Back to top
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
    setState({
      currentStoryStepIndex: 0
    });
    // d3.select(".interactive")
    //   .node()
    //   .scrollIntoView({ behavior: "smooth" });
  });
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
    isMobile,
    // tooltipOffsetHeight,
    isFilterMenuOpen,
    isInteractiveInView
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
    changedKeys.currentYearInView ||
    changedKeys.currentStoryKey
  ) {
    const currentStory = currentStorySelector(state);
    drawCirclesAndLinks(links, nodes, currentStory);
  }

  /**
   * FILTERS
   */
  if (
    changedKeys.filters ||
    changedKeys.isFilterMenuOpen ||
    changedKeys.currentYearInView
  ) {
    makeFilters(filters, isFilterMenuOpen, currentYearInView);
  }

  /**
   * TOOLTIP
   */
  if (
    changedKeys.isMobile ||
    changedKeys.tooltip ||
    // changedKeys.tooltipOffsetHeight ||
    changedKeys.currentYearInView
  ) {
    d3.select(".interactive_g_circles")
      .selectAll("circle.node")
      .classed("active", d => tooltip.d && d[UID] === tooltip.d[UID])
      .classed("inactive", d => tooltip.d && d[UID] !== tooltip.d[UID]);
    // hide tooltip if user scrolls or clicks away
    if (changedKeys.currentYearInView || !tooltip.d) {
      d3.select(".interactive__tooltip").classed("visible", false);
    } else {
      makeTooltip(tooltip, isMobile /*, tooltipOffsetHeight */);
    }
  }

  /**
   * LEGEND
   */
  if (
    changedKeys.isMobile ||
    changedKeys.currentYearInView ||
    changedKeys.currentStoryKey
  ) {
    const currentStory = currentStorySelector(state);
    makeLegend(isMobile, currentYearInView, currentStory);
  }

  /**
   * STORY STEP
   */
  if (
    firstDraw ||
    changedKeys.currentStoryKey ||
    changedKeys.currentStoryStepIndex ||
    changedKeys.isInteractiveInView ||
    changedKeys.isMobile ||
    changedKeys.currentYearInView ||
    changedKeys.appHeight
  ) {
    const currentStory = currentStorySelector(state);
    const currentStoryStepYearLookup = currentStoryStepYearLookupSelector(
      state
    );
    makeLabelsAndStoryStep(
      yScale,
      isMobile,
      svgWidth,
      currentStory,
      currentStoryStepIndex,
      currentStoryStepYearLookup,
      currentYearInView
    );
    // makeStoryStep(
    //   currentStory,
    //   currentStoryStepIndex,
    //   isInteractiveInView,
    //   isMobile,
    //   currentYearInView
    // );
    // if (firstDraw) {
    //   d3.select(".interactive__img").attr(
    //     "src",
    //     `assets/images/${currentStoryKey}.jpg`
    //   );
    // }
    if (changedKeys.currentStoryKey) {
      d3.select(".story-menu_dropdown")
        .selectAll(".story-menu_dropdown_option")
        .classed("selected", d => d.key === currentStoryKey);
      // d3.select(".interactive")
      //   .node()
      //   .scrollIntoView({ behavior: "smooth", block: "end" });
      // d3.select(".interactive__img").attr(
      //   "src",
      //   `assets/images/${currentStoryKey}.jpg`
      // );
    } else if (changedKeys.currentStoryStepIndex) {
      d3.selectAll(".interactive__labels .label")
        .filter(d => d === currentStory.steps[currentStoryStepIndex].year)
        .node()
        .scrollIntoView({
          behavior: "smooth",
          block: "end",
          inline: "center"
        });
    }
  }

  /**
   * HISTORY FLAGS
   * VIZ LABELS
   */
  // if (changedKeys.currentYearInView) {
  //   d3.selectAll(".interactive__labels .label");
  // }
  if (changedKeys.appHeight || changedKeys.isMobile) {
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

  if (firstDraw) {
    firstDraw = false;
    afterFirstDraw();
  }
}

export default { init, resize };
