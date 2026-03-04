"use client";

import { useEffect, useRef } from "react";

export function PhysicsCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight * 1.5);
    let animationId: number;

    class GravityWell {
      centerX: number;
      centerY: number;
      x: number;
      y: number;
      mass: number;
      radius: number;
      orbitRadius: number;
      orbitSpeed: number;
      angle: number;

      constructor(
        x: number,
        y: number,
        mass: number,
        orbitRadius = 0,
        orbitSpeed = 0
      ) {
        this.centerX = x;
        this.centerY = y;
        this.x = x;
        this.y = y;
        this.mass = mass;
        this.radius = Math.cbrt(mass) * 2;
        this.orbitRadius = orbitRadius;
        this.orbitSpeed = orbitSpeed;
        this.angle = Math.random() * Math.PI * 2;
      }

      update() {
        if (this.orbitRadius > 0) {
          this.angle += this.orbitSpeed;
          this.x = this.centerX + Math.cos(this.angle) * this.orbitRadius;
          this.y = this.centerY + Math.sin(this.angle) * this.orbitRadius;
        }
      }

      draw() {
        const lineColor = "rgba(255, 255, 255, 1)";
        const dimLineColor = "rgba(255, 255, 255, 0.2)";

        ctx!.imageSmoothingEnabled = false;
        ctx!.lineWidth = 1;
        ctx!.setLineDash([2, 4]);

        for (let i = 1; i <= 10; i++) {
          const opacity = 0.4 - (i - 1) * 0.07;
          ctx!.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
          ctx!.beginPath();
          ctx!.arc(
            this.x,
            this.y + i ** 2,
            this.radius * (1 + i * 1.2),
            0,
            Math.PI * 2
          );
          ctx!.stroke();
        }

        ctx!.setLineDash([]);

        ctx!.strokeStyle = lineColor;
        ctx!.lineWidth = 0.5;
        ctx!.beginPath();
        ctx!.arc(
          Math.round(this.x),
          Math.round(this.y),
          Math.round(this.radius),
          0,
          Math.PI * 2
        );
        ctx!.stroke();

        ctx!.lineWidth = 0.2;
        ctx!.beginPath();
        ctx!.moveTo(this.x - this.radius - 3, this.y);
        ctx!.lineTo(this.x - this.radius + 5, this.y);
        ctx!.moveTo(this.x + this.radius - 5, this.y);
        ctx!.lineTo(this.x + this.radius + 3, this.y);
        ctx!.moveTo(this.x, this.y - this.radius - 3);
        ctx!.lineTo(this.x, this.y - this.radius + 5);
        ctx!.moveTo(this.x, this.y + this.radius - 5);
        ctx!.lineTo(this.x, this.y + this.radius + 3);
        ctx!.stroke();

        ctx!.fillStyle = lineColor;
        ctx!.beginPath();
        ctx!.arc(this.x, this.y, 3, 0, Math.PI * 2);
        ctx!.fill();

        ctx!.strokeStyle = dimLineColor;
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.arc(
          this.x,
          this.y,
          this.radius * 2.5,
          -Math.PI * 0.3,
          Math.PI * 0.3
        );
        ctx!.stroke();

        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.moveTo(this.x + this.radius + 15, this.y - 5);
        ctx!.lineTo(this.x + this.radius + 30, this.y - 15);
        ctx!.lineTo(this.x + this.radius + 50, this.y - 15);
        ctx!.stroke();

        ctx!.font = "10px monospace";
        ctx!.fillStyle = dimLineColor;
        ctx!.fillText(
          `M:${this.mass}`,
          this.x + this.radius + 55,
          this.y - 12
        );
      }
    }

    class Particle {
      x = 0;
      y = 0;
      vx = 0;
      vy = 0;
      life = 1;
      maxLife = 1;
      size = 1;
      trail: { x: number; y: number; life: number }[] = [];
      maxTrailLength = 150;

      constructor() {
        this.reset();
      }

      reset() {
        this.trail = [];
        const side = Math.floor(Math.random() * 4);
        switch (side) {
          case 0:
            this.x = Math.random() * width;
            this.y = -10;
            this.vx = (Math.random() - 0.5) * 4;
            this.vy = Math.random() * 3 + 2;
            break;
          case 1:
            this.x = width + 10;
            this.y = Math.random() * height;
            this.vx = -(Math.random() * 3 + 2);
            this.vy = (Math.random() - 0.5) * 4;
            break;
          case 2:
            this.x = Math.random() * width;
            this.y = height + 10;
            this.vx = (Math.random() - 0.5) * 4;
            this.vy = -(Math.random() * 3 + 2);
            break;
          case 3:
            this.x = -10;
            this.y = Math.random() * height;
            this.vx = Math.random() * 3 + 2;
            this.vy = (Math.random() - 0.5) * 4;
            break;
        }
        this.life = 1;
        this.maxLife = 1;
        this.size = Math.random() * 1 + 0.5;
      }

      update(wells: GravityWell[]) {
        this.trail.push({ x: this.x, y: this.y, life: this.life });
        if (this.trail.length > this.maxTrailLength) {
          this.trail.shift();
        }

        for (const well of wells) {
          const dx = well.x - this.x;
          const dy = well.y - this.y;
          const distSq = dx * dx + dy * dy;
          const dist = Math.sqrt(distSq);

          if (dist < 1200 && dist > well.radius) {
            let force: number;
            if (dist > well.radius * 4) {
              force = (well.mass * 0.3) / distSq;
            } else if (dist > well.radius * 2) {
              force = (well.mass * 0.15) / distSq;
            } else {
              force = (well.mass * 0.05) / distSq;
            }
            this.vx += (dx / dist) * force;
            this.vy += (dy / dist) * force;
          } else if (dist <= well.radius && dist > 0) {
            this.life -= 0.1;
            if (this.life <= 0) {
              this.reset();
              return;
            }
          }
        }

        this.vx *= 0.999;
        this.vy *= 0.999;

        const maxSpeed = 8;
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > maxSpeed) {
          this.vx = (this.vx / speed) * maxSpeed;
          this.vy = (this.vy / speed) * maxSpeed;
        }

        this.x += this.vx;
        this.y += this.vy;
        this.life -= 0.0005;

        if (
          this.life <= 0 ||
          this.x < -200 ||
          this.x > width + 200 ||
          this.y < -200 ||
          this.y > height + 200
        ) {
          this.reset();
        }
      }

      draw() {
        if (this.trail.length > 5) {
          for (let i = 1; i < this.trail.length; i++) {
            const alpha = (i / this.trail.length) * this.life * 0.9;
            ctx!.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx!.lineWidth = 0.3;
            ctx!.beginPath();
            ctx!.moveTo(this.trail[i - 1].x, this.trail[i - 1].y);
            ctx!.lineTo(this.trail[i].x, this.trail[i].y);
            ctx!.stroke();
          }
        }

        const rectSize = this.size * 3;
        const x = Math.round(this.x - rectSize / 2);
        const y = Math.round(this.y - rectSize / 2);

        ctx!.fillStyle = "#0a0a0a";
        ctx!.fillRect(x, y, rectSize, rectSize);

        ctx!.strokeStyle = `rgba(255, 255, 255, ${this.life})`;
        ctx!.lineWidth = 0.5;
        ctx!.strokeRect(x, y, rectSize, rectSize);
      }
    }

    function drawSpaceTimeGrid(wells: GravityWell[]) {
      ctx!.strokeStyle = "rgba(255, 255, 255, 0.015)";
      ctx!.lineWidth = 0.5;

      const gridSize = 30;
      const gridPoints: Record<number, Record<number, { x: number; y: number }>> = {};

      for (let x = 0; x <= width; x += gridSize) {
        gridPoints[x] = {};
        for (let y = 0; y <= height; y += gridSize) {
          let offsetX = 0;
          let offsetY = 0;

          for (const well of wells) {
            const dx = well.x - x;
            const dy = well.y - y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 0 && dist < 300) {
              const warp = (well.mass * 0.15) / (dist + 30);
              offsetX += (dx / dist) * warp;
              offsetY += (dy / dist) * warp;
            }
          }

          gridPoints[x][y] = { x: x + offsetX, y: y + offsetY };
        }
      }

      for (let y = 0; y <= height; y += gridSize) {
        ctx!.beginPath();
        for (let x = 0; x <= width; x += gridSize) {
          if (gridPoints[x]?.[y]) {
            if (x === 0) {
              ctx!.moveTo(gridPoints[x][y].x, gridPoints[x][y].y);
            } else {
              ctx!.lineTo(gridPoints[x][y].x, gridPoints[x][y].y);
            }
          }
        }
        ctx!.stroke();
      }

      for (let x = 0; x <= width; x += gridSize) {
        ctx!.beginPath();
        for (let y = 0; y <= height; y += gridSize) {
          if (gridPoints[x]?.[y]) {
            if (y === 0) {
              ctx!.moveTo(gridPoints[x][y].x, gridPoints[x][y].y);
            } else {
              ctx!.lineTo(gridPoints[x][y].x, gridPoints[x][y].y);
            }
          }
        }
        ctx!.stroke();
      }
    }

    const gravityWells = [
      new GravityWell(width * 0.3, height * 0.4, 300, 30, 0.0005),
      new GravityWell(width * 0.7, height * 0.6, 400, 40, -0.0003),
      new GravityWell(width * 0.5, height * 0.3, 250, 25, 0.0007),
    ];

    const particles: Particle[] = [];
    for (let i = 0; i < 10; i++) {
      setTimeout(() => {
        particles.push(new Particle());
      }, i * 150);
    }

    let mouseWell: GravityWell | null = null;

    const onMouseDown = (e: MouseEvent) => {
      mouseWell = new GravityWell(e.clientX, e.clientY, 50);
    };
    const onMouseUp = () => {
      mouseWell = null;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (mouseWell) {
        mouseWell.x = e.clientX;
        mouseWell.y = e.clientY;
      }
    };

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mousemove", onMouseMove);

    function animate() {
      ctx!.clearRect(0, 0, width, height);

      gravityWells.forEach((well) => well.update());

      const allWells = mouseWell
        ? [...gravityWells, mouseWell]
        : gravityWells;
      drawSpaceTimeGrid(allWells);

      gravityWells.forEach((well) => well.draw());
      if (mouseWell) mouseWell.draw();

      particles.forEach((particle) => {
        particle.update(allWells);
        particle.draw();
      });

      animationId = requestAnimationFrame(animate);
    }

    const onResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight * 1.5;

      gravityWells[0].centerX = width * 0.3;
      gravityWells[0].centerY = height * 0.4;
      gravityWells[1].centerX = width * 0.7;
      gravityWells[1].centerY = height * 0.6;
      gravityWells[2].centerX = width * 0.5;
      gravityWells[2].centerY = height * 0.3;
    };

    window.addEventListener("resize", onResize);
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full"
      style={{
        height: "150%",
        width: "120%",
        marginTop: "-40vh",
        marginLeft: "-10%",
      }}
    />
  );
}
