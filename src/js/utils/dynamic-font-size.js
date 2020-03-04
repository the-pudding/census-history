function getDynamicFontSize(str) {
  return `font-size:${
    str.length > 50 ? 9 : str.length > 30 ? 12 : str.length > 15 ? 14 : 16
  }px;line-height:${str.length > 50 ? 2.2 : 1.65}`;
}

export default getDynamicFontSize;
