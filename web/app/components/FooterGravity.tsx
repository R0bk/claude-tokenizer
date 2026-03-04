"use client";

import { useEffect, useRef } from "react";

interface StrayDot {
  baseX: number;
  baseY: number;
  size: number;
  drift: number;
}

const COLOR_LUT_GRID: string[] = [];
const COLOR_LUT_STRAY: string[] = [];
for (let i = 0; i < 16; i++) {
  const stress = i / 15;
  const grayGrid = Math.round(70 + 110 * stress);
  const blueGrid = Math.round(stress * 30);
  COLOR_LUT_GRID[i] = `rgb(${Math.round(grayGrid - blueGrid * 0.3)},${grayGrid},${grayGrid + blueGrid})`;

  const grayStray = Math.round(80 + 100 * stress);
  const blueStray = Math.round(stress * 50);
  COLOR_LUT_STRAY[i] = `rgb(${Math.round(grayStray - blueStray * 0.3)},${grayStray},${grayStray + blueStray})`;
}

export function FooterGravity() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wellRef = useRef<HTMLDivElement>(null);
  const strayDotsRef = useRef<StrayDot[]>([]);
  const mouseRef = useRef<{ x: number | null; y: number | null }>({
    x: null,
    y: null,
  });
  const isAnimatingRef = useRef(false);
  const rafIdRef = useRef<number>(0);
  const dimensionsRef = useRef<{
    width: number;
    height: number;
    centerX: number;
    centerY: number;
    containerHeight: number;
    gridStartY: number;
    gridEndY: number;
  }>({
    width: 0,
    height: 0,
    centerX: 0,
    centerY: 0,
    containerHeight: 0,
    gridStartY: 0,
    gridEndY: 0,
  });

  const canvasOffset = 200;
  const numStrays = 240;
  const cols = 60;
  const rows = 24;

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const well = wellRef.current;
    if (!canvas || !container || !well) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let rowYPositions: number[] = [];
    let colXPositions: number[] = [];

    function gravityForce(
      dist: number,
      mass: number,
      softening = 20
    ): number {
      return mass / ((dist + softening) * (dist + softening));
    }

    function initStrays() {
      const { width, gridStartY } = dimensionsRef.current;
      strayDotsRef.current = [];
      const spacingX = width / (cols + 1);

      for (let i = 0; i < numStrays; i++) {
        const col = Math.floor(Math.random() * cols) + 1;
        const gridX = col * spacingX;
        const baseY = 80 + Math.random() * 160;
        const yDistFromGrid = Math.max(0, gridStartY - baseY);
        const driftFactor = Math.min(yDistFromGrid / 100, 1);
        const maxDrift = driftFactor * spacingX;
        const xDrift = (Math.random() - 0.5) * 2 * maxDrift;

        strayDotsRef.current.push({
          baseX: gridX + xDrift,
          baseY,
          size: 0.5 + Math.random() * 0.6,
          drift: Math.random() * Math.PI * 2,
        });
      }
    }

    function setup() {
      const containerRect = container!.getBoundingClientRect();
      const wellRect = well!.getBoundingClientRect();

      const containerHeight = containerRect.height;
      const width = containerRect.width;
      const height = containerHeight + canvasOffset * 2;

      canvas!.width = width;
      canvas!.height = height;
      canvas!.style.width = width + "px";
      canvas!.style.height = height + "px";
      canvas!.style.top = -canvasOffset + "px";

      const centerX = width / 2;
      const centerY =
        canvasOffset +
        (wellRect.top - containerRect.top) +
        wellRect.height / 2;
      const gridStartY = canvasOffset + 40;
      const gridEndY = height;

      dimensionsRef.current = {
        width,
        height,
        centerX,
        centerY,
        containerHeight,
        gridStartY,
        gridEndY,
      };

      const spacingX = width / (cols + 1);
      const gridHeight = gridEndY - gridStartY;

      rowYPositions = [];
      for (let row = 0; row < rows; row++) {
        const t = row / (rows - 1);
        const tCurved = Math.pow(t, 0.6);
        rowYPositions[row] = gridStartY + tCurved * gridHeight;
      }

      colXPositions = [];
      for (let col = 1; col <= cols; col++) {
        colXPositions[col] = col * spacingX;
      }

      initStrays();
      drawStatic();
    }

    function drawStatic() {
      const { width, height } = dimensionsRef.current;
      if (!ctx || width === 0) return;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = COLOR_LUT_GRID[0];

      ctx.beginPath();
      for (let row = 0; row < rows; row++) {
        const baseY = rowYPositions[row];
        for (let col = 1; col <= cols; col++) {
          const baseX = colXPositions[col];
          ctx.moveTo(baseX + 0.8, baseY);
          ctx.arc(baseX, baseY, 0.8, 0, Math.PI * 2);
        }
      }
      ctx.fill();

      const time = Date.now() * 0.001;
      ctx.fillStyle = COLOR_LUT_STRAY[0];
      ctx.beginPath();
      for (const stray of strayDotsRef.current) {
        const x = stray.baseX + Math.sin(time + stray.drift) * 3;
        const y = stray.baseY + Math.cos(time * 0.7 + stray.drift) * 2;
        ctx.moveTo(x + stray.size, y);
        ctx.arc(x, y, stray.size, 0, Math.PI * 2);
      }
      ctx.fill();
    }

    function draw() {
      const { width, height } = dimensionsRef.current;
      const { x: mouseX, y: mouseY } = mouseRef.current;

      if (!ctx || width === 0) {
        if (isAnimatingRef.current)
          rafIdRef.current = requestAnimationFrame(draw);
        return;
      }

      if (mouseX === null || mouseY === null) {
        drawStatic();
        isAnimatingRef.current = false;
        return;
      }

      ctx.clearRect(0, 0, width, height);

      const mouseMass = 18000;

      const gridBuckets: { x: number; y: number; size: number }[][] =
        Array.from({ length: 16 }, () => []);
      const strayBuckets: { x: number; y: number; size: number }[][] =
        Array.from({ length: 16 }, () => []);

      for (let row = 0; row < rows; row++) {
        const baseY = rowYPositions[row];
        for (let col = 1; col <= cols; col++) {
          const baseX = colXPositions[col];
          let x = baseX;
          let y = baseY;

          const dxMouse = mouseX - baseX;
          const dyMouse = mouseY - baseY;
          const distMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);

          let totalForce = 0;
          if (distMouse > 0) {
            const force = Math.min(
              gravityForce(distMouse, mouseMass, 15),
              20
            );
            x += (dxMouse / distMouse) * force;
            y += (dyMouse / distMouse) * force;
            totalForce = force;
          }

          const stress = Math.min(totalForce / 8, 1);
          const colorIdx = Math.min(15, Math.floor(stress * 15));
          const size = 0.8 + stress * 0.4;
          gridBuckets[colorIdx].push({ x, y, size });
        }
      }

      const time = Date.now() * 0.001;
      for (const stray of strayDotsRef.current) {
        let x = stray.baseX + Math.sin(time + stray.drift) * 3;
        let y = stray.baseY + Math.cos(time * 0.7 + stray.drift) * 2;

        const dx = mouseX - x;
        const dy = mouseY - y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let totalForce = 0;
        if (dist > 0) {
          const force = Math.min(
            gravityForce(dist, mouseMass * 1.5, 25),
            35
          );
          x += (dx / dist) * force;
          y += (dy / dist) * force;
          totalForce = force;
        }

        const stress = Math.min(totalForce / 6, 1);
        const colorIdx = Math.min(15, Math.floor(stress * 15));
        const size = stray.size + stress * 0.3;
        strayBuckets[colorIdx].push({ x, y, size });
      }

      for (let i = 0; i < 16; i++) {
        if (gridBuckets[i].length > 0) {
          ctx.fillStyle = COLOR_LUT_GRID[i];
          ctx.beginPath();
          for (const dot of gridBuckets[i]) {
            ctx.moveTo(dot.x + dot.size, dot.y);
            ctx.arc(dot.x, dot.y, dot.size, 0, Math.PI * 2);
          }
          ctx.fill();
        }

        if (strayBuckets[i].length > 0) {
          ctx.fillStyle = COLOR_LUT_STRAY[i];
          ctx.beginPath();
          for (const dot of strayBuckets[i]) {
            ctx.moveTo(dot.x + dot.size, dot.y);
            ctx.arc(dot.x, dot.y, dot.size, 0, Math.PI * 2);
          }
          ctx.fill();
        }
      }

      if (isAnimatingRef.current) {
        rafIdRef.current = requestAnimationFrame(draw);
      }
    }

    function startAnimation() {
      if (!isAnimatingRef.current) {
        isAnimatingRef.current = true;
        rafIdRef.current = requestAnimationFrame(draw);
      }
    }

    let lastMouseUpdate = 0;
    const buffer = 200;
    function handleMouseMove(e: MouseEvent) {
      const now = performance.now();
      if (now - lastMouseUpdate < 16) return;
      lastMouseUpdate = now;

      const rect = canvas!.getBoundingClientRect();
      const inBufferZone =
        e.clientX >= rect.left - buffer &&
        e.clientX <= rect.right + buffer &&
        e.clientY >= rect.top - buffer &&
        e.clientY <= rect.bottom + buffer;

      if (inBufferZone) {
        mouseRef.current = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };
        startAnimation();
      } else if (mouseRef.current.x !== null) {
        mouseRef.current = { x: null, y: null };
        drawStatic();
      }
    }

    document.addEventListener("mousemove", handleMouseMove, { passive: true });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setup();
      });
    });

    window.addEventListener("resize", setup);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", setup);
      cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative py-20 flex items-center justify-center overflow-visible"
    >
      <canvas
        ref={canvasRef}
        className="absolute left-0 opacity-60"
        style={{
          pointerEvents: "none",
          willChange: "contents",
          transform: "translateZ(0)",
        }}
      />
      <div
        ref={wellRef}
        className="absolute"
        style={{ width: 1, height: 1 }}
      />
    </div>
  );
}
