/* global d3 */
import enterView from "enter-view";
import loadData from "./load-data";
import Constants from "./constants";
import {
  qsByYearLookupSelector,
  maxYearsSelector,
  currentStorySelector
} from "./selectors";
import getDynamicFontSize from "./utils/dynamic-font-size";

const {
  CATEGORIES,
  UNIT,
  ASKED_OF,
  ANSWER_TYPE,
  YEAR,
  UID,
  QUESTION,
  AGE_RANGE,
  OPTIONS,
  MARGIN,
  MOBILE_BREAKPT,
  sortedCategories,
  years,
  answerTypeLookup,
  unitReverseLookup,
  imageFilesLookup
} = Constants;

let firstDrawComplete = false;
let state = {
  dataQuestions: [],
  dataLinks: [],
  storyMenu: [],
  currentStoryKey: "",
  currentStoryStepIndex: null,
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
  isMobile: window.innerWidth < MOBILE_BREAKPT,
  appHeight: window.innerHeight,
  appWidth: window.innerWidth
};
const colorScale = d3.scaleOrdinal([...d3.schemeSet1, ...d3.schemeSet2]);

function setState(nextState) {
  console.log(nextState);
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
  loadData(["questions.csv", "links.csv", "storyMenu.json"])
    .then(([rawQuestions, rawLinks, { storyMenu }]) => {
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
      setState({
        storyMenu: storyMenu.map(s => ({
          ...s,
          steps: s.steps.map(p => ({ ...p, year: +p.year }))
        })),
        dataQuestions: rawQuestions,
        dataLinks: rawLinks,
        filters: state.filters.map(f => {
          const allValues = Array.from(
            new Set(rawQuestions.map(d => d[f.key]))
          );
          return {
            ...f,
            allValues,
            selectedValues: allValues
          };
        })
      });
    })
    .catch(console.error);
}

function makeTooltip({ x, y, d }) {
  if (d) {
    const { x: svgX } = d3
      .select(".interactive__svg")
      .node()
      .getBoundingClientRect();

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
      .style("top", y + 190 + state.appHeight / 3 + "px")
      .style("left", x + svgX - 120 + "px")
      .style("background-color", colorScale(d[CATEGORIES]))
      .classed("visible", true)
      .html(
        `<div class='interactive__tooltip_question' style='font-size:${getDynamicFontSize(
          d[QUESTION]
        )}px;'>${d[QUESTION]}</div>
        <img class='image-question' src='assets/images/questions/${
          imageFilesLookup[d[UID]]
        }' >
        <div class='interactive__tooltip_right-col'>
          <div class='interactive__tooltip_right-col_unit'><img class='image-unit' src='assets/images/icons/census_unit_${
            unitReverseLookup[d[UNIT]]
          }.png' ><span>${d[UNIT]}</span></div>
          <div class='interactive__tooltip_right-col_qtype'><img class='image-qtype' src='assets/images/icons/census_qtype_${
            d[ANSWER_TYPE]
          }.png' ><span>${answerTypeLookup[d[ANSWER_TYPE]]}</span></div>
          ${
            d[ASKED_OF]
              ? `<div class='interactive__tooltip_right-col_asked-of'>
                <img class='image-asked-of' src='assets/images/icons/alert-triangle.svg' >
                <span>${d[ASKED_OF]}<span>
              </div>`
              : ""
          }
          ${
            listItems.length
              ? `<div class='interactive__tooltip_right-col_options'>
              ${listTitle}:
            <ul>
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

function makeStoryStep(story, storyKey, storyStepIndex) {
  const storyStepEl = d3.select(".interactive__story-step");
  if (!story || storyKey === "") {
    d3.select(".interactive__story-intro").html();
    storyStepEl.classed("visible", false);
    return;
  }

  d3.select(".interactive__story-intro").html(story.storyIntro);
  storyStepEl.classed("visible", true);

  const storyStep = story.steps[storyStepIndex];
  storyStepEl
    .select(".interactive__story-stepper-dots")
    .selectAll(".step-dot")
    .data(story.steps, d => d.key)
    .join("div")
    .attr("class", "step-dot")
    .classed("current", (_, i) => i === storyStepIndex);

  storyStepEl.select(".interactive__story-step-title").html(storyStep.label);
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
  const nextYearInView = isEnter ? d : years[i - 1];
  if (
    (isEnter && d !== currentYearInView) ||
    (!isEnter && d === currentYearInView && i !== 0)
  ) {
    setState({
      currentYearInView: nextYearInView,
      ...(nextStoryStepIndex === currentStoryStepIndex
        ? {}
        : { currentStoryStepIndex: nextStoryStepIndex })
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

function update(prevState) {
  const {
    currentStoryKey,
    currentStoryStepIndex,
    currentYearInView,
    filters,
    dataQuestions,
    dataLinks,
    appHeight,
    appWidth,
    storyMenu,
    tooltip,
    isMobile
  } = state;
  const svgHeight = 8.333 * appHeight;
  const svgWidth = isMobile ? appWidth : appWidth / 3;

  /**
   * STORY NAVIGATION
   */
  const dropdown = d3.select(".intro__dropdown").select("select");
  dropdown.on("change", function(d) {
    setState({
      currentStoryKey: d3.event.target.value,
      currentStoryStepIndex: 0
    });
  });
  dropdown
    .selectAll("option")
    .data([{ label: "CHOOSE A STORY" }, ...storyMenu])
    .join("option")
    .attr("value", d => d.key || "")
    .text(d => d.label);

  d3.select(".interactive__story-restart").on("click", function() {
    setState({
      currentStoryKey: "",
      currentStoryStepIndex: null
    });
  });

  /**
   * NODES
   * TODO: extract to a utility with reselect
   */
  const yScale = d3
    .scaleLinear()
    .domain([years[0], years[years.length - 1]])
    .range([appHeight / 6, svgHeight - appHeight / 6]);

  // only works if dataQuestions is sorted by Year
  let indexByYear = 0;
  let year = dataQuestions[0][YEAR];

  // position questions that are in filter
  const interimDataQuestions = dataQuestions
    .slice()
    .filter(d =>
      filters.reduce(
        (acc, f) => acc && f.selectedValues.indexOf(d[f.key]) > -1,
        true
      )
    );
  interimDataQuestions.forEach(e => {
    if (e[YEAR] === year) {
      e.indexByYear = indexByYear;
    } else {
      e.indexByYear = indexByYear = 0;
      year = e[YEAR];
    }
    indexByYear++;
  });

  // define xScale after indexByYear has been assigned
  const qsByYearLookup = qsByYearLookupSelector(interimDataQuestions);
  const maxYears = maxYearsSelector(interimDataQuestions);
  const xScale = d =>
    svgWidth * ((1 + d.indexByYear) / (1 + qsByYearLookup.get(d[YEAR])));

  const nodes = new Map(
    interimDataQuestions.map(d => [
      d.UID,
      {
        ...d,
        x: d.UID === "2010_ACS" ? svgWidth - 10 : xScale(d),
        y:
          d.UID === "2010_ACS"
            ? yScale(d[YEAR]) - appHeight / 6
            : yScale(d[YEAR]),
        r: d.UID === "2010_ACS" ? 10 : 200 / qsByYearLookup.get(d[YEAR])
      }
    ])
  );

  /** LINKS
   *
   */
  const links = dataLinks
    .filter(d => nodes.has(d.Source) && nodes.has(d.Target))
    .map(d => {
      const { x: sourceX, y: sourceY } = nodes.get(d.Source);
      const { x: targetX, y: targetY } = nodes.get(d.Target);
      let Category = d.Category;
      if (Category.indexOf(", ") !== -1) {
        Category = "[Multiple]";
      }
      if (Category.indexOf(" - ") !== -1) {
        Category = Category.split(" - ")[0];
      }
      return { ...d, sourceX, sourceY, targetX, targetY, Category };
    });

  /** DRAWING VIZ
   *
   */
  d3.select(".interactive__svg")
    .attr("height", svgHeight)
    .attr("width", svgWidth);

  d3.select(".interactive_g_labels")
    .selectAll("text")
    .data(years)
    .join("text")
    .attr("class", "label")
    .attr("y", d => yScale(d) + 70) // vertically center
    .attr("x", svgWidth / 2)
    .text(d => d);

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
            .attr("x1", d => d.sourceX)
            .attr("x2", d => d.targetX)
        )
    )
    .attr("y1", d => d.sourceY)
    .attr("y2", d => d.targetY)
    .attr("stroke-width", 2)
    .attr("stroke", d => colorScale(d.Category));

  d3.select(".interactive_g_circles")
    .selectAll("circle")
    .data(Array.from(nodes.values()), d => d.UID)
    .join(
      enter => enter.append("circle").attr("cx", d => d.x),
      update => update.call(update => update.transition().attr("cx", d => d.x))
    )
    .attr("cy", d => d.y)
    .attr("fill", d => (d["Age range"] ? "#ffffff" : colorScale(d[CATEGORIES])))
    .attr("stroke", d => colorScale(d[CATEGORIES]))
    .attr("stroke-width", d => (d["Age range"] ? 2 : 0))
    .attr("r", d => d.r)
    .classed("active", d => tooltip.d && d[UID] === tooltip.d[UID])
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
      setState({ tooltip: { ...tooltip, d: null } });
    });

  /**
   * TOOLTIP
   */
  makeTooltip(tooltip);

  /**
   * STORY STEP
   */
  const currentStory = currentStorySelector(state);
  makeStoryStep(currentStory, currentStoryKey, currentStoryStepIndex);
  if (prevState.currentStoryKey !== currentStoryKey) {
    d3.select(".interactive")
      .node()
      .scrollIntoView({ behavior: "smooth" });
  } else if (prevState.currentStoryStepIndex !== currentStoryStepIndex) {
    d3.selectAll(".interactive_g_labels .label")
      .filter(d => d === currentStory.steps[currentStoryStepIndex].year)
      .node()
      .scrollIntoView({ behavior: "smooth" });
    // TODO this currently overshoots by 1/3 appHeight
  }

  if (!firstDrawComplete) {
    afterFirstDraw();
  }
}

export default { init, resize };
