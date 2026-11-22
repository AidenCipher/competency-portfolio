// Hero visual: a capability graph whose nodes light up in sequence, as if evidence were being validated.
// Server component, inline SVG, CSS-only animation (opacity), so no client JavaScript on the landing page.
// Illustrative: the nodes are the six HR Business Partner capabilities, not anyone's data.
const NODES = [
  ["Communication"],
  ["Stakeholder", "Management"],
  ["Conflict", "Management"],
  ["Problem", "Solving"],
  ["Data", "Analysis"],
  ["Team", "Leadership"],
] as const;

const CX = 200;
const CY = 190;
const RX = 130;
const RY = 125;

export function CapabilityGraph() {
  const nodes = NODES.map((label, i) => {
    const angle = (-90 + i * 60) * (Math.PI / 180);
    const x = CX + RX * Math.cos(angle);
    const y = CY + RY * Math.sin(angle);
    return { label, x, y, above: y < CY, i };
  });
  return (
    <svg
      viewBox="0 0 400 380"
      role="img"
      aria-label="A graph of six HR Business Partner capabilities connected to one career goal. The capabilities light up one after another as evidence is validated."
      className="h-auto w-full max-w-[28rem]"
    >
      <g>
        {nodes.map((n) => (
          <g key={`edge-${n.i}`}>
            <line x1={CX} y1={CY} x2={n.x} y2={n.y} stroke="var(--line)" strokeWidth="2" />
            <line x1={CX} y1={CY} x2={n.x} y2={n.y} stroke="var(--accent)" strokeWidth="2.5" className="graph-lit" style={{ "--i": n.i } as React.CSSProperties} />
          </g>
        ))}
      </g>
      <circle cx={CX} cy={CY} r="38" fill="var(--accent)" />
      <text x={CX} y={CY - 3} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--accent-ink)">Career</text>
      <text x={CX} y={CY + 13} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--accent-ink)">goal</text>
      {nodes.map((n) => (
        <g key={`node-${n.i}`}>
          <circle cx={n.x} cy={n.y} r="15" fill="var(--surface)" stroke="var(--ink-3)" strokeWidth="2" />
          <circle cx={n.x} cy={n.y} r="15" fill="var(--ok)" className="graph-lit" style={{ "--i": n.i } as React.CSSProperties} />
          <text textAnchor="middle" fontSize="13" fontWeight="500" fill="var(--ink)">
            {n.label.map((line, k) => {
              const base = n.above ? n.y - 24 - (n.label.length - 1 - k) * 15 : n.y + 32 + k * 15;
              return (
                <tspan key={line} x={n.x} y={base}>
                  {line}
                </tspan>
              );
            })}
          </text>
        </g>
      ))}
    </svg>
  );
}
