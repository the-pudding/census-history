function round(n, e) {
  const p = Math.pow(10, e);
  const r = Math.round(n * p) / p;
  return r === 0 ? 0 : r; // -0
}

const getIthPoint = (i, n, r) => {
  const theta = (i / n) * 2 * Math.PI;
  return [r * round(Math.cos(theta), 8), r * round(Math.sin(theta), 8)];
};

export default getIthPoint;
