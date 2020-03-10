function getDynamicFontSize(str) {
  return `font-size:${
    str.length > 30 ? 12 : str.length > 15 ? 14 : 16
  }px;line-height:1.65;`;
}

export default getDynamicFontSize;
