"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ArrowRight, Sparkles, Globe, Cpu, Shield, ChevronDown, Rocket } from "lucide-react";

// ─── Phase timeline (seconds) ─────────────────────────────────────
const COUNTDOWN_DURATION = 4;    // 3..2..1..LAUNCH
const LAUNCH_DURATION = 3;       // rocket rises off Earth
const TRAVEL_DURATION = 4;       // flying through space
const ARRIVAL_DURATION = 2.5;    // approaching Mars
const TOTAL_INTRO = COUNTDOWN_DURATION + LAUNCH_DURATION + TRAVEL_DURATION + ARRIVAL_DURATION;

// ─── Cinematic Canvas ──────────────────────────────────────────────
function CinematicCanvas({ phase, elapsed }: { phase: string; elapsed: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ phase, elapsed });

  useEffect(() => {
    stateRef.current = { phase, elapsed };
  }, [phase, elapsed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    interface Star { x: number; y: number; z: number; r: number; b: number; speed: number }
    const stars: Star[] = [];

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const W = () => window.innerWidth;
    const H = () => window.innerHeight;

    // Init 400 stars
    for (let i = 0; i < 400; i++) {
      stars.push({
        x: (Math.random() - 0.5) * W() * 4,
        y: (Math.random() - 0.5) * H() * 4,
        z: Math.random() * 2000 + 100,
        r: Math.random() * 1.5 + 0.3,
        b: Math.random(),
        speed: Math.random() * 1.5 + 0.3,
      });
    }

    // ── Draw Earth ──
    const drawEarth = (cx: number, cy: number, radius: number) => {
      ctx.save();

      // Atmosphere glow
      const atmo = ctx.createRadialGradient(cx, cy, radius * 0.9, cx, cy, radius * 1.6);
      atmo.addColorStop(0, "rgba(59,130,246,0.15)");
      atmo.addColorStop(0.5, "rgba(59,130,246,0.05)");
      atmo.addColorStop(1, "rgba(59,130,246,0)");
      ctx.fillStyle = atmo;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.6, 0, Math.PI * 2);
      ctx.fill();

      // Planet body
      const earthGrad = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, radius * 0.1, cx, cy, radius);
      earthGrad.addColorStop(0, "#4da6ff");
      earthGrad.addColorStop(0.3, "#1e6fbf");
      earthGrad.addColorStop(0.5, "#1a5a9e");
      earthGrad.addColorStop(0.7, "#0d4a8a");
      earthGrad.addColorStop(1, "#0a2e5c");
      ctx.fillStyle = earthGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      // Continents (abstract green patches)
      ctx.globalAlpha = 0.35;
      const continents = [
        { ax: -0.2, ay: -0.15, s: 0.35 },
        { ax: 0.15, ay: 0.1, s: 0.25 },
        { ax: -0.1, ay: 0.25, s: 0.2 },
        { ax: 0.3, ay: -0.2, s: 0.18 },
        { ax: -0.35, ay: 0.05, s: 0.15 },
      ];
      continents.forEach(({ ax, ay, s }) => {
        const cx2 = cx + ax * radius + Math.sin(time * 0.1) * radius * 0.02;
        const cy2 = cy + ay * radius;
        const r2 = s * radius;
        const cg = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, r2);
        cg.addColorStop(0, "#2d8a4e");
        cg.addColorStop(0.7, "#1a6b35");
        cg.addColorStop(1, "transparent");
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(cx2, cy2, r2, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Cloud wisps
      ctx.globalAlpha = 0.15;
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + time * 0.05;
        const dist = radius * (0.4 + Math.sin(i * 1.3) * 0.25);
        const wx = cx + Math.cos(angle) * dist;
        const wy = cy + Math.sin(angle) * dist * 0.6;
        const wr = radius * 0.15;
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.ellipse(wx, wy, wr * 1.5, wr * 0.6, angle * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Specular highlight
      const spec = ctx.createRadialGradient(cx - radius * 0.35, cy - radius * 0.35, 0, cx, cy, radius);
      spec.addColorStop(0, "rgba(255,255,255,0.15)");
      spec.addColorStop(0.4, "rgba(255,255,255,0.03)");
      spec.addColorStop(1, "rgba(0,0,0,0.2)");
      ctx.fillStyle = spec;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    // ── Draw Mars ──
    const drawMars = (cx: number, cy: number, radius: number) => {
      ctx.save();

      // Atmosphere
      const atmo = ctx.createRadialGradient(cx, cy, radius * 0.9, cx, cy, radius * 1.4);
      atmo.addColorStop(0, "rgba(239,68,68,0.1)");
      atmo.addColorStop(1, "rgba(239,68,68,0)");
      ctx.fillStyle = atmo;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.4, 0, Math.PI * 2);
      ctx.fill();

      // Body
      const mg = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, radius * 0.1, cx, cy, radius);
      mg.addColorStop(0, "#e8734a");
      mg.addColorStop(0.3, "#c4522a");
      mg.addColorStop(0.6, "#a63d1e");
      mg.addColorStop(1, "#6b2510");
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      // Surface features (craters)
      ctx.globalAlpha = 0.2;
      const craters = [
        { ax: -0.15, ay: 0.1, s: 0.2 },
        { ax: 0.25, ay: -0.15, s: 0.15 },
        { ax: 0.05, ay: 0.3, s: 0.12 },
        { ax: -0.3, ay: -0.2, s: 0.1 },
        { ax: 0.2, ay: 0.2, s: 0.18 },
      ];
      craters.forEach(({ ax, ay, s }) => {
        const cx2 = cx + ax * radius;
        const cy2 = cy + ay * radius;
        const r2 = s * radius;
        const cg = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, r2);
        cg.addColorStop(0, "#8b3a1a");
        cg.addColorStop(1, "transparent");
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(cx2, cy2, r2, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Ice cap
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = "#f5d5c0";
      ctx.beginPath();
      ctx.ellipse(cx, cy - radius * 0.85, radius * 0.3, radius * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Specular
      const spec = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, 0, cx, cy, radius);
      spec.addColorStop(0, "rgba(255,255,255,0.1)");
      spec.addColorStop(0.5, "rgba(255,255,255,0)");
      spec.addColorStop(1, "rgba(0,0,0,0.25)");
      ctx.fillStyle = spec;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    // ── Draw small planets ──
    const drawMiniPlanet = (cx: number, cy: number, radius: number, color1: string, color2: string, ringColor?: string) => {
      ctx.save();

      // Glow
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 2);
      g.addColorStop(0, color1.replace(")", ",0.1)").replace("rgb", "rgba"));
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 2, 0, Math.PI * 2);
      ctx.fill();

      const pg = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, 0, cx, cy, radius);
      pg.addColorStop(0, color1);
      pg.addColorStop(1, color2);
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      // Optional ring (Saturn-like)
      if (ringColor) {
        ctx.strokeStyle = ringColor;
        ctx.lineWidth = radius * 0.15;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.ellipse(cx, cy, radius * 1.8, radius * 0.4, -0.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      ctx.restore();
    };

    // ── Draw Rocket ──
    const drawRocket = (cx: number, cy: number, scale: number, angle: number, flameIntensity: number = 1) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.scale(scale, scale);

      // Body glow
      const glow = ctx.createRadialGradient(0, 0, 5, 0, 0, 80);
      glow.addColorStop(0, `rgba(168,85,247,${0.2 * flameIntensity})`);
      glow.addColorStop(1, "rgba(168,85,247,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, 80, 0, Math.PI * 2);
      ctx.fill();

      // Body
      ctx.beginPath();
      ctx.moveTo(0, -40);
      ctx.quadraticCurveTo(8, -30, 10, -15);
      ctx.lineTo(10, 20);
      ctx.lineTo(-10, 20);
      ctx.lineTo(-10, -15);
      ctx.quadraticCurveTo(-8, -30, 0, -40);
      ctx.closePath();
      const bg = ctx.createLinearGradient(-10, -40, 10, 20);
      bg.addColorStop(0, "rgba(220,180,255,0.95)");
      bg.addColorStop(0.5, "rgba(168,120,255,0.9)");
      bg.addColorStop(1, "rgba(109,40,217,0.85)");
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Stripe detail
      ctx.fillStyle = "rgba(139,92,246,0.5)";
      ctx.fillRect(-8, 5, 16, 3);

      // Window
      ctx.beginPath();
      ctx.arc(0, -10, 5, 0, Math.PI * 2);
      const wg = ctx.createRadialGradient(-1, -11, 1, 0, -10, 5);
      wg.addColorStop(0, "rgba(200,220,255,1)");
      wg.addColorStop(1, "rgba(140,160,255,0.8)");
      ctx.fillStyle = wg;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 0.6;
      ctx.stroke();

      // Fins
      ctx.beginPath();
      ctx.moveTo(-10, 10); ctx.lineTo(-22, 30); ctx.lineTo(-10, 22); ctx.closePath();
      ctx.fillStyle = "rgba(147,51,234,0.8)";
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(10, 10); ctx.lineTo(22, 30); ctx.lineTo(10, 22); ctx.closePath();
      ctx.fillStyle = "rgba(147,51,234,0.8)";
      ctx.fill();

      // Exhaust flame
      if (flameIntensity > 0) {
        const ff = Math.sin(time * 10) * 5 * flameIntensity;
        const fh = (25 + ff) * flameIntensity;

        // Outer flame
        ctx.beginPath();
        ctx.moveTo(-9, 22);
        ctx.quadraticCurveTo(-5, 22 + fh * 0.5, 0, 22 + fh);
        ctx.quadraticCurveTo(5, 22 + fh * 0.5, 9, 22);
        ctx.closePath();
        const ofg = ctx.createLinearGradient(0, 22, 0, 22 + fh);
        ofg.addColorStop(0, `rgba(251,146,60,${0.95 * flameIntensity})`);
        ofg.addColorStop(0.4, `rgba(249,115,22,${0.7 * flameIntensity})`);
        ofg.addColorStop(1, "rgba(239,68,68,0)");
        ctx.fillStyle = ofg;
        ctx.fill();

        // Inner flame
        ctx.beginPath();
        ctx.moveTo(-5, 22);
        ctx.quadraticCurveTo(-2, 22 + fh * 0.35, 0, 22 + fh * 0.75);
        ctx.quadraticCurveTo(2, 22 + fh * 0.35, 5, 22);
        ctx.closePath();
        const ifg = ctx.createLinearGradient(0, 22, 0, 22 + fh * 0.75);
        ifg.addColorStop(0, `rgba(253,224,71,${0.95 * flameIntensity})`);
        ifg.addColorStop(1, "rgba(251,191,36,0)");
        ctx.fillStyle = ifg;
        ctx.fill();

        // Core white
        ctx.beginPath();
        ctx.moveTo(-2, 22);
        ctx.quadraticCurveTo(-1, 22 + fh * 0.2, 0, 22 + fh * 0.4);
        ctx.quadraticCurveTo(1, 22 + fh * 0.2, 2, 22);
        ctx.closePath();
        ctx.fillStyle = `rgba(255,255,255,${0.6 * flameIntensity})`;
        ctx.fill();

        // Exhaust sparks
        for (let i = 0; i < 8; i++) {
          const sx = (Math.random() - 0.5) * 20;
          const sy = 22 + fh * (0.2 + Math.random() * 0.8);
          const sr = Math.random() * 1.5 + 0.3;
          ctx.beginPath();
          ctx.arc(sx, sy, sr, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(251,191,36,${Math.random() * 0.5 * flameIntensity})`;
          ctx.fill();
        }
      }

      ctx.restore();
    };

    // ── Smoke particles for launch ──
    interface Smoke { x: number; y: number; r: number; alpha: number; vx: number; vy: number }
    let smokeParticles: Smoke[] = [];

    // ── Nebula blobs ──
    const drawNebula = () => {
      const blobs = [
        { x: W() * 0.12, y: H() * 0.25, r: 350, c: "rgba(88,28,135,0.07)" },
        { x: W() * 0.88, y: H() * 0.55, r: 400, c: "rgba(124,58,237,0.05)" },
        { x: W() * 0.5, y: H() * 0.75, r: 300, c: "rgba(168,85,247,0.04)" },
        { x: W() * 0.7, y: H() * 0.15, r: 280, c: "rgba(59,130,246,0.03)" },
      ];
      blobs.forEach(({ x, y, r, c }) => {
        const bx = x + Math.sin(time * 0.08 + x) * 15;
        const by = y + Math.cos(time * 0.06 + y) * 10;
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, r);
        g.addColorStop(0, c);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(bx, by, r, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    // ── Main render loop ──
    const animate = () => {
      time += 0.016;
      const { phase, elapsed } = stateRef.current;
      ctx.clearRect(0, 0, W(), H());

      // ─ BG gradient depends on phase ─
      let bgGrad: CanvasGradient;
      if (phase === "countdown" || phase === "launch") {
        // Dark sky → horizon glow for launch
        bgGrad = ctx.createLinearGradient(0, 0, 0, H());
        bgGrad.addColorStop(0, "#010008");
        bgGrad.addColorStop(0.5, "#020010");
        bgGrad.addColorStop(0.85, "#0a0a30");
        const horizonGlow = Math.max(0, Math.min(1, (elapsed - COUNTDOWN_DURATION) / LAUNCH_DURATION));
        if (phase === "launch") {
          bgGrad.addColorStop(0.95, `rgba(30,20,80,${0.3 + horizonGlow * 0.3})`);
        }
        bgGrad.addColorStop(1, "#050015");
      } else {
        bgGrad = ctx.createLinearGradient(0, 0, 0, H());
        bgGrad.addColorStop(0, "#010005");
        bgGrad.addColorStop(0.4, "#050015");
        bgGrad.addColorStop(1, "#020008");
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W(), H());

      // Nebulae (always, but subtle)
      drawNebula();

      // ─ Stars ─
      const cx = W() / 2;
      const cy = H() / 2;
      const focal = 300;
      const starSpeed = phase === "travel" ? 8 + elapsed * 2 : phase === "launch" ? 1 + elapsed * 0.5 : 0.3;

      stars.forEach((s) => {
        s.z -= s.speed * starSpeed * 0.3;
        if (s.z <= 1) {
          s.x = (Math.random() - 0.5) * W() * 4;
          s.y = (Math.random() - 0.5) * H() * 4;
          s.z = 2000;
        }
        const sc = focal / s.z;
        const sx = s.x * sc + cx;
        const sy = s.y * sc + cy;
        if (sx < -20 || sx > W() + 20 || sy < -20 || sy > H() + 20) return;

        const alpha = Math.min(1, (2000 - s.z) / 1500);
        const pulse = 0.6 + Math.sin(time * 1.5 + s.b * 8) * 0.4;
        const r = s.r * sc * 1.2;

        // Star streak in travel
        if (phase === "travel" && r > 0.5) {
          const streakLen = Math.min(r * starSpeed * 0.8, 30);
          const dx = sx - cx;
          const dy = sy - cy;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const nx = dx / dist;
          const ny = dy / dist;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx - nx * streakLen, sy - ny * streakLen);
          const sg = ctx.createLinearGradient(sx, sy, sx - nx * streakLen, sy - ny * streakLen);
          sg.addColorStop(0, `rgba(200,180,255,${alpha * pulse * 0.5})`);
          sg.addColorStop(1, "rgba(200,180,255,0)");
          ctx.strokeStyle = sg;
          ctx.lineWidth = Math.max(0.5, r * 0.8);
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(0.3, r), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220,210,255,${alpha * pulse})`;
        ctx.fill();
      });

      // Shooting stars
      for (let i = 0; i < 3; i++) {
        const period = 7 + i * 4;
        const ph = (time % period) / period;
        if (ph > 0.25) continue;
        const t = ph / 0.25;
        const sx = W() * (0.1 + i * 0.3) + t * W() * 0.35;
        const sy = H() * (0.05 + i * 0.12) + t * H() * 0.12;
        const len = 50 + Math.sin(time * 2 + i) * 15;
        const a = Math.sin(t * Math.PI) * 0.5;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - len, sy + len * 0.3);
        const sg = ctx.createLinearGradient(sx, sy, sx - len, sy + len * 0.3);
        sg.addColorStop(0, `rgba(216,180,254,${a})`);
        sg.addColorStop(1, "rgba(216,180,254,0)");
        ctx.strokeStyle = sg;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // ═══════════════════════════════════
      // PHASE: COUNTDOWN — Earth visible at bottom, rocket on pad
      // ═══════════════════════════════════
      if (phase === "countdown") {
        // Earth at bottom
        const earthR = Math.min(W(), H()) * 0.8;
        drawEarth(W() / 2, H() + earthR * 0.55, earthR);

        // Rocket sitting on "ground"
        const rocketX = W() / 2;
        const rocketY = H() - earthR * 0.38;
        const rocketScale = 3;

        // Launch pad glow
        ctx.fillStyle = "rgba(139,92,246,0.1)";
        ctx.fillRect(rocketX - 40, rocketY + rocketScale * 25, 80, 4);

        // Rocket with minimal flame (idle)
        drawRocket(rocketX, rocketY, rocketScale, 0, 0.15);
      }

      // ═══════════════════════════════════
      // PHASE: LAUNCH — rocket lifts off Earth
      // ═══════════════════════════════════
      if (phase === "launch") {
        const t = Math.min(1, elapsed / LAUNCH_DURATION);
        const easeOut = 1 - Math.pow(1 - t, 3);

        // Earth sinks down as rocket rises
        const earthR = Math.min(W(), H()) * 0.8;
        const earthDrop = easeOut * H() * 0.8;
        drawEarth(W() / 2, H() + earthR * 0.55 + earthDrop, earthR);

        // Rocket rises
        const rocketStartY = H() - earthR * 0.38;
        const rocketX = W() / 2 + Math.sin(t * 3) * 5;
        const rocketY = rocketStartY - easeOut * H() * 0.5;
        const flameIntensity = 0.3 + easeOut * 0.7;
        const shake = (1 - t) * 3;
        const shakeX = Math.sin(time * 30) * shake;
        const shakeY = Math.cos(time * 25) * shake;

        // Smoke from launch pad
        if (t < 0.5) {
          for (let i = 0; i < 3; i++) {
            smokeParticles.push({
              x: rocketX + (Math.random() - 0.5) * 40,
              y: rocketStartY + 80 - earthDrop * 0.3,
              r: Math.random() * 15 + 5,
              alpha: 0.4,
              vx: (Math.random() - 0.5) * 3,
              vy: Math.random() * -1 + 0.5,
            });
          }
        }

        // Draw smoke
        smokeParticles = smokeParticles
          .map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, r: p.r + 0.3, alpha: p.alpha - 0.004 }))
          .filter(p => p.alpha > 0);
        smokeParticles.forEach(p => {
          const sg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
          sg.addColorStop(0, `rgba(200,200,220,${p.alpha * 0.3})`);
          sg.addColorStop(1, "rgba(100,100,120,0)");
          ctx.fillStyle = sg;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        });

        drawRocket(rocketX + shakeX, rocketY + shakeY, 3, 0, flameIntensity);
      }

      // ═══════════════════════════════════
      // PHASE: TRAVEL — rocket in center, planets pass by
      // ═══════════════════════════════════
      if (phase === "travel") {
        const t = Math.min(1, elapsed / TRAVEL_DURATION);

        // Small planets drifting past
        // Jupiter-like
        const j_t = (t * 1.2) % 1;
        if (j_t < 0.8) {
          const jx = W() * 0.15 + Math.sin(j_t * Math.PI) * W() * 0.05;
          const jy = H() * (1.2 - j_t * 1.5);
          const jr = 35 + Math.sin(time) * 2;
          if (jy > -100 && jy < H() + 100) {
            drawMiniPlanet(jx, jy, jr, "rgb(210,170,120)", "rgb(140,100,60)");
          }
        }

        // Saturn-like
        const s_t = ((t * 1.1 + 0.3) % 1);
        if (s_t < 0.8) {
          const sx = W() * 0.82;
          const sy = H() * (1.3 - s_t * 1.6);
          const sr = 28;
          if (sy > -100 && sy < H() + 100) {
            drawMiniPlanet(sx, sy, sr, "rgb(220,200,150)", "rgb(170,140,80)", "rgba(220,200,150,0.3)");
          }
        }

        // Small ice planet
        const i_t = ((t * 1.3 + 0.5) % 1);
        if (i_t < 0.7) {
          const ix = W() * 0.3;
          const iy = H() * (1.1 - i_t * 1.4);
          if (iy > -50 && iy < H() + 50) {
            drawMiniPlanet(ix, iy, 15, "rgb(150,200,230)", "rgb(80,130,170)");
          }
        }

        // Rocket in center, slight bob
        const rocketX = W() / 2 + Math.sin(time * 0.5) * 8;
        const rocketY = H() * 0.42 + Math.cos(time * 0.4) * 6;
        const rocketAngle = Math.sin(time * 0.3) * 0.08;

        drawRocket(rocketX, rocketY, 3.5, rocketAngle, 1);
      }

      // ═══════════════════════════════════
      // PHASE: ARRIVAL — Mars grows, rocket approaches
      // ═══════════════════════════════════
      if (phase === "arrival") {
        const t = Math.min(1, elapsed / ARRIVAL_DURATION);
        const easeIn = t * t;

        // Mars grows from small to large
        const marsR = 30 + easeIn * Math.min(W(), H()) * 0.3;
        const marsX = W() * 0.5 + (1 - easeIn) * W() * 0.2;
        const marsY = H() * 0.4 + (1 - easeIn) * H() * -0.2;
        drawMars(marsX, marsY, marsR);

        // Rocket approaches Mars
        const rocketX = W() * 0.5 + Math.sin(time * 0.4) * 10 * (1 - t);
        const rocketY = H() * 0.42 - t * H() * 0.08;
        const rocketScale = 3.5 - t * 1.5;
        drawRocket(rocketX, rocketY, rocketScale, -0.1, 1 - t * 0.7);
      }

      // ═══════════════════════════════════
      // PHASE: COMPLETE — Mars + rocket floating, content visible
      // ═══════════════════════════════════
      if (phase === "complete") {
        // Mars in upper-right area
        const marsR = Math.min(W(), H()) * 0.18;
        const marsX = W() * 0.78 + Math.sin(time * 0.1) * 8;
        const marsY = H() * 0.22 + Math.cos(time * 0.08) * 5;
        drawMars(marsX, marsY, marsR);

        // Small Earth far away
        const earthR = 25;
        const earthX = W() * 0.12 + Math.sin(time * 0.05) * 5;
        const earthY = H() * 0.15;
        drawEarth(earthX, earthY, earthR);

        // Rocket floating
        const rocketX = W() * 0.5 + Math.sin(time * 0.25) * W() * 0.03;
        const rocketY = H() * 0.34 + Math.cos(time * 0.2) * H() * 0.02;
        const rocketAngle = Math.sin(time * 0.3) * 0.1 - 0.1;
        drawRocket(rocketX, rocketY, 3, rocketAngle, 0.3);

        // Mini planets
        drawMiniPlanet(
          W() * 0.15 + Math.sin(time * 0.07) * 10,
          H() * 0.6,
          18, "rgb(210,170,120)", "rgb(140,100,60)"
        );
        drawMiniPlanet(
          W() * 0.9 + Math.cos(time * 0.06) * 8,
          H() * 0.65,
          14, "rgb(220,200,150)", "rgb(170,140,80)", "rgba(220,200,150,0.25)"
        );
      }

      animationId = requestAnimationFrame(animate);
    };

    animate();
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 w-full h-full" />;
}

// ─── Scroll-reveal hook ──────────────────────────────────────────────
function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function RevealSection({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useReveal(0.1);
  return (
    <div
      ref={ref}
      className={`transition-all duration-[1200ms] ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-16"} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────
export default function SpacePage() {
  const [phase, setPhase] = useState<"countdown" | "launch" | "travel" | "arrival" | "complete">("countdown");
  const [countdownNum, setCountdownNum] = useState(3);
  const [phaseElapsed, setPhaseElapsed] = useState(0);
  const [introComplete, setIntroComplete] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const startTimeRef = useRef(Date.now());
  const phaseStartRef = useRef(Date.now());

  // Drive the phase state machine
  useEffect(() => {
    const interval = setInterval(() => {
      const total = (Date.now() - startTimeRef.current) / 1000;
      let newPhase: typeof phase = "countdown";
      let pStart = 0;

      if (total < COUNTDOWN_DURATION) {
        newPhase = "countdown";
        pStart = 0;
        const num = Math.max(0, 3 - Math.floor(total));
        setCountdownNum(num);
      } else if (total < COUNTDOWN_DURATION + LAUNCH_DURATION) {
        newPhase = "launch";
        pStart = COUNTDOWN_DURATION;
      } else if (total < COUNTDOWN_DURATION + LAUNCH_DURATION + TRAVEL_DURATION) {
        newPhase = "travel";
        pStart = COUNTDOWN_DURATION + LAUNCH_DURATION;
      } else if (total < TOTAL_INTRO) {
        newPhase = "arrival";
        pStart = COUNTDOWN_DURATION + LAUNCH_DURATION + TRAVEL_DURATION;
      } else {
        newPhase = "complete";
        pStart = TOTAL_INTRO;
        if (!introComplete) {
          setIntroComplete(true);
          setTimeout(() => setShowContent(true), 300);
        }
      }

      if (newPhase !== phase) {
        phaseStartRef.current = Date.now();
      }
      setPhase(newPhase);
      setPhaseElapsed(total - pStart);
    }, 16);

    return () => clearInterval(interval);
  }, [phase, introComplete]);

  const [scrollY, setScrollY] = useState(0);
  const handleScroll = useCallback(() => setScrollY(window.scrollY), []);
  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // Skip intro
  const skipIntro = () => {
    startTimeRef.current = Date.now() - TOTAL_INTRO * 1000;
  };

  const heroOpacity = Math.max(0, 1 - scrollY / 600);

  return (
    <div className="relative min-h-screen text-white overflow-x-hidden" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif" }}>
      <CinematicCanvas phase={phase} elapsed={phaseElapsed} />

      {/* ══════ COUNTDOWN OVERLAY ══════ */}
      {phase === "countdown" && (
        <div className="fixed inset-0 z-20 flex flex-col items-center justify-center">
          {/* Countdown number */}
          <div
            key={countdownNum}
            className="animate-countdown-pulse"
          >
            {countdownNum > 0 ? (
              <span className="text-[12rem] sm:text-[16rem] font-black tabular-nums bg-gradient-to-b from-white via-white to-white/20 bg-clip-text text-transparent leading-none select-none" style={{ textShadow: "0 0 80px rgba(168,85,247,0.3)" }}>
                {countdownNum}
              </span>
            ) : (
              <span className="text-5xl sm:text-7xl font-black tracking-[0.3em] uppercase bg-gradient-to-r from-orange-400 via-amber-300 to-yellow-400 bg-clip-text text-transparent select-none">
                LAUNCH
              </span>
            )}
          </div>

          <p className="text-sm text-white/30 mt-8 tracking-[0.2em] uppercase">Initiating Mission</p>

          {/* Skip button */}
          <button
            onClick={skipIntro}
            className="absolute bottom-10 right-10 text-xs text-white/20 hover:text-white/50 transition-colors tracking-widest uppercase"
          >
            Skip &rarr;
          </button>
        </div>
      )}

      {/* ══════ LAUNCH OVERLAY ══════ */}
      {phase === "launch" && (
        <div className="fixed inset-0 z-20 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-lg sm:text-xl font-semibold text-white/60 tracking-[0.15em] uppercase animate-pulse">
              Leaving Earth
            </p>
            <p className="text-xs text-white/20 mt-2 tracking-widest">Altitude increasing...</p>
          </div>
          <button
            onClick={skipIntro}
            className="absolute bottom-10 right-10 text-xs text-white/20 hover:text-white/50 transition-colors tracking-widest uppercase pointer-events-auto"
          >
            Skip &rarr;
          </button>
        </div>
      )}

      {/* ══════ TRAVEL OVERLAY ══════ */}
      {phase === "travel" && (
        <div className="fixed inset-0 z-20 flex flex-col items-center justify-end pb-20 pointer-events-none">
          <div className="text-center">
            <p className="text-sm text-white/30 tracking-[0.25em] uppercase">
              Traversing <span className="text-purple-400/50">225 million km</span>
            </p>
            {/* Distance bar */}
            <div className="w-64 h-1 bg-white/[0.06] rounded-full mt-3 mx-auto overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-orange-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, (phaseElapsed / TRAVEL_DURATION) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between w-64 mx-auto mt-1">
              <span className="text-[10px] text-blue-400/40">Earth</span>
              <span className="text-[10px] text-orange-400/40">Mars</span>
            </div>
          </div>
          <button
            onClick={skipIntro}
            className="absolute bottom-10 right-10 text-xs text-white/20 hover:text-white/50 transition-colors tracking-widest uppercase pointer-events-auto"
          >
            Skip &rarr;
          </button>
        </div>
      )}

      {/* ══════ ARRIVAL OVERLAY ══════ */}
      {phase === "arrival" && (
        <div className="fixed inset-0 z-20 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-2xl sm:text-3xl font-bold text-orange-400/80 tracking-wide animate-pulse">
              Approaching Mars
            </p>
          </div>
        </div>
      )}

      {/* ══════ MAIN CONTENT (after intro) ══════ */}
      <div
        className={`relative z-10 transition-all duration-1000 ease-out ${showContent ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        {/* Hero Section */}
        <section className="min-h-screen flex flex-col items-center justify-center px-6">
          <div className="text-center" style={{ opacity: heroOpacity, transform: `scale(${1 + scrollY * 0.0002})` }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-500/20 bg-purple-500/[0.06] backdrop-blur-md mb-8">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-xs font-medium tracking-[0.15em] uppercase text-purple-300/90">
                Multi-Repo AI Resolution System
              </span>
            </div>

            <h1 className="text-6xl sm:text-7xl md:text-8xl lg:text-[7rem] font-bold tracking-tight leading-[0.95] mb-6">
              <span className="block bg-gradient-to-b from-white via-white to-white/40 bg-clip-text text-transparent">
                MARS
              </span>
            </h1>

            <p className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight text-white/70 mb-4">
              Mission Control for Your Code.
            </p>
            <p className="text-base sm:text-lg text-white/40 max-w-xl mx-auto leading-relaxed mb-10">
              One AI gateway to resolve incidents, debug issues, and ship features
              across 25+ repositories — in seconds, not hours.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="/chat" className="group inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-white text-black font-semibold text-sm tracking-wide hover:bg-white/90 transition-all duration-300">
                Enter MARS
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
              <a href="/" className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full border border-white/15 text-white/80 font-medium text-sm tracking-wide hover:bg-white/[0.05] backdrop-blur-sm transition-all duration-300">
                Sign In
              </a>
            </div>
          </div>

          <div className="absolute bottom-10 flex flex-col items-center gap-2 animate-bounce" style={{ opacity: heroOpacity }}>
            <span className="text-[10px] uppercase tracking-[0.25em] text-white/30">Explore</span>
            <ChevronDown className="w-4 h-4 text-white/30" />
          </div>
        </section>

        {/* Stats */}
        <section className="relative py-32 px-6">
          <RevealSection>
            <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
              {[
                { value: "25+", label: "Repositories", sub: "Managed" },
                { value: "<30s", label: "Resolution", sub: "Average Time" },
                { value: "14", label: "Strategic", sub: "Goals" },
                { value: "24/7", label: "AI Monitoring", sub: "Always On" },
              ].map(({ value, label, sub }) => (
                <div key={label} className="text-center">
                  <div className="text-4xl sm:text-5xl md:text-6xl font-bold bg-gradient-to-b from-white to-white/50 bg-clip-text text-transparent">{value}</div>
                  <div className="text-sm font-semibold text-white/60 mt-2">{label}</div>
                  <div className="text-xs text-white/25 mt-0.5">{sub}</div>
                </div>
              ))}
            </div>
          </RevealSection>
        </section>

        {/* Features */}
        <section className="relative py-20 px-6">
          <RevealSection>
            <div className="max-w-4xl mx-auto text-center mb-20">
              <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.05]">
                <span className="bg-gradient-to-r from-purple-300 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">Intelligence</span>
                <br />
                <span className="text-white/90">that evolves with you.</span>
              </h2>
              <p className="text-lg text-white/40 mt-6 max-w-2xl mx-auto">
                MARS learns from every incident, every resolution, every deploy.
              </p>
            </div>
          </RevealSection>

          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-6">
            {[
              { icon: Cpu, title: "Multi-Channel Pipeline", description: "Jira, Telegram, Grafana alerts — unified into one intelligent workflow.", gradient: "from-purple-500/20 to-violet-600/5", border: "border-purple-500/10" },
              { icon: Globe, title: "Cross-Repo Context", description: "Deep understanding across 25+ repositories. MARS knows how services connect.", gradient: "from-blue-500/15 to-cyan-600/5", border: "border-blue-500/10" },
              { icon: Rocket, title: "Autonomous Resolution", description: "From ticket to PR in under 30 seconds. AI agents analyze, plan, and code.", gradient: "from-fuchsia-500/15 to-pink-600/5", border: "border-fuchsia-500/10" },
              { icon: Shield, title: "6-Gate Safety", description: "Health, Readiness, Capability, Budget, Mode, Approval — six gates of safety.", gradient: "from-emerald-500/15 to-green-600/5", border: "border-emerald-500/10" },
            ].map(({ icon: Icon, title, description, gradient, border }, i) => (
              <RevealSection key={title} delay={i * 150}>
                <div className={`group relative rounded-3xl bg-gradient-to-br ${gradient} border ${border} p-8 sm:p-10 backdrop-blur-sm hover:border-white/10 transition-all duration-500 cursor-default`}>
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                    <Icon className="w-6 h-6 text-white/70" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-semibold text-white/90 mb-3">{title}</h3>
                  <p className="text-sm sm:text-base text-white/40 leading-relaxed">{description}</p>
                </div>
              </RevealSection>
            ))}
          </div>
        </section>

        {/* Product Steps */}
        <section className="relative py-32 px-6">
          <RevealSection>
            <div className="max-w-4xl mx-auto text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-purple-400/70 mb-4">The Platform</p>
              <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6">
                <span className="text-white/90">Built for </span>
                <span className="bg-gradient-to-r from-amber-300 via-orange-400 to-red-400 bg-clip-text text-transparent">velocity.</span>
              </h2>
              <p className="text-lg text-white/40 max-w-2xl mx-auto mb-16">
                A complete mission control for your engineering team.
              </p>
            </div>
          </RevealSection>

          <RevealSection>
            <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                { step: "01", title: "Onboard", desc: "Connect any GitHub repo. MARS analyzes structure, services, and dependencies." },
                { step: "02", title: "Resolve", desc: "Tickets flow through intelligent routing — bug, feature, RCA — each tailored." },
                { step: "03", title: "Evolve", desc: "Every resolution teaches the system. Patterns emerge. Future incidents resolve faster." },
              ].map(({ step, title, desc }) => (
                <div key={step} className="relative rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-8 hover:border-white/10 transition-all duration-500">
                  <span className="text-5xl font-bold text-white/[0.04] absolute top-4 right-6">{step}</span>
                  <h3 className="text-2xl font-semibold text-white/90 mb-3">{title}</h3>
                  <p className="text-sm text-white/40 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </RevealSection>
        </section>

        {/* Bottom CTA */}
        <section className="relative py-32 px-6">
          <RevealSection>
            <div className="max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-400 via-violet-500 to-fuchsia-600 shadow-2xl shadow-purple-500/30 mb-8">
                <Rocket className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4 text-white/90">Ready for liftoff?</h2>
              <p className="text-lg text-white/40 mb-10 max-w-lg mx-auto">Join the mission. Turn AI chaos into one gateway.</p>
              <a href="/chat" className="group inline-flex items-center gap-2 px-10 py-4 rounded-full bg-gradient-to-r from-purple-500 to-violet-600 text-white font-semibold text-base tracking-wide hover:from-purple-400 hover:to-violet-500 shadow-xl shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-300">
                Enter MARS
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </RevealSection>
        </section>

        {/* Footer */}
        <footer className="relative py-12 px-6 border-t border-white/[0.04]">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-400 to-violet-600 flex items-center justify-center">
                <Rocket className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-semibold text-white/60">MARS</span>
            </div>
            <p className="text-xs text-white/20">Multi-Repo AI Resolution System &middot; Shiprocket Engineering</p>
          </div>
        </footer>
      </div>

      {/* ── Global Styles ── */}
      <style jsx global>{`
        @keyframes countdown-pulse {
          0% { transform: scale(0.3); opacity: 0; }
          30% { transform: scale(1.1); opacity: 1; }
          50% { transform: scale(1); }
          80% { opacity: 1; }
          100% { transform: scale(0.95); opacity: 0; }
        }
        .animate-countdown-pulse {
          animation: countdown-pulse 1s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
