const frac = (a, b, f) => a + f * (b - a);

const bezier = d =>
  `M${d.sourceX},${d.sourceY}
  C${d.sourceX},${frac(d.sourceY, d.targetY, 0.5)}
  ${d.targetX},${frac(d.sourceY, d.targetY, 0.5)}
  ${d.targetX},${d.targetY}`;

export default bezier;
