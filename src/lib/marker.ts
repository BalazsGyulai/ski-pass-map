function cssColor(value: string): string {
  return /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : "#8b938e";
}

export function pieSvg(colors: string[], options: { selected: boolean; closed: boolean }): string {
  const cx = 14;
  const cy = 14;
  const radius = 10;
  const ring = options.selected ? "#ffbf47" : "#14211c";
  const ringWidth = options.selected ? 2.5 : 1.25;
  const dash = options.closed ? ` stroke-dasharray="3 2"` : "";
  let body = "";
  if (colors.length === 0) {
    body = `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="#8b938e" />`;
  } else if (colors.length === 1) {
    body = `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${cssColor(colors[0])}" />`;
  } else {
    body = colors
      .map((color, index) => {
        const start = (index / colors.length) * Math.PI * 2 - Math.PI / 2;
        const end = ((index + 1) / colors.length) * Math.PI * 2 - Math.PI / 2;
        const x0 = cx + radius * Math.cos(start);
        const y0 = cy + radius * Math.sin(start);
        const x1 = cx + radius * Math.cos(end);
        const y1 = cy + radius * Math.sin(end);
        const large = end - start > Math.PI ? 1 : 0;
        return `<path d="M ${cx} ${cy} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z" fill="${cssColor(color)}" />`;
      })
      .join("");
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="32" viewBox="0 0 28 32" aria-hidden="true">${body}<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${ring}" stroke-width="${ringWidth}"${dash} /></svg>`;
}
