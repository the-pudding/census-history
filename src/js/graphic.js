/* global d3 */
import loadData from "./load-data";
import Constants from "./constants";
import { qsByYearLookupSelector, maxYearsSelector } from "./selectors";

const {
  CATEGORIES,
  UNIT,
  ASKED_OF,
  ANSWER_TYPE,
  MARGIN,
  MOBILE_BREAKPT,
  THEME_ECON,
  THEME_RACE,
  THEME_IMMIGR,
  sortedCategories,
  years
} = Constants;

let state = {
  dataQuestions: [],
  dataLinks: [],
  storyMenu: [
    {
      key: "econ",
      label: THEME_ECON,
      introText:
        "In tortor nunc, imperdiet et mauris a, mattis tempus nisl. Vivamus et iaculis ex, at ullamcorper neque. Nullam pretium velit a mauris lacinia scelerisque. Morbi eget commodo mauris. Curabitur nec volutpat lectus. Praesent eget urna odio. Nunc sapien ante, bibendum vel augue eu, vestibulum pharetra sapien.",
      steps: [
        {
          key: "",
          label: "",
          text: "",
          filters: {},
          position: 0
        }
      ]
    },
    {
      key: "race",
      label: THEME_RACE,
      introText:
        "Nam tristique sit amet enim quis facilisis. In nisl quam, lacinia vel nibh sed, sodales consectetur ante. Phasellus auctor, nisl at blandit tempor, nunc elit facilisis nibh, porttitor bibendum massa sem at ante. Sed sed malesuada lectus. Aliquam rhoncus ultrices iaculis. Aenean consectetur dignissim lobortis. Ut lacinia diam vel porttitor feugiat. Nam congue venenatis nisi, quis ultricies risus imperdiet quis.",
      steps: [
        {
          key: "",
          label: "",
          text: "",
          filters: {},
          position: 0
        }
      ]
    }
  ],
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
  currentPosition: 0,
  tooltip: {
    x: 0,
    y: 0,
    content: ""
  },
  isMobile: window.innerWidth < MOBILE_BREAKPT,
  appHeight: window.innerHeight,
  appWidth: window.innerWidth
};

function setState(nextState) {
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
  loadData(["questions.csv", "links.csv"])
    .then(([rawQuestions, rawLinks]) => {
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

function makeTooltip(x, y, d) {
  d3.select(".interactive__tooltip")
    .style("top", y + "px")
    .style("left", x + "px")
    .html(`${d.Year} ${d.Question}`);
}

function update(prevState) {
  const {
    filters,
    dataQuestions,
    dataLinks,
    appHeight,
    appWidth,
    storyMenu,
    isMobile
  } = state;
  const svgHeight = 8.333 * appHeight;
  const svgWidth = isMobile ? appWidth : appWidth / 3;
  const { x: svgX, y: svgY } = d3
    .select(".interactive__svg")
    .node()
    .getBoundingClientRect();

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
  let year = dataQuestions[0].Year;

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
    if (e.Year === year) {
      e.indexByYear = indexByYear;
    } else {
      e.indexByYear = indexByYear = 0;
      year = e.Year;
    }
    indexByYear++;
  });

  // define xScale after indexByYear has been assigned
  const qsByYearLookup = qsByYearLookupSelector(interimDataQuestions);
  const maxYears = maxYearsSelector(interimDataQuestions);
  const xScale = d =>
    svgWidth * ((1 + d.indexByYear) / (1 + qsByYearLookup.get(d.Year)));

  const nodes = new Map(
    interimDataQuestions.map(d => [
      d.UID,
      {
        ...d,
        x: d.UID === "2010_ACS" ? svgWidth - 10 : xScale(d),
        y:
          d.UID === "2010_ACS"
            ? yScale(d.Year) - appHeight / 6
            : yScale(d.Year),
        r: d.UID === "2010_ACS" ? 10 : 5
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
  d3.select(".interactive__dropdown")
    .select("select")
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
    .attr("y", d => yScale(d) + 40) // vertically center
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
    .attr("fill", d => (d["Age range"] ? "#ffffff" : colorScale(d.Categories)))
    .attr("stroke", d => colorScale(d.Categories))
    .attr("stroke-width", d => (d["Age range"] ? 2 : 0))
    .attr("r", d => d.r)
    .on("mouseenter", function(d) {
      const { x, y } = this.getBBox();
      makeTooltip(svgX + x, svgY + y, d);
    });
}

export default { init, resize };
