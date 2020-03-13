import { svgWidthSelector } from "../selectors";

const frac = (a, b, f) => a + f * (b - a);

const bezier = (sourceX, sourceY, targetX, targetY, hasBump, svgWidth) => {
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
  return `M${sourceX},${sourceY}
  C${sourceX},${frac(sourceY, targetY, 0.5)}
  ${targetX},${frac(sourceY, targetY, 0.5)}
  ${targetX},${targetY}`;
};

export default bezier;
