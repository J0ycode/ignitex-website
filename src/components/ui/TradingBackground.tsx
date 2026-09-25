import { useEffect, useRef } from 'react';

// ==========================================
// TUNABLE VARIABLES
// ==========================================
export const CONFIG = {
  colors: {
    background: '#05070D', // Deep navy/black
    grid: 'rgba(255, 255, 255, 0.04)', // Faint grid lines
    chartLine: '#00E5A0', // Accent green for gains
    chartGlow: 'rgba(0, 229, 160, 0.15)', // Soft radial glow for chart
    particlePrimary: 'rgba(0, 229, 160, 0.5)', 
    particleSecondary: 'rgba(166, 149, 227, 0.3)', // Deep purple/indigo accent
  },
  animation: {
    speed: 0.4,
    mouseEasing: 0.05,
    particleDensity: 8000, // 1 particle per X pixels (responsive)
  },
  grid: {
    size: 40,
  }
};

/**
 * TradingBackground
 * 
 * An ambient, trading-platform-inspired background.
 * - Draws a subtle scrolling grid.
 * - Animates a stock-market line chart drawing itself across the screen.
 * - Floats soft particles and orbs.
 * - Reacts slowly to cursor movement (parallax/easing).
 * - Respects prefers-reduced-motion and pauses when the tab is inactive.
 */
export default function TradingBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let rafId: number;
    let w = 0, h = 0;
    let time = 0;
    
    // Mouse tracking
    let targetX = 0, targetY = 0;
    let mouseX = 0, mouseY = 0;

    // Prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isTouch = window.matchMedia('(pointer: coarse)').matches;

    // Particles state
    let particles: { x: number, y: number, r: number, vx: number, vy: number, color: string }[] = [];
    
    // Chart state
    const points: { x: number, y: number }[] = [];
    const numPoints = 20;

    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      
      // Responsive particle count based on screen area
      const maxParticles = Math.floor((w * h) / CONFIG.animation.particleDensity);
      const actualCount = Math.min(Math.max(maxParticles, 10), 50); // clamp between 10 and 50
      
      particles = Array.from({ length: actualCount }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 2 + 1,
        vx: (Math.random() - 0.5) * CONFIG.animation.speed,
        vy: (Math.random() - 0.5) * CONFIG.animation.speed - 0.2, // bias upwards
        color: Math.random() > 0.5 ? CONFIG.colors.particlePrimary : CONFIG.colors.particleSecondary
      }));

      // Generate random chart points
      points.length = 0;
      for (let i = 0; i <= numPoints; i++) {
        points.push({
          x: (w / numPoints) * i,
          y: h * 0.5 + (Math.random() * h * 0.4 - h * 0.2) // random vertical offset
        });
      }
    };

    window.addEventListener('resize', resize);
    resize();

    const handleMouseMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
    };
    window.addEventListener('mousemove', handleMouseMove);

    const drawGrid = () => {
      ctx.strokeStyle = CONFIG.colors.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      
      // Parallax offset for grid
      const offsetX = (mouseX - w / 2) * 0.05;
      const offsetY = (mouseY - h / 2) * 0.05;
      
      // Moving grid effect
      const scrollOffset = prefersReducedMotion ? 0 : (time * 10) % CONFIG.grid.size;

      for (let x = (offsetX % CONFIG.grid.size) - CONFIG.grid.size; x < w; x += CONFIG.grid.size) {
        ctx.moveTo(x - scrollOffset, 0);
        ctx.lineTo(x - scrollOffset, h);
      }
      for (let y = (offsetY % CONFIG.grid.size) - CONFIG.grid.size; y < h; y += CONFIG.grid.size) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();
    };

    const drawChart = () => {
      if (points.length < 2) return;
      
      const offsetX = (mouseX - w / 2) * 0.02;
      const offsetY = (mouseY - h / 2) * 0.02;

      ctx.beginPath();
      ctx.moveTo(points[0].x + offsetX, points[0].y + offsetY);
      
      for (let i = 1; i < points.length - 1; i++) {
        // Smooth bezier curves
        const xc = (points[i].x + points[i + 1].x) / 2 + offsetX;
        const yc = (points[i].y + points[i + 1].y) / 2 + offsetY;
        
        // Gentle wave animation applied to Y
        const animY = Math.sin(time + i) * 20 * (prefersReducedMotion ? 0 : 1);
        
        ctx.quadraticCurveTo(points[i].x + offsetX, points[i].y + offsetY + animY, xc, yc + animY);
      }

      ctx.strokeStyle = CONFIG.colors.chartLine;
      ctx.lineWidth = 2;
      
      // Glow effect
      ctx.shadowBlur = 20;
      ctx.shadowColor = CONFIG.colors.chartLine;
      ctx.stroke();
      
      // Reset shadow
      ctx.shadowBlur = 0;
      
      // Draw subtle gradient fill under chart
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      
      const grad = ctx.createLinearGradient(0, h * 0.3, 0, h);
      grad.addColorStop(0, CONFIG.colors.chartGlow);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fill();
    };

    const drawParticles = () => {
      const offsetX = (mouseX - w / 2) * 0.1;
      const offsetY = (mouseY - h / 2) * 0.1;

      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x + offsetX, p.y + offsetY, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        
        // Soft glowing orbs (shadowBlur per particle is expensive on phones)
        ctx.shadowBlur = isTouch ? 0 : 10;
        ctx.shadowColor = p.color;
        ctx.fill();
        
        if (!prefersReducedMotion) {
          p.x += p.vx;
          p.y += p.vy;
          
          // Wrap around screen
          if (p.x < -20) p.x = w + 20;
          if (p.x > w + 20) p.x = -20;
          if (p.y < -20) p.y = h + 20;
          if (p.y > h + 20) p.y = -20;
        }
      });
      ctx.shadowBlur = 0;
    };

    const render = () => {
      // Easing mouse movement
      mouseX += (targetX - mouseX) * CONFIG.animation.mouseEasing;
      mouseY += (targetY - mouseY) * CONFIG.animation.mouseEasing;

      // Clear with background color
      ctx.fillStyle = CONFIG.colors.background;
      ctx.fillRect(0, 0, w, h);

      drawGrid();
      drawChart();
      drawParticles();

      time += 0.01;
      
      // Only request next frame if tab is visible to save CPU/GPU
      if (!document.hidden) {
        rafId = requestAnimationFrame(render);
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        render();
      } else {
        cancelAnimationFrame(rafId);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Start loop
    render();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-[-1]"
      aria-hidden="true"
    />
  );
}
