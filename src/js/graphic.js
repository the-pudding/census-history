/* global d3 */
import loadData from "./load-data";
import Constants from "./constants";
import { qsByYearLookupSelector, maxYearsSelector } from "./selectors";

const {
  CATEGORIES,
  UNIT,
  ASKED_OF,
  ANSWER_TYPE,
  YEAR,
  UID,
  QUESTION,
  MARGIN,
  MOBILE_BREAKPT,
  sortedCategories,
  years
} = Constants;

let state = {
  dataQuestions: [],
  dataLinks: [],
  storyMenu: [],
  currentStoryKey: "",
  currentStoryStepIndex: "",
  currentPosition: 0,
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
        storyMenu,
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

    d3
      .select(".interactive__tooltip")
      .style("visibility", "visible")
      .style("top", y + 10 + state.appHeight / 6 + "px")
      .style("left", x + svgX + "px").html(`${d[UID]}<br/>
      question: ${d[QUESTION]}<br/>
      answer type: ${d[ANSWER_TYPE]}<br/>
      unit: ${d[UNIT]}<br/>
      ${d[ASKED_OF] ? `asked of: ${d[ASKED_OF]}` : ""}
      `);
  } else {
    d3.select(".interactive__tooltip").style("visibility", "hidden");
  }
}

function update(prevState) {
  const {
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
  const colorScale = d3.scaleOrdinal([...d3.schemeSet1, ...d3.schemeSet2]);

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

  /** DRAWING
   *
   */
  const dropdown = d3.select(".interactive__dropdown").select("select");
  dropdown.on("change", function(d) {
    setState({
      currentStoryKey: d3.event.target.value
    });
  });
  dropdown
    .selectAll("option")
    .data(storyMenu)
    .join("option")
    .text(d => d.label);

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

  makeTooltip(tooltip);
}

export default { init, resize };
