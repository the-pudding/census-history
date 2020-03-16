const frac = (a, b, f) => a + f * (b - a);

const bezier = (
  sourceX,
  sourceY,
  targetX,
  targetY,
  hasBump,
  svgWidth,
  acs = false
) => {
  if (hasBump) {
    const bump = (sourceX + targetX) / 2 > svgWidth / 2 ? svgWidth - 1 : 1;
    return `M${sourceX},${sourceY}
    C${sourceX},${frac(sourceY, targetY, 0.25)}
    ${bump},${frac(sourceY, targetY, 0.25)}
    ${bump},${frac(sourceY, targetY, 0.5)}
    C${bump},${frac(sourceY, targetY, 0.75)}
    ${targetX},${frac(sourceY, targetY, 0.75)}
    ${targetX},${targetY}`;
  }
  if (acs) {
    return `M${sourceX},${sourceY}
            C${sourceX},${frac(sourceY, targetY, 0.75)}
            ${frac(sourceX, targetX, 0.75)},${targetY}
            ${targetX},${targetY}`;
  }
  return `M${sourceX},${sourceY}
  C${sourceX},${frac(sourceY, targetY, 0.5)}
  ${targetX},${frac(sourceY, targetY, 0.5)}
  ${targetX},${targetY}`;
};

export default bezier;
