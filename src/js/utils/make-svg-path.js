const frac = (a, b, f) => a + f * (b - a);

const bezier = (sourceX, sourceY, targetX, targetY, hasBump) =>
  hasBump
    ? `M${sourceX},${sourceY}
  C${sourceX},${frac(sourceY, targetY, 0.25)}
  1,${frac(sourceY, targetY, 0.25)}
  1,${frac(sourceY, targetY, 0.5)}
  C0,${frac(sourceY, targetY, 0.75)}
  ${targetX},${frac(sourceY, targetY, 0.75)}
  ${targetX},${targetY}`
    : `M${sourceX},${sourceY}
  C${sourceX},${frac(sourceY, targetY, 0.5)}
  ${targetX},${frac(sourceY, targetY, 0.5)}
  ${targetX},${targetY}`;
export default bezier;
