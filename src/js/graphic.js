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
  HOUSING,
  IMMIGRATION,
  AGE_RANGE,
  START_YEAR,
  END_YEAR,
  EVENT,
  MOBILE_BREAKPT,
  COLORS,
  sortedCategories,
  years,
  answerTypeLookup,
  imageFilesLookup,
  unitReverseLookup
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
      key: ANSWER_TYPE,
      allValues: [],
      selectedValues: []
    },
    {
      key: ASKED_OF,
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
  appWidth: 0,
  isFilterMenuOpen: false
};
const colorScale = d3.scaleOrdinal(COLORS).domain(sortedCategories);

function setState(nextState) {
  console.log(nextState);
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
            new Set(
              rawQuestions
                .filter(e => e[CATEGORIES] !== "[Admin.]")
                .map(d => d[f.key])
                .filter(d => !!d)
            )
          ).sort((a, b) =>
            f.key === CATEGORIES
              ? d3.ascending(
                  sortedCategories.indexOf(a),
                  sortedCategories.indexOf(b)
                )
              : d3.ascending(a, b)
          );
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

function makeFilterView(
  isFilterMenuOpen,
  filters,
  nodelets,
  linklets,
  appHeight,
  svgWidthlet,
  yScalelet
) {
  d3.select(".interactive__filter-toggle")
    .classed("is-filter-menu-open", isFilterMenuOpen)
    .on("click", () => {
      setState({
        isFilterMenuOpen: !isFilterMenuOpen
      });
    });
  const filtersEl = d3.select(".interactive__filters");
  filtersEl.classed("visible", isFilterMenuOpen);
  const filter = filtersEl
    .selectAll(".interactive__filters_filter")
    .data(filters, d => d.key)
    .join("div")
    .attr("class", "interactive__filters_filter")
    .html(
      d => `<div class='filter-label'>Filter questions by <strong>${d.key.toLowerCase()}</strong></div>
      <div class='filter-options'></div>`
    );
  filter
    .select(".filter-options")
    .selectAll(".filter-option")
    .data((d, i) =>
      d.allValues.map(e => ({
        label: d.key === ANSWER_TYPE ? answerTypeLookup[e] : e,
        value: e,
        selected: !!~d.selectedValues.indexOf(e),
        key: d.key,
        filterIndex: i
      }))
    )
    .join("div")
    .attr("class", "filter-option")
    .classed("selected", d => d.selected)
    .html(
      d => `<div>
      <div class='checkbox' style='background-color:${
        !d.selected
          ? "white"
          : d.key === CATEGORIES
          ? colorScale(d.label)
          : "black"
      };'></div>
      ${d.label}
      ${
        d.key === UNIT
          ? `<img class='icon' src='assets/images/icons/census_unit_${
              unitReverseLookup[d.label]
            }.png'>`
          : d.key === ANSWER_TYPE
          ? ` <img class='icon' src='assets/images/icons/census_qtype_${d.value}.png' >`
          : ""
      }
    </div>`
    )
    .on("click", d => {
      setState({
        filters: [
          ...filters.slice(0, d.filterIndex),
          {
            ...filters[d.filterIndex],
            selectedValues: immutableAddRemove(
              filters[d.filterIndex].selectedValues,
              d.value
            )
          },
          ...filters.slice(d.filterIndex + 1)
        ]
      });
    });
  const svg = filtersEl
    .select("svg")
    .attr("height", appHeight - 48)
    .attr("width", svgWidthlet);
  svg
    .select(".filters_g_years")
    .selectAll("text")
    .data(years)
    .join("text")
    .attr("y", d => yScalelet(d) - 2)
    .classed("big-font", d => d % 50 === 0)
    .text(d => d);
  svg
    .select(".filters_g_years")
    .selectAll("line")
    .attr("class", "underline")
    .data(years)
    .join("line")
    .attr("y1", d => yScalelet(d))
    .attr("y2", d => yScalelet(d))
    .attr("x1", 0)
    .attr("x2", svgWidthlet);
  svg
    .select(".filters_g_links")
    .selectAll(".line")
    .data(linklets, d => d.Source + d.Target)
    .join("path")
    .attr("d", d => d.svgPath)
    .attr("stroke-dasharray", d =>
      +d.Target.slice(0, 4) - +d.Source.slice(0, 4) > 10 ? "2 2" : ""
    )
    .attr("class", "line")
    .classed("inactive", d => !d.inFilter)
    .attr("stroke", d => colorScale(d.Category));
  svg
    .select(".filters_g_circles")
    .selectAll("circle.node")
    .data(Array.from(nodelets.values()), d => d.UID)
    .join("circle")
    .attr("class", "node")
    .attr("r", d => (d.r > 10 ? 6 : d.r > 5 ? 4 : 2))
    .attr("cx", d => d.x)
    .attr("cy", d => d.y)
    .attr("fill", d => colorScale(d[CATEGORIES]))
    .classed("inactive", d => !d.inFilter);
}

const tooltipConstant = r => (r / 2) * Math.sqrt(2) + 8 * Math.sqrt(2);
function makeTooltip({ x, y, d }, isMobile, storyKey, svgWidth) {
  const { x: svgX } = d3
    .select(".interactive__svg")
    .node()
    .getBoundingClientRect();
  const color = colorScale(d[CATEGORIES]);
  const imageId = imageFilesLookup[d[UID]];
  const tooltipOffsetHeight = getTooltipOffsetHeight();
  const yMargins = storyKey === DEFAULT ? 16 : 32;
  const flip = x > 0.5 * svgWidth;

  d3
    .select(".interactive__tooltip")
    .style(
      "top",
      isMobile
        ? "auto"
        : y + tooltipOffsetHeight + yMargins + tooltipConstant(d.r) + d.r + "px"
    )
    .style(
      "left",
      isMobile
        ? "0px"
        : flip
        ? "auto"
        : svgX + x + tooltipConstant(d.r) + d.r + "px"
    )
    .style(
      "right",
      isMobile
        ? "0px"
        : flip
        ? svgX + svgWidth - x + tooltipConstant(d.r) - d.r + "px"
        : "auto"
    )
    .style("border-color", color)
    .classed("visible", true)
    .classed("flip", flip)
    .html(`<div class='interactive__tooltip_tail' style='border-color:${color};'></div>
    <div class='interactive__tooltip_category' style='color:${color};'>
      ${d[CATEGORIES] === "National origin" ? "Nat'l origin" : d[CATEGORIES]}
      <img class='icon' src='assets/images/icons/census_unit_${
        unitReverseLookup[d[UNIT]]
      }.png' >
      <img class='icon' src='assets/images/icons/census_qtype_${
        d[ANSWER_TYPE]
      }.png' >
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
  const {
    currentYearInView,
    currentStoryKey,
    currentStoryStepIndex,
    isFilterMenuOpen
  } = state;
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
    (isEnter && nextYearInView > currentYearInView) ||
    (!isEnter && nextYearInView < currentYearInView)
  ) {
    // only update state with new year
    // if scrolling has entered a later year
    // or exited an earlier year
    setState({
      currentYearInView: nextYearInView,
      ...(nextStoryStepIndex === currentStoryStepIndex
        ? {}
        : { currentStoryStepIndex: nextStoryStepIndex }),
      ...(isFilterMenuOpen ? { isFilterMenuOpen: false } : {})
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

function drawCirclesAndLinks(links, nodes) {
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
  const isDefaultStory = story.key === DEFAULT;
  d3.select(".interactive__story-intro")
    .classed("populated", !isDefaultStory)
    .html(story.storyIntro);
  d3.select(".interactive__img")
    .classed("populated", !isDefaultStory)
    .attr("src", story.img && `assets/images/${story.img}.jpg`);
  d3.select(".interactive__step-start")
    .html(
      story.key === HOUSING || story.key === IMMIGRATION
        ? `<img src='assets/images/icons/arrow-down.svg'>Start`
        : ""
    )
    .on("click", () => {
      d3.select(`.interactive__labels .label.year-${story.steps[0].year}`)
        .node()
        .scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "center"
        });
    });
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
    isMobile,
    isFilterMenuOpen
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
  const nodes = nodesSelector(state, {
    svgWidth,
    yScale,
    useCurrentYearFilter: true
  });
  const links = linksSelector(state, {
    svgWidth,
    yScale,
    useCurrentYearFilter: true
  });

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
  ) {
    drawCirclesAndLinks(links, nodes);
  }

  /**
   * TOOLTIP
   */
  if (
    changedKeys.isMobile ||
    changedKeys.tooltip ||
    changedKeys.currentYearInView ||
    changedKeys.appWidth
  ) {
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
      d3.select(".interactive__tooltip").classed("visible", false);
      d3.select(".interactive_g_links")
        .selectAll("path.line")
        .classed("inactive", false);
      d3.select(".interactive_g_circles")
        .selectAll("circle.node")
        .classed("active", false)
        .classed("inactive", false);
    } else {
      makeTooltip(tooltip, isMobile, currentStoryKey, svgWidth);
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
    d3.selectAll(".annotation").style("opacity", 0);
    d3.select(".interactive__labels")
      .selectAll(".label")
      .classed("current", d => d === currentYearInView);
    d3.select(".interactive__filter-toggle")
      .classed("visible", currentYearInView > years[0])
      .on("click", () => {
        setState({
          isFilterMenuOpen: !isFilterMenuOpen
        });
      });
  }

  /**
   * HISTORY FLAGS
   * VIZ LABELS
   */
  if (changedKeys.appHeight || changedKeys.isMobile) {
    makeHistory(dataHistory, yScale);
  }

  /**
   * FILTER VIEW
   */
  if (
    changedKeys.isFilterMenuOpen ||
    changedKeys.filters ||
    changedKeys.appHeight
  ) {
    const yScalelet = d3
      .scaleLinear()
      .domain([years[0], years[years.length - 1]])
      .range([10, appHeight - 68]); // header height - 20
    const svgWidthlet = 0.7 * appWidth * (3 / 7); // sync CSS width, margin
    const nodelets = nodesSelector(state, {
      svgWidth: svgWidthlet,
      yScale: yScalelet,
      useCurrentYearFilter: false
    });
    const linklets = linksSelector(state, {
      svgWidth: svgWidthlet,
      yScale: yScalelet,
      useCurrentYearFilter: false
    });
    makeFilterView(
      isFilterMenuOpen,
      filters,
      nodelets,
      linklets,
      appHeight,
      svgWidthlet,
      yScalelet
    );
  }

  if (firstDraw) {
    firstDraw = false;
    afterFirstDraw();
  }
}

export default { init, resize };
