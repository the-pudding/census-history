import imageFilesLookup from "../assets/data/imageFilesLookup.json";

export default {
  CATEGORIES: "Categories",
  UNIT: "Unit",
  ASKED_OF: "Asked of",
  ANSWER_TYPE: "Answer Type",
  AGE_RANGE: "Age range",
  UID: "UID",
  QUESTION: "Question",
  YEAR: "Year",
  OPTIONS: "Categorical options",

  START_YEAR: "startYear",
  END_YEAR: "endYear",
  EVENT: "event",

  MARGIN: 100,
  MOBILE_BREAKPT: 768,

  DEFAULT: "default",

  START_ACS: "2010_ACS",

  COLORS: [
    "#d50000",
    "#f57c00",
    "#8e24aa",
    "#ffea00",
    "#9c5a33",
    "#448aff",
    "#388e3c",
    "#f06292",
    "#9e9e9e",
    "#26c6da",
    "#ffb74d"
  ],

  sortedCategories: [
    "Occupation",
    "Veteran status",
    "Immigration",
    "Education",
    "Family",
    "Identity",
    "[Multiple]",
    "Race",
    "Disability",
    "National origin",
    "Housing"
  ],

  answerTypeLookup: {
    FT: "Text",
    BN: "Yes/No",
    CC: "Multiple Choice",
    FN: "Number",
    FD: "Date/Time",
    FM: "Dollar Amount"
  },

  unitReverseLookup: {
    Individual: "individual",
    "Sampled Individual": "individualS",
    "Reference Individual": "individual",
    Household: "household",
    "Sampled Household": "householdS",
    "Indiv. in sampled household": "householdSI"
  },

  years: [
    1790,
    1800,
    1810,
    1820,
    1830,
    1840,
    1850,
    1860,
    1870,
    1880,
    1890,
    1900,
    1910,
    1920,
    1930,
    1940,
    1950,
    1960,
    1970,
    1980,
    1990,
    2000,
    2010,
    2020
  ],

  imageFilesLookup
};
