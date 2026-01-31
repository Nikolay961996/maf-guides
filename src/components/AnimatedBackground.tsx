import React, { useEffect, useRef } from 'react';

const AnimatedBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Установка размеров canvas
    const resizeCanvas = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Частицы
    const particles: Array<{
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      color: string;
    }> = [];

    // Создание частиц
    const createParticles = () => {
      const particleCount = Math.min(100, Math.floor((canvas.width * canvas.height) / 8000));
      particles.length = 0;

      const colors = [
        'rgba(34, 211, 238, 0.6)',  // cyan - более яркий
        'rgba(168, 85, 247, 0.6)',  // purple
        'rgba(236, 72, 153, 0.6)',  // pink
        'rgba(34, 197, 94, 0.6)',   // green
        'rgba(245, 158, 11, 0.6)',  // amber
        'rgba(239, 68, 68, 0.6)',   // red
      ];

      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 3 + 1, // Увеличили размер
          speedX: (Math.random() - 0.5) * 0.8,
          speedY: (Math.random() - 0.5) * 0.8,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
    };

    createParticles();

    // Анимация
    let animationId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Обновление и отрисовка частиц
      particles.forEach(particle => {
        particle.x += particle.speedX;
        particle.y += particle.speedY;

        // Отскок от границ
        if (particle.x < 0 || particle.x > canvas.width) particle.speedX *= -1;
        if (particle.y < 0 || particle.y > canvas.height) particle.speedY *= -1;

        // Отрисовка частицы
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = particle.color;
        ctx.fill();

        // Соединение близких частиц линиями
        particles.forEach(otherParticle => {
          const dx = particle.x - otherParticle.x;
          const dy = particle.y - otherParticle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 150) { // Увеличили расстояние
            ctx.beginPath();
            const alpha = 0.3 * (1 - distance / 150); // Увеличили прозрачность
            // Цвет линии зависит от цвета частицы
            const baseColor = particle.color.match(/rgba\((\d+),\s*(\d+),\s*(\d+)/);
            if (baseColor) {
              ctx.strokeStyle = `rgba(${baseColor[1]}, ${baseColor[2]}, ${baseColor[3]}, ${alpha})`;
            } else {
              ctx.strokeStyle = `rgba(34, 211, 238, ${alpha})`;
            }
            ctx.lineWidth = 1; // Увеличили толщину
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(otherParticle.x, otherParticle.y);
            ctx.stroke();
          }
        });
      });

      // Очень прозрачный градиентный оверлей (почти невидимый)
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, 'rgba(15, 23, 42, 0.05)');
      gradient.addColorStop(1, 'rgba(88, 28, 135, 0.05)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      animationId = requestAnimationFrame(animate);
    };

    animate();

    // Очистка
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
      style={{ opacity: 0.7 }}
    />
  );
};

export default AnimatedBackground;