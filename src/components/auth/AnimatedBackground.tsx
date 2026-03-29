"use client";

import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  brightness: number;
}

interface Trail {
  x: number;
  y: number;
  alpha: number;
}

export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    const stars: Star[] = [];
    const numStars = 100;
    const connectionDistance = 120;
    let rocketTrail: Trail[] = [];
    let time = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resize();
    window.addEventListener("resize", resize);

    const w = () => canvas.offsetWidth;
    const h = () => canvas.offsetHeight;

    // Initialize stars
    for (let i = 0; i < numStars; i++) {
      stars.push({
        x: Math.random() * w(),
        y: Math.random() * h(),
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: Math.random() * 1.5 + 0.5,
        brightness: Math.random(),
      });
    }

    // Draw rocket shape
    const drawRocket = (cx: number, cy: number, scale: number, angle: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.scale(scale, scale);

      // Rocket body glow
      const glow = ctx.createRadialGradient(0, 0, 5, 0, 0, 60);
      glow.addColorStop(0, "rgba(168, 85, 247, 0.15)");
      glow.addColorStop(1, "rgba(168, 85, 247, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, 60, 0, Math.PI * 2);
      ctx.fill();

      // Rocket nose cone
      ctx.beginPath();
      ctx.moveTo(0, -40);
      ctx.quadraticCurveTo(8, -30, 10, -15);
      ctx.lineTo(10, 20);
      ctx.lineTo(-10, 20);
      ctx.lineTo(-10, -15);
      ctx.quadraticCurveTo(-8, -30, 0, -40);
      ctx.closePath();

      const bodyGrad = ctx.createLinearGradient(-10, -40, 10, 20);
      bodyGrad.addColorStop(0, "rgba(192, 132, 252, 0.9)");
      bodyGrad.addColorStop(0.5, "rgba(139, 92, 246, 0.85)");
      bodyGrad.addColorStop(1, "rgba(109, 40, 217, 0.8)");
      ctx.fillStyle = bodyGrad;
      ctx.fill();

      ctx.strokeStyle = "rgba(216, 180, 254, 0.4)";
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Window
      ctx.beginPath();
      ctx.arc(0, -8, 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(196, 181, 253, 0.9)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Left fin
      ctx.beginPath();
      ctx.moveTo(-10, 12);
      ctx.lineTo(-20, 28);
      ctx.lineTo(-10, 22);
      ctx.closePath();
      ctx.fillStyle = "rgba(147, 51, 234, 0.7)";
      ctx.fill();

      // Right fin
      ctx.beginPath();
      ctx.moveTo(10, 12);
      ctx.lineTo(20, 28);
      ctx.lineTo(10, 22);
      ctx.closePath();
      ctx.fillStyle = "rgba(147, 51, 234, 0.7)";
      ctx.fill();

      // Exhaust flame (animated)
      const flameFlicker = Math.sin(time * 8) * 3;
      const flameHeight = 18 + flameFlicker;

      // Outer flame
      ctx.beginPath();
      ctx.moveTo(-8, 22);
      ctx.quadraticCurveTo(-4, 22 + flameHeight * 0.6, 0, 22 + flameHeight);
      ctx.quadraticCurveTo(4, 22 + flameHeight * 0.6, 8, 22);
      ctx.closePath();
      const outerFlame = ctx.createLinearGradient(0, 22, 0, 22 + flameHeight);
      outerFlame.addColorStop(0, "rgba(251, 146, 60, 0.9)");
      outerFlame.addColorStop(0.5, "rgba(249, 115, 22, 0.6)");
      outerFlame.addColorStop(1, "rgba(239, 68, 68, 0)");
      ctx.fillStyle = outerFlame;
      ctx.fill();

      // Inner flame
      ctx.beginPath();
      ctx.moveTo(-4, 22);
      ctx.quadraticCurveTo(-2, 22 + flameHeight * 0.4, 0, 22 + flameHeight * 0.7);
      ctx.quadraticCurveTo(2, 22 + flameHeight * 0.4, 4, 22);
      ctx.closePath();
      const innerFlame = ctx.createLinearGradient(0, 22, 0, 22 + flameHeight * 0.7);
      innerFlame.addColorStop(0, "rgba(253, 224, 71, 0.9)");
      innerFlame.addColorStop(1, "rgba(251, 146, 60, 0)");
      ctx.fillStyle = innerFlame;
      ctx.fill();

      ctx.restore();
    };

    // Draw curved trail behind rocket
    const drawRocketTrail = () => {
      if (rocketTrail.length < 2) return;

      for (let i = 1; i < rocketTrail.length; i++) {
        const t = rocketTrail[i];
        const prev = rocketTrail[i - 1];
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = `rgba(168, 85, 247, ${t.alpha * 0.3})`;
        ctx.lineWidth = t.alpha * 3;
        ctx.stroke();
      }
    };

    // Draw starfield grid (subtle)
    const drawGrid = () => {
      const gridSize = 50;
      const cols = Math.ceil(w() / gridSize) + 1;
      const rows = Math.ceil(h() / gridSize) + 1;

      ctx.strokeStyle = "rgba(139, 92, 246, 0.04)";
      ctx.lineWidth = 0.5;

      for (let i = 0; i < cols; i++) {
        ctx.beginPath();
        ctx.moveTo(i * gridSize, 0);
        ctx.lineTo(i * gridSize, h());
        ctx.stroke();
      }
      for (let i = 0; i < rows; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * gridSize);
        ctx.lineTo(w(), i * gridSize);
        ctx.stroke();
      }
    };

    // Nebula glow blobs
    const drawNebula = () => {
      const blobs = [
        { x: w() * 0.7, y: h() * 0.3, r: 200, color: "rgba(139, 92, 246, 0.06)" },
        { x: w() * 0.3, y: h() * 0.7, r: 180, color: "rgba(168, 85, 247, 0.04)" },
        { x: w() * 0.5, y: h() * 0.5, r: 250, color: "rgba(124, 58, 237, 0.03)" },
      ];

      blobs.forEach(({ x, y, r, color }) => {
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, color);
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    const animate = () => {
      time += 0.016;
      ctx.clearRect(0, 0, w(), h());

      // Background layers
      drawGrid();
      drawNebula();

      // Stars
      stars.forEach((star) => {
        star.x += star.vx;
        star.y += star.vy;

        if (star.x < 0 || star.x > w()) star.vx *= -1;
        if (star.y < 0 || star.y > h()) star.vy *= -1;

        const pulse = 0.5 + Math.sin(time * 2 + star.brightness * 10) * 0.5;

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(196, 181, 253, ${0.3 + pulse * 0.4})`;
        ctx.fill();
      });

      // Star connections
      for (let i = 0; i < stars.length; i++) {
        for (let j = i + 1; j < stars.length; j++) {
          const dx = stars[i].x - stars[j].x;
          const dy = stars[i].y - stars[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < connectionDistance) {
            ctx.beginPath();
            ctx.moveTo(stars[i].x, stars[i].y);
            ctx.lineTo(stars[j].x, stars[j].y);
            ctx.strokeStyle = `rgba(139, 92, 246, ${0.08 * (1 - dist / connectionDistance)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Rocket position — gentle orbit path
      const rocketX = w() * 0.55 + Math.sin(time * 0.4) * w() * 0.15;
      const rocketY = h() * 0.4 + Math.cos(time * 0.3) * h() * 0.12;
      const rocketAngle = Math.sin(time * 0.4) * 0.3 - 0.2;

      // Update trail
      rocketTrail.push({ x: rocketX, y: rocketY + 20, alpha: 1 });
      rocketTrail = rocketTrail
        .map((t) => ({ ...t, alpha: t.alpha - 0.015 }))
        .filter((t) => t.alpha > 0);

      drawRocketTrail();
      drawRocket(rocketX, rocketY, 1.8, rocketAngle);

      // Shooting stars
      for (let i = 0; i < 3; i++) {
        const sx = (time * 80 + i * 300) % (w() + 200) - 100;
        const sy = 50 + i * 120 + Math.sin(time + i) * 40;
        const len = 30 + Math.sin(time * 3 + i) * 10;

        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - len, sy + len * 0.4);
        const shootGrad = ctx.createLinearGradient(sx, sy, sx - len, sy + len * 0.4);
        shootGrad.addColorStop(0, "rgba(216, 180, 254, 0.4)");
        shootGrad.addColorStop(1, "rgba(216, 180, 254, 0)");
        ctx.strokeStyle = shootGrad;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ background: "transparent" }}
    />
  );
}
