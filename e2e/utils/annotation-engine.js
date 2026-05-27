/**
 * Annotation engine — injected into the Electron renderer at test runtime.
 * Requires rough.js to already be injected (window.rough must exist).
 * E2E only: never imported by the Angular app.
 */
(function () {
  const SVG_NAMESPACE    = 'http://www.w3.org/2000/svg';
  const ANNOTATION_COLOR = '#FACC15';

  // ── SVG overlay ─────────────────────────────────────────────────────────────
  function getOrCreateOverlay() {
    let svgElement = document.getElementById('__e2eann');
    if (!svgElement) {
      svgElement = document.createElementNS(SVG_NAMESPACE, 'svg');
      svgElement.id = '__e2eann';
      Object.assign(svgElement.style, {
        position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: '999999',
      });
      svgElement.innerHTML = `<defs>
        <filter id="__ann-wobble" x="-5%" y="-40%" width="110%" height="180%">
          <feTurbulence type="turbulence" baseFrequency="0.015" numOctaves="3" seed="7" result="n"/>
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.8"
                             xChannelSelector="R" yChannelSelector="G"/>
        </filter>
      </defs>`;
      document.body.appendChild(svgElement);
    }
    return svgElement;
  }

  // ── Clear ────────────────────────────────────────────────────────────────────
  window.__annClear = () => { getOrCreateOverlay().innerHTML = ''; };

  // ── Draw arrow + multiline text label at its tail ────────────────────────────
  //   text: newline-separated string, rendered as stacked tspan lines
  //   (tipX, tipY): arrow TIP — the element being pointed at
  //   side: which direction the arrow tail extends from the tip
  window.__annDraw = (text, tipX, tipY, side) => {
    const svgCanvas      = getOrCreateOverlay();
    const roughCanvas            = rough.svg(svgCanvas);

    // ── Tail position (label anchor) ──────────────────────────────────────────
    const tailMargin = 200;
    let tailX = tipX, tailY = tipY;
    if (side === 'right') tailX = tipX + tailMargin;
    else  /* bottom */    tailY = tipY + tailMargin;

    // ── Curved arrow stem ─────────────────────────────────────────────────────
    const stemMidX      = (tailX + tipX) / 2;
    const stemMidY      = (tailY + tipY) / 2;
    const controlPointX = stemMidX - (tipY - tailY) * 0.2;
    const controlPointY = stemMidY + (tipX - tailX) * 0.2;

    // arrowAngle must be computed before the path so we can shorten the stem end
    const arrowheadSize = 40;
    const arrowAngle    = Math.atan2(tipY - controlPointY, tipX - controlPointX);

    // End the stem inside the arrowhead body so the line doesn't poke past the tip
    const stemEndX = tipX - arrowheadSize * Math.cos(arrowAngle);
    const stemEndY = tipY - arrowheadSize * Math.sin(arrowAngle);

    svgCanvas.appendChild(roughCanvas.path(
      `M ${tailX} ${tailY} Q ${controlPointX} ${controlPointY} ${stemEndX} ${stemEndY}`,
      { roughness: 3, bowing: 2.5, stroke: ANNOTATION_COLOR, strokeWidth: 5 },
    ));

    // ── Arrowhead — large, hachure (diagonal stripe) fill ────────────────────
    svgCanvas.appendChild(roughCanvas.polygon([
      [tipX, tipY],
      [tipX - arrowheadSize * Math.cos(arrowAngle - 0.6), tipY - arrowheadSize * Math.sin(arrowAngle - 0.6)],
      [tipX - arrowheadSize * Math.cos(arrowAngle + 0.6), tipY - arrowheadSize * Math.sin(arrowAngle + 0.6)],
    ], {
      roughness: 1, stroke: ANNOTATION_COLOR, strokeWidth: 1,
      fill: ANNOTATION_COLOR, fillStyle: 'hachure',
      hachureAngle: -45, hachureGap: 5, fillWeight: 2.5,
    }));

    // ── Multiline text label at the tail ─────────────────────────────────────
    if (!text) return;

    const boxGap = 10;
    const lines      = text.split('\n');
    const lineHeight = 21;
    const padding    = 12;
    const boxWidth   = Math.max(...lines.map(l => l.length)) * 9 + padding * 2;
    const boxHeight  = lines.length * lineHeight + padding * 2;

    // Box is flush with the tail point — no gap
    let boxLeft, boxTop, textX, textY, textAnchor;
    if (side === 'right') {
      boxLeft    = tailX + boxGap;
      boxTop     = tailY - boxHeight / 2;
      textX      = tailX + padding + boxGap;
      textY      = boxTop + padding + lineHeight * 0.75;
      textAnchor = 'start';
    } else { // 'bottom'
      boxLeft    = tailX - boxWidth / 2;
      boxTop     = tailY + boxGap;
      textX      = tailX;
      textY      = boxTop + padding + lineHeight * 0.75;
      textAnchor = 'middle';
    }

    const tiltDegrees = (((tailX * 2.5 + tailY * 1.5) % 600) / 100 - 3).toFixed(1);

    const labelGroup = document.createElementNS(SVG_NAMESPACE, 'g');
    labelGroup.setAttribute('transform', `rotate(${tiltDegrees}, ${textX}, ${textY})`);

    // Rough background box — slightly transparent so content shows through
    labelGroup.appendChild(roughCanvas.rectangle(boxLeft, boxTop, boxWidth, boxHeight, {
      roughness: 2.5, bowing: 1.8,
      stroke: ANNOTATION_COLOR, strokeWidth: 2.5,
      fill: 'rgb(25 0 28 / 0.86)', fillStyle: 'solid',
    }));

    // Stacked tspan text with wobble filter
    const textElement = document.createElementNS(SVG_NAMESPACE, 'text');
    textElement.setAttribute('x', String(textX));
    textElement.setAttribute('y', String(textY));
    textElement.setAttribute('text-anchor', textAnchor);
    textElement.setAttribute('filter', 'url(#__ann-wobble)');
    Object.assign(textElement.style, {
      font: 'bold 15px "Segoe UI", system-ui, sans-serif',
      fill: ANNOTATION_COLOR, letterSpacing: '0.03em',
    });
    lines.forEach((line, i) => {
      const span = document.createElementNS(SVG_NAMESPACE, 'tspan');
      span.setAttribute('x', String(textX));
      if (i > 0) span.setAttribute('dy', String(lineHeight));
      span.textContent = line;
      textElement.appendChild(span);
    });
    labelGroup.appendChild(textElement);
    svgCanvas.appendChild(labelGroup);
  };
})();
