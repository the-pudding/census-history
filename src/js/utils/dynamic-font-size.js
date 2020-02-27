function getDynamicFontSize(str) {
  return str.length > 50 ? 9 : str.length > 30 ? 12 : str.length > 15 ? 14 : 16;
}

export default getDynamicFontSize;
