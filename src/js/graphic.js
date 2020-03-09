/* global d3 */
import enterView from "enter-view";
import loadData from "./load-data";
import Constants from "./constants";
import {
  currentStorySelector,
  nodesSelector,
  miniNodesSelector,
  linksSelector
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
  MARGIN,
  MOBILE_BREAKPT,
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
  isFilterMenuOpen: false,
  isInteractiveInView: false
};
const colorScale = d3.scaleOrdinal([...d3.schemeSet1, ...d3.schemeSet2]);

function setState(nextState) {
  // console.log(nextState);
  const prevState = { ...state };
  state = { ...state, ...nextState };
  update(prevState);
}

function resize() {
  setState({
    appHeight: window.innerHeight,
    appWidth: window.innerWidth,
    isMobile: window.innerWidth < MOBILE_BREAKPT
  });
}

function init() {
  loadData(["questions.csv", "links.csv", "storyMenu.json", "history.csv"])
    .then(([rawQuestions, rawLinks, { storyMenu }, history]) => {
      rawQuestions
        .sort(
          (a, b) =>
            d3.ascending(+a.Year, +b.Year) ||
            d3.ascending(
              sortedCategories.indexOf(a.Categories),
              sortedCategories.indexOf(b.Categories)
            )
        )
        .forEach(e => {
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
        dataQuestions: rawQuestions,
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

function makeTooltip({ x, y, d }, isMobile) {
  if (d) {
    const { x: svgX } = d3
      .select(".interactive__svg")
      .node()
      .getBoundingClientRect();
    const color = colorScale(d[CATEGORIES]);
    const imageId = imageFilesLookup[d[UID]];

    let listItems = [];
    let listTitle = "";
    // these should be mutually exclusive but may not always be
    if (d[OPTIONS]) {
      listItems = d[OPTIONS].split(",");
      listTitle = "Options provided";
    } else if (d[AGE_RANGE]) {
      listItems = d[AGE_RANGE].split(",");
      listTitle = "Age categories";
    }
    d3.select(".interactive__tooltip")
      .style("top", isMobile ? "auto" : y + 200 + state.appHeight / 3 + "px")
      .style("left", isMobile ? "0px" : x + svgX - 150 + "px")
      .style("border-color", color)
      .style("box-shadow", "0px 0px 3px 0px " + color)
      .classed("visible", true)
      .html(
        `<div class='interactive__tooltip_question' style='border-bottom-color:${color};${getDynamicFontSize(
          d[QUESTION]
        )}'>${d[QUESTION]}</div>
        ${
          imageId
            ? `<img class='image-question' src='assets/images/questions/${imageId}' >`
            : ""
        }
        <div class='interactive__tooltip_right-col ${imageId ? "" : "dblwide"}'>
          <div class='interactive__tooltip_right-col_unit'><img class='image-unit' src='assets/images/icons/census_unit_${
            unitReverseLookup[d[UNIT]]
          }.png' ><span>${d[UNIT]}</span></div>
          ${
            d[ASKED_OF]
              ? `<div class='interactive__tooltip_right-col_asked-of'>
                <img class='image-asked-of' src='assets/images/icons/help-circle.svg' >
                <span>${d[ASKED_OF]}<span>
              </div>`
              : ""
          }
          <div class='interactive__tooltip_right-col_qtype'><img class='image-qtype' src='assets/images/icons/census_qtype_${
            d[ANSWER_TYPE]
          }.png' ><span>${answerTypeLookup[d[ANSWER_TYPE]]}</span></div>
          ${
            listItems.length
              ? `<div class='interactive__tooltip_right-col_options'>
              ${listTitle}:
            <ul class='${listItems.length > 10 ? "wrap" : ""}'>
              ${listItems.map(d => `<li>-${d.trim()}</li>`).join("")}
            </ul>
          </div>`
              : ""
          }
        </div>
        `
      );
  } else {
    d3.select(".interactive__tooltip").classed("visible", false);
  }
}

function makeStoryStep(story, storyKey, storyStepIndex, isInteractiveInView) {
  const storyStepEl = d3.select(".interactive__story-step");

  d3.select(".interactive__story-intro").html(story.storyIntro);
  storyStepEl.classed("visible", isInteractiveInView);

  const storyStep = story.steps[storyStepIndex];
  storyStepEl
    .select(".interactive__story-stepper-dots")
    .selectAll(".step-dot")
    .data(story.steps, d => d.key)
    .join("div")
    .attr("class", "step-dot")
    .classed("current", (_, i) => i === storyStepIndex);

  storyStepEl
    .select(".interactive__story-step-title")
    .html(`${storyStep.year}: ${storyStep.label}`);
  storyStepEl.select(".interactive__story-step-body").html(storyStep.text);
  storyStepEl.select(".interactive__story-stepper-up").on("click", () => {
    setState({
      currentStoryStepIndex:
        (storyStepIndex - 1 + story.steps.length) % story.steps.length
    });
  });
  storyStepEl.select(".interactive__story-stepper-down").on("click", () => {
    setState({
      currentStoryStepIndex: (storyStepIndex + 1) % story.steps.length
    });
  });
}

function makeLegend(isMobile, currentYearInView) {
  const legendData = colorScale
    .domain()
    .sort()
    .map(d => ({ in: d, out: colorScale(d) }));
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

function drawStoryMenu(storyMenu, currentStoryKey) {
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
        // TODO set filters corresponding to storyKey
      });
    });

  d3.select(".interactive__story-restart").on("click", function() {
    setState({
      currentStoryKey: DEFAULT,
      currentStoryStepIndex: 0
    });
  });
}

function drawCirclesAndLinks(links, nodes, miniNodes) {
  d3.select(".interactive_g_links")
    .selectAll("line")
    .data(links, d => d.Source + d.Target)
    .join(
      enter =>
        enter
          .append("line")
          .attr("x1", d => d.sourceX)
          .attr("x2", d => d.targetX),
      update =>
        update.call(update =>
          update
            .transition()
            .duration(500)
            .attr("x1", d => d.sourceX)
            .attr("x2", d => d.targetX)
        )
    )
    .attr("y1", d => d.sourceY)
    .attr("y2", d => d.targetY)
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
          .attr("class", "node")
          .attr("cx", d => d.x)
          .attr("r", d => d.r),
      update =>
        update.call(update =>
          update
            .transition()
            .duration(500)
            .attr("cx", d => d.x)
            .attr("r", d => d.r)
        )
    )
    .attr("cy", d => d.y)
    .attr("fill", d => (d["Age range"] ? "#ffffff" : colorScale(d[CATEGORIES])))
    .attr("stroke", d => colorScale(d[CATEGORIES]))
    .attr("stroke-width", d => (d["Age range"] ? 2 : 0))
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
  circles
    .selectAll("circle.mininode")
    .data(miniNodes)
    .join(
      enter =>
        enter
          .append("circle")
          .attr("class", "mininode")
          .attr("cx", d => d.x)
          .attr("r", d => d.r),
      update =>
        update.call(update =>
          update
            .transition()
            .duration(500)
            .attr("cx", d => d.x)
            .attr("r", d => d.r)
        )
    )
    .attr("cy", d => d.y)
    .attr("fill", "none")
    .attr("stroke", colorScale("[Multiple]"))
    .attr("stroke-width", 2);
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
    isFilterMenuOpen,
    isInteractiveInView
  } = state;
  const svgHeight = 8.333 * appHeight;
  const svgWidth = isMobile ? appWidth : appWidth / 3;
  const changedKeys = stateChangedKeys(prevState, state);

  /**
   * STORY NAVIGATION
   */
  if (firstDraw) {
    drawStoryMenu(storyMenu, currentStoryKey);
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
  const miniNodes = miniNodesSelector(state, { svgWidth, yScale });
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
    changedKeys.isMobile
  ) {
    drawCirclesAndLinks(links, nodes, miniNodes);
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
  if (changedKeys.isMobile || changedKeys.tooltip) {
    d3.select(".interactive_g_circles")
      .selectAll("circle.node")
      .classed("active", d => tooltip.d && d[UID] === tooltip.d[UID]);
    makeTooltip(tooltip, isMobile);
  }

  /**
   * LEGEND
   */
  if (changedKeys.isMobile || changedKeys.currentYearInView) {
    makeLegend(isMobile, currentYearInView);
  }

  /**
   * STORY STEP
   */
  if (
    firstDraw ||
    changedKeys.currentStoryKey ||
    changedKeys.currentStoryStepIndex ||
    changedKeys.isInteractiveInView
  ) {
    const currentStory = currentStorySelector(state);
    makeStoryStep(
      currentStory,
      currentStoryKey,
      currentStoryStepIndex,
      isInteractiveInView
    );
    if (firstDraw) {
      d3.select(".interactive__img").attr(
        "src",
        `assets/images/${currentStoryKey}.jpg`
      );
    }
    if (changedKeys.currentStoryKey) {
      d3.select(".story-menu_dropdown")
        .selectAll(".story-menu_dropdown_option")
        .classed("selected", d => d.key === currentStoryKey);
      d3.select(".interactive")
        .node()
        .scrollIntoView({ behavior: "smooth" });
      d3.select(".interactive__img").attr(
        "src",
        `assets/images/${currentStoryKey}.jpg`
      );
    } else if (changedKeys.currentStoryStepIndex) {
      d3.selectAll(".interactive_g_labels .label")
        .filter(d => d === currentStory.steps[currentStoryStepIndex].year)
        .node()
        .scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "center"
        });
    }
  }

  /**
   * HISTORY FLAGS
   * VIZ LABELS
   */
  if (changedKeys.currentYearInView) {
    d3.selectAll(".interactive_g_labels .label").classed(
      "current",
      d => d === currentYearInView
    );
  }
  if (changedKeys.appHeight) {
    d3.select(".interactive_g_labels")
      .selectAll("text")
      .data(years)
      .join("text")
      .attr("class", "label")
      .attr("y", d => yScale(d) + 70) // vertically center
      .attr("x", svgWidth / 2)
      .text(d => d);

    d3.select(".interactive__history")
      .selectAll(".interactive__history_flag")
      .data(dataHistory)
      .join("div")
      .attr("class", "interactive__history_flag")
      .style("top", d => yScale(d[START_YEAR]) + "px")
      .style("left", d => 15 * d.xIndex + "%")
      .style(
        "height",
        d =>
          (d[START_YEAR] >= d[END_YEAR]
            ? appHeight / 30
            : yScale(d[END_YEAR]) - yScale(d[START_YEAR])) + "px"
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
