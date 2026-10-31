import { useEffect, useRef, useState } from 'react';

// ============================================================
// ESCAPE FROM MORDOR - 2D Side-Scrolling Pixel Game
// ============================================================
// A noir, grey post-Soviet depression mixed with high-contrast
// Hotline Miami pixel-art palette.
// ============================================================

// === CONFIGURATION (tweak these values) ===
const CONFIG = {
  // Player settings
  PLAYER_SPEED: 3.5,           // Walking speed (pixels per frame)
  PLAYER_RUN_SPEED: 5.5,       // Running speed
  GRAVITY: 0.6,                // Gravity acceleration
  JUMP_FORCE: -12,             // Jump velocity
  GROUND_Y: 500,               // Ground level Y coordinate

  // World settings
  WORLD_WIDTH: 4000,           // Total world width in pixels
  CANVAS_WIDTH: 960,           // Game viewport width
  CANVAS_HEIGHT: 600,          // Game viewport height
  PIXEL_SCALE: 3,              // Pixel art scale factor

  // Kiosk settings
  KIOSK_X: 1800,               // Kiosk X position in world
  KIOSK_TRIGGER_RADIUS: 80,    // Interaction trigger distance

  // Colors - Hotline Miami palette on grey depression
  COLORS: {
    sky: '#1a1a2e',
    skyGradientBottom: '#2d2d44',
    ground: '#2a2a2a',
    groundLine: '#3a3a3a',
    building: '#3d3d3d',
    buildingDark: '#2a2a2a',
    buildingWindow: '#4a4a2a',
    buildingWindowLit: '#e8d44d',
    buildingWindowNeon: '#ff6b9d',
    fence: '#4a4a4a',
    streetlight: '#5a5a5a',
    streetlightGlow: '#ffaa00',
    car: '#4a3a3a',
    carAccent: '#6a2a2a',
    player: '#1a1a1a',
    playerHoodie: '#2a2a2a',
    playerSkin: '#c4a882',
    playerTrousers: '#4a4a4a',
    kiosk: '#5a3a2a',
    kioskRoof: '#3a5a3a',
    kioskSign: '#e8d44d',
    neonPink: '#ff6b9d',
    neonCyan: '#00ffcc',
    neonYellow: '#e8d44d',
    text: '#e0e0e0',
    textDim: '#808080',
    questBg: 'rgba(20, 20, 30, 0.85)',
    questBorder: '#ff6b9d',
    completed: '#00ffcc',
  }
};

// === GAME STATE TYPES ===
interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  facing: 'left' | 'right';
  isWalking: boolean;
  isRunning: boolean;
  animFrame: number;
  animTimer: number;
  onGround: boolean;
}

interface QuestState {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

interface GameState {
  player: PlayerState;
  camera: { x: number; y: number };
  quests: QuestState[];
  currentQuestIndex: number;
  nearKiosk: boolean;
  cigarettesBought: boolean;
  keys: Set<string>;
  time: number;
  flickerTimer: number;
  particles: Particle[];
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

// === MAIN GAME COMPONENT ===
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const animFrameRef = useRef<number>(0);
  const [hudQuests, setHudQuests] = useState<QuestState[]>([]);
  const [showInteraction, setShowInteraction] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Disable image smoothing for pixel art look
    ctx.imageSmoothingEnabled = false;

    // === INITIALIZE GAME STATE ===
    const state: GameState = {
      player: {
        x: 200,
        y: CONFIG.GROUND_Y - 48,
        vx: 0,
        vy: 0,
        width: 24,
        height: 48,
        facing: 'right',
        isWalking: false,
        isRunning: false,
        animFrame: 0,
        animTimer: 0,
        onGround: true,
      },
      camera: { x: 0, y: 0 },
      quests: [
        {
          id: 'cigarettes',
          title: 'Find the kiosk and buy cigarettes',
          description: 'Walk through the city to find a Ларек (kiosk)',
          completed: false,
        }
      ],
      currentQuestIndex: 0,
      nearKiosk: false,
      cigarettesBought: false,
      keys: new Set(),
      time: 0,
      flickerTimer: 0,
      particles: [],
    };

    gameStateRef.current = state;

    // === INPUT HANDLING ===
    const handleKeyDown = (e: KeyboardEvent) => {
      state.keys.add(e.key.toLowerCase());

      // Interaction key
      if (e.key.toLowerCase() === 'e' && state.nearKiosk && !state.cigarettesBought) {
        state.cigarettesBought = true;
        state.quests[0].completed = true;
        setShowInteraction(false);
        setShowCompletion(true);

        // Spawn celebration particles
        for (let i = 0; i < 20; i++) {
          state.particles.push({
            x: state.player.x + 12,
            y: state.player.y,
            vx: (Math.random() - 0.5) * 6,
            vy: -Math.random() * 8 - 2,
            life: 60 + Math.random() * 40,
            maxLife: 100,
            color: Math.random() > 0.5 ? CONFIG.COLORS.neonPink : CONFIG.COLORS.neonCyan,
            size: 2 + Math.random() * 3,
          });
        }

        setHudQuests([...state.quests]);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      state.keys.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // === DRAWING FUNCTIONS ===

    // Draw pixel rectangle
    const drawPixelRect = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
    };

    // Draw parallax background layer 1 - far buildings (Khrushchyovkas)
    const drawFarBuildings = (cameraX: number) => {
      const parallaxFactor = 0.15;
      const offsetX = -cameraX * parallaxFactor;

      for (let i = 0; i < 12; i++) {
        const bx = i * 350 + offsetX;
        const bw = 120 + (i % 3) * 40;
        const bh = 200 + (i % 4) * 60;
        const by = CONFIG.GROUND_Y - bh + 50;

        if (bx + bw < -100 || bx > CONFIG.CANVAS_WIDTH + 100) continue;

        // Building body
        drawPixelRect(bx, by, bw, bh, CONFIG.COLORS.buildingDark);

        // Building edge highlight
        drawPixelRect(bx, by, 3, bh, CONFIG.COLORS.building);

        // Windows grid
        const windowRows = Math.floor(bh / 30);
        const windowCols = Math.floor(bw / 25);
        for (let row = 0; row < windowRows; row++) {
          for (let col = 0; col < windowCols; col++) {
            const wx = bx + 10 + col * 25;
            const wy = by + 15 + row * 30;
            const isLit = Math.sin(i * 7 + row * 3 + col * 5 + state.time * 0.001) > 0.6;
            const isNeon = Math.sin(i * 11 + row * 7 + col * 3) > 0.85;

            if (isNeon) {
              drawPixelRect(wx, wy, 12, 16, CONFIG.COLORS.buildingWindowNeon);
            } else if (isLit) {
              drawPixelRect(wx, wy, 12, 16, CONFIG.COLORS.buildingWindowLit);
            } else {
              drawPixelRect(wx, wy, 12, 16, CONFIG.COLORS.buildingWindow);
            }
          }
        }

        // Roof details
        drawPixelRect(bx - 3, by - 5, bw + 6, 8, CONFIG.COLORS.building);
      }
    };

    // Draw parallax background layer 2 - mid buildings
    const drawMidBuildings = (cameraX: number) => {
      const parallaxFactor = 0.35;
      const offsetX = -cameraX * parallaxFactor;

      for (let i = 0; i < 8; i++) {
        const bx = i * 500 + offsetX + 100;
        const bw = 150 + (i % 3) * 50;
        const bh = 160 + (i % 3) * 40;
        const by = CONFIG.GROUND_Y - bh + 30;

        if (bx + bw < -100 || bx > CONFIG.CANVAS_WIDTH + 100) continue;

        // Building body
        drawPixelRect(bx, by, bw, bh, CONFIG.COLORS.building);

        // Darker side
        drawPixelRect(bx + bw - 5, by, 5, bh, CONFIG.COLORS.buildingDark);

        // Windows
        const windowRows = Math.floor(bh / 35);
        const windowCols = Math.floor(bw / 30);
        for (let row = 0; row < windowRows; row++) {
          for (let col = 0; col < windowCols; col++) {
            const wx = bx + 12 + col * 30;
            const wy = by + 20 + row * 35;
            const isLit = Math.sin(i * 13 + row * 5 + col * 7 + state.time * 0.002) > 0.5;

            if (isLit) {
              drawPixelRect(wx, wy, 14, 18, CONFIG.COLORS.buildingWindowLit);
              // Window glow
              ctx.fillStyle = 'rgba(232, 212, 77, 0.1)';
              ctx.fillRect(wx - 3, wy - 3, 20, 24);
            } else {
              drawPixelRect(wx, wy, 14, 18, CONFIG.COLORS.buildingWindow);
            }
          }
        }

        // Entrance
        drawPixelRect(bx + bw / 2 - 12, by + bh - 35, 24, 35, '#1a1a1a');
      }
    };

    // Draw rusty fences
    const drawFences = (cameraX: number) => {
      const parallaxFactor = 0.6;
      const offsetX = -cameraX * parallaxFactor;

      for (let i = 0; i < 20; i++) {
        const fx = i * 220 + offsetX;
        if (fx + 200 < -50 || fx > CONFIG.CANVAS_WIDTH + 50) continue;

        // Fence posts
        for (let p = 0; p < 8; p++) {
          const px = fx + p * 28;
          drawPixelRect(px, CONFIG.GROUND_Y - 40, 4, 45, CONFIG.COLORS.fence);
          // Rust spots
          if (p % 2 === 0) {
            drawPixelRect(px, CONFIG.GROUND_Y - 20, 4, 6, '#5a3a2a');
          }
        }
        // Horizontal bars
        drawPixelRect(fx, CONFIG.GROUND_Y - 35, 200, 3, CONFIG.COLORS.fence);
        drawPixelRect(fx, CONFIG.GROUND_Y - 15, 200, 3, CONFIG.COLORS.fence);
      }
    };

    // Draw Soviet cars (parked)
    const drawCars = (cameraX: number) => {
      const parallaxFactor = 0.5;
      const offsetX = -cameraX * parallaxFactor;

      const carPositions = [300, 900, 1600, 2400, 3200];

      carPositions.forEach((cx, i) => {
        const carX = cx + offsetX;
        if (carX + 80 < -50 || carX > CONFIG.CANVAS_WIDTH + 50) return;

        const carY = CONFIG.GROUND_Y - 5;

        // Car body
        drawPixelRect(carX, carY - 20, 70, 20, i % 2 === 0 ? CONFIG.COLORS.car : '#3a3a4a');
        // Car top
        drawPixelRect(carX + 15, carY - 32, 35, 14, i % 2 === 0 ? CONFIG.COLORS.carAccent : '#2a2a3a');
        // Wheels
        drawPixelRect(carX + 8, carY - 2, 12, 8, '#1a1a1a');
        drawPixelRect(carX + 50, carY - 2, 12, 8, '#1a1a1a');
        // Headlights
        drawPixelRect(carX + 66, carY - 15, 4, 4, '#4a4a2a');
        // Rust
        drawPixelRect(carX + 30 + i * 5, carY - 12, 8, 3, '#5a3a2a');
      });
    };

    // Draw streetlights
    const drawStreetlights = (cameraX: number) => {
      const parallaxFactor = 0.7;
      const offsetX = -cameraX * parallaxFactor;

      for (let i = 0; i < 10; i++) {
        const lx = i * 450 + 200 + offsetX;
        if (lx < -50 || lx > CONFIG.CANVAS_WIDTH + 50) continue;

        const ly = CONFIG.GROUND_Y;

        // Pole
        drawPixelRect(lx, ly - 120, 4, 120, CONFIG.COLORS.streetlight);
        // Arm
        drawPixelRect(lx - 10, ly - 120, 24, 4, CONFIG.COLORS.streetlight);

        // Light (flickering)
        const flicker = Math.sin(state.time * 0.1 + i * 3) > -0.3;
        if (flicker) {
          // Glow
          const gradient = ctx.createRadialGradient(lx + 2, ly - 118, 0, lx + 2, ly - 118, 40);
          gradient.addColorStop(0, 'rgba(255, 170, 0, 0.3)');
          gradient.addColorStop(1, 'rgba(255, 170, 0, 0)');
          ctx.fillStyle = gradient;
          ctx.fillRect(lx - 38, ly - 158, 80, 80);

          // Light bulb
          drawPixelRect(lx - 2, ly - 122, 8, 6, CONFIG.COLORS.streetlightGlow);
        } else {
          drawPixelRect(lx - 2, ly - 122, 8, 6, '#3a3a2a');
        }
      }
    };

    // Draw the kiosk (Ларек)
    const drawKiosk = (cameraX: number) => {
      const kx = CONFIG.KIOSK_X - cameraX;
      const ky = CONFIG.GROUND_Y;

      if (kx + 100 < -50 || kx > CONFIG.CANVAS_WIDTH + 50) return;

      // Kiosk body
      drawPixelRect(kx, ky - 70, 80, 70, CONFIG.COLORS.kiosk);
      // Roof
      drawPixelRect(kx - 5, ky - 78, 90, 12, CONFIG.COLORS.kioskRoof);
      // Window/counter opening
      drawPixelRect(kx + 10, ky - 55, 40, 30, '#1a1a1a');
      // Counter shelf
      drawPixelRect(kx + 10, ky - 30, 40, 4, '#6a5a4a');

      // Sign "ЛАРЕК" with neon glow
      const signGlow = Math.sin(state.time * 0.05) > 0;
      if (signGlow) {
        ctx.fillStyle = 'rgba(232, 212, 77, 0.15)';
        ctx.fillRect(kx + 5, ky - 75, 70, 18);
      }
      drawPixelRect(kx + 10, ky - 72, 60, 12, signGlow ? CONFIG.COLORS.kioskSign : '#8a7a3a');

      // Sign text (pixel style)
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 8px monospace';
      ctx.fillText('ЛАРЕК', kx + 18, ky - 63);

      // Cigarette packs display
      for (let i = 0; i < 4; i++) {
        const packColor = ['#cc3333', '#3366cc', '#33cc33', '#cc9933'][i];
        drawPixelRect(kx + 14 + i * 10, ky - 50, 7, 12, packColor);
      }

      // Interaction highlight when near
      if (state.nearKiosk && !state.cigarettesBought) {
        const pulse = Math.sin(state.time * 0.08) * 0.3 + 0.7;
        ctx.strokeStyle = `rgba(255, 107, 157, ${pulse})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(kx - 5, ky - 82, 90, 85);
      }

      // "SOLD OUT" sign if bought
      if (state.cigarettesBought) {
        drawPixelRect(kx + 15, ky - 55, 50, 15, '#cc3333');
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 7px monospace';
        ctx.fillText('ПРОДАНО', kx + 18, ky - 44);
      }
    };

    // Draw player character
    const drawPlayer = (cameraX: number) => {
      const px = state.player.x - cameraX;
      const py = state.player.y;
      const facing = state.player.facing === 'right' ? 1 : -1;
      const frame = state.player.animFrame;
      const isWalking = state.player.isWalking;

      ctx.save();
      ctx.translate(px + 12, py);
      ctx.scale(facing, 1);
      ctx.translate(-12, 0);

      // Leg animation offset
      const legOffset = isWalking ? Math.sin(frame * 0.3) * 4 : 0;

      // === PIXEL ART CHARACTER ===
      // Beanie hat (black)
      drawPixelRect(4, 0, 16, 8, '#1a1a1a');
      drawPixelRect(2, 4, 20, 4, '#1a1a1a');

      // Head/face
      drawPixelRect(5, 8, 14, 10, CONFIG.COLORS.playerSkin);
      // Eye
      drawPixelRect(14, 11, 3, 3, '#1a1a1a');
      // Slight shadow under beanie
      drawPixelRect(5, 8, 14, 2, 'rgba(0,0,0,0.3)');

      // Hoodie (black)
      drawPixelRect(3, 18, 18, 16, CONFIG.COLORS.playerHoodie);
      // Hoodie hood outline
      drawPixelRect(2, 16, 4, 8, CONFIG.COLORS.playerHoodie);
      // Hoodie pocket
      drawPixelRect(7, 28, 10, 4, '#222222');
      // Hoodie strings
      drawPixelRect(9, 18, 1, 6, '#3a3a3a');
      drawPixelRect(14, 18, 1, 6, '#3a3a3a');

      // Arms
      const armSwing = isWalking ? Math.sin(frame * 0.3) * 3 : 0;
      drawPixelRect(0, 20 + armSwing, 4, 12, CONFIG.COLORS.playerHoodie);
      drawPixelRect(20, 20 - armSwing, 4, 12, CONFIG.COLORS.playerHoodie);
      // Hands
      drawPixelRect(0, 30 + armSwing, 4, 3, CONFIG.COLORS.playerSkin);
      drawPixelRect(20, 30 - armSwing, 4, 3, CONFIG.COLORS.playerSkin);

      // Trousers (grey)
      drawPixelRect(5, 34, 6, 10 + legOffset, CONFIG.COLORS.playerTrousers);
      drawPixelRect(13, 34, 6, 10 - legOffset, CONFIG.COLORS.playerTrousers);

      // Shoes (black)
      drawPixelRect(4, 44 + legOffset, 8, 4, '#1a1a1a');
      drawPixelRect(12, 44 - legOffset, 8, 4, '#1a1a1a');

      ctx.restore();
    };

    // Draw ground
    const drawGround = (cameraX: number) => {
      // Main ground
      drawPixelRect(0, CONFIG.GROUND_Y, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT - CONFIG.GROUND_Y, CONFIG.COLORS.ground);

      // Ground texture lines
      for (let i = 0; i < 50; i++) {
        const gx = (i * 85 - cameraX * 0.9) % CONFIG.CANVAS_WIDTH;
        drawPixelRect(gx, CONFIG.GROUND_Y + 2, 30 + (i % 3) * 10, 2, CONFIG.COLORS.groundLine);
      }

      // Sidewalk edge
      drawPixelRect(0, CONFIG.GROUND_Y - 2, CONFIG.CANVAS_WIDTH, 4, '#3a3a3a');

      // Puddles (reflective)
      for (let i = 0; i < 8; i++) {
        const puddleX = (i * 520 + 100) - cameraX;
        if (puddleX > -100 && puddleX < CONFIG.CANVAS_WIDTH + 100) {
          ctx.fillStyle = 'rgba(40, 40, 60, 0.5)';
          ctx.fillRect(puddleX, CONFIG.GROUND_Y + 5, 40 + i * 5, 4);
          // Neon reflection
          if (i % 3 === 0) {
            ctx.fillStyle = 'rgba(255, 107, 157, 0.1)';
            ctx.fillRect(puddleX + 5, CONFIG.GROUND_Y + 5, 20, 3);
          }
        }
      }
    };

    // Draw sky gradient
    const drawSky = () => {
      const gradient = ctx.createLinearGradient(0, 0, 0, CONFIG.GROUND_Y);
      gradient.addColorStop(0, CONFIG.COLORS.sky);
      gradient.addColorStop(1, CONFIG.COLORS.skyGradientBottom);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.GROUND_Y);

      // Stars
      for (let i = 0; i < 30; i++) {
        const sx = (i * 137 + 50) % CONFIG.CANVAS_WIDTH;
        const sy = (i * 89 + 20) % (CONFIG.GROUND_Y - 100);
        const brightness = Math.sin(state.time * 0.02 + i) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(200, 200, 220, ${brightness * 0.5})`;
        ctx.fillRect(sx, sy, 2, 2);
      }

      // Moon
      ctx.fillStyle = 'rgba(200, 200, 180, 0.15)';
      ctx.beginPath();
      ctx.arc(CONFIG.CANVAS_WIDTH - 100, 80, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(200, 200, 180, 0.3)';
      ctx.beginPath();
      ctx.arc(CONFIG.CANVAS_WIDTH - 100, 80, 20, 0, Math.PI * 2);
      ctx.fill();
    };

    // Draw particles
    const drawParticles = (cameraX: number) => {
      state.particles.forEach(p => {
        const alpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.fillRect(p.x - cameraX, p.y, p.size, p.size);
      });
      ctx.globalAlpha = 1;
    };

    // Draw neon signs on buildings
    const drawNeonSigns = (cameraX: number) => {
      const parallaxFactor = 0.4;
      const offsetX = -cameraX * parallaxFactor;

      const signs = [
        { x: 500, y: CONFIG.GROUND_Y - 180, text: '24/7', color: CONFIG.COLORS.neonPink },
        { x: 1200, y: CONFIG.GROUND_Y - 200, text: 'АПТЕКА', color: CONFIG.COLORS.neonCyan },
        { x: 2800, y: CONFIG.GROUND_Y - 160, text: 'ШИНОМОНТАЖ', color: CONFIG.COLORS.neonYellow },
      ];

      signs.forEach(sign => {
        const sx = sign.x + offsetX;
        if (sx < -100 || sx > CONFIG.CANVAS_WIDTH + 100) return;

        const flicker = Math.sin(state.time * 0.07 + sign.x) > -0.5;
        if (flicker) {
          // Glow
          ctx.fillStyle = sign.color.replace(')', ', 0.1)').replace('rgb', 'rgba');
          ctx.fillRect(sx - 5, sign.y - 5, 80, 20);

          ctx.fillStyle = sign.color;
          ctx.font = 'bold 10px monospace';
          ctx.fillText(sign.text, sx, sign.y + 8);
        }
      });
    };

    // === UPDATE FUNCTIONS ===
    const updatePlayer = () => {
      const p = state.player;
      const keys = state.keys;

      // Movement input
      const moveLeft = keys.has('a') || keys.has('arrowleft');
      const moveRight = keys.has('d') || keys.has('arrowright');
      const isRunning = keys.has('shift');

      p.isRunning = isRunning;
      const speed = isRunning ? CONFIG.PLAYER_RUN_SPEED : CONFIG.PLAYER_SPEED;

      if (moveLeft) {
        p.vx = -speed;
        p.facing = 'left';
        p.isWalking = true;
      } else if (moveRight) {
        p.vx = speed;
        p.facing = 'right';
        p.isWalking = true;
      } else {
        p.vx = 0;
        p.isWalking = false;
      }

      // Apply velocity
      p.x += p.vx;
      p.y += p.vy;

      // Gravity
      p.vy += CONFIG.GRAVITY;

      // Ground collision
      if (p.y >= CONFIG.GROUND_Y - p.height) {
        p.y = CONFIG.GROUND_Y - p.height;
        p.vy = 0;
        p.onGround = true;
      }

      // World bounds
      p.x = Math.max(0, Math.min(CONFIG.WORLD_WIDTH - p.width, p.x));

      // Animation
      if (p.isWalking) {
        p.animTimer++;
        if (p.animTimer >= (isRunning ? 4 : 6)) {
          p.animFrame++;
          p.animTimer = 0;
        }
      } else {
        p.animFrame = 0;
        p.animTimer = 0;
      }
    };

    const updateCamera = () => {
      const targetX = state.player.x - CONFIG.CANVAS_WIDTH / 2 + state.player.width / 2;
      state.camera.x += (targetX - state.camera.x) * 0.08;
      state.camera.x = Math.max(0, Math.min(CONFIG.WORLD_WIDTH - CONFIG.CANVAS_WIDTH, state.camera.x));
    };

    const updateQuests = () => {
      const dist = Math.abs(state.player.x - CONFIG.KIOSK_X);
      const wasNear = state.nearKiosk;
      state.nearKiosk = dist < CONFIG.KIOSK_TRIGGER_RADIUS && !state.cigarettesBought;

      if (state.nearKiosk !== wasNear) {
        setShowInteraction(state.nearKiosk);
      }
    };

    const updateParticles = () => {
      state.particles = state.particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        p.life--;
        return p.life > 0;
      });
    };

    // === MAIN GAME LOOP ===
    const gameLoop = () => {
      state.time++;

      // Update
      updatePlayer();
      updateCamera();
      updateQuests();
      updateParticles();

      // Clear
      ctx.clearRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

      // Draw layers (back to front)
      drawSky();
      drawFarBuildings(state.camera.x);
      drawNeonSigns(state.camera.x);
      drawMidBuildings(state.camera.x);
      drawFences(state.camera.x);
      drawCars(state.camera.x);
      drawStreetlights(state.camera.x);
      drawGround(state.camera.x);
      drawKiosk(state.camera.x);
      drawPlayer(state.camera.x);
      drawParticles(state.camera.x);

      // Vignette effect
      const vignette = ctx.createRadialGradient(
        CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2, CONFIG.CANVAS_WIDTH * 0.3,
        CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2, CONFIG.CANVAS_WIDTH * 0.7
      );
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.4)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

      // Scanline effect (subtle)
      ctx.fillStyle = 'rgba(0,0,0,0.03)';
      for (let i = 0; i < CONFIG.CANVAS_HEIGHT; i += 3) {
        ctx.fillRect(0, i, CONFIG.CANVAS_WIDTH, 1);
      }

      animFrameRef.current = requestAnimationFrame(gameLoop);
    };

    // Initialize HUD
    setHudQuests([...state.quests]);

    // Start game loop
    animFrameRef.current = requestAnimationFrame(gameLoop);

    // Cleanup
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return (
    <div className="w-full h-screen bg-black flex flex-col items-center justify-center overflow-hidden select-none">
      {/* Game Title */}
      <div className="mb-2 text-center">
        <h1 className="text-2xl font-bold tracking-wider" style={{
          fontFamily: 'monospace',
          color: '#ff6b9d',
          textShadow: '0 0 10px rgba(255,107,157,0.5), 0 0 20px rgba(255,107,157,0.3)',
          letterSpacing: '4px'
        }}>
          ESCAPE FROM MORDOR
        </h1>
        <p className="text-xs text-gray-500 font-mono mt-1">
          A post-Soviet noir adventure
        </p>
      </div>

      {/* Game Container */}
      <div className="relative border-2 border-gray-700 shadow-2xl" style={{
        boxShadow: '0 0 30px rgba(255,107,157,0.1), 0 0 60px rgba(0,0,0,0.5)',
      }}>
        <canvas
          ref={canvasRef}
          width={CONFIG.CANVAS_WIDTH}
          height={CONFIG.CANVAS_HEIGHT}
          className="block"
          style={{ imageRendering: 'pixelated' }}
        />

        {/* HUD Overlay - Quest Panel */}
        <div className="absolute top-4 left-4 p-3 rounded" style={{
          background: 'rgba(20, 20, 30, 0.9)',
          border: '1px solid rgba(255, 107, 157, 0.5)',
          minWidth: '280px',
          backdropFilter: 'blur(2px)',
        }}>
          <div className="text-xs font-mono mb-2" style={{ color: '#ff6b9d' }}>
            ▸ ACTIVE QUEST
          </div>
          {hudQuests.map((quest, i) => (
            <div key={quest.id} className="mb-1">
              <div className="text-xs font-mono flex items-center gap-2" style={{
                color: quest.completed ? '#00ffcc' : '#e0e0e0',
              }}>
                <span>{quest.completed ? '✓' : '○'}</span>
                <span className={quest.completed ? 'line-through opacity-60' : ''}>
                  {quest.title}
                </span>
              </div>
              {!quest.completed && (
                <div className="text-xs font-mono ml-4 mt-1" style={{ color: '#808080' }}>
                  {quest.description}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Interaction Prompt */}
        {showInteraction && (
          <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded animate-pulse" style={{
            background: 'rgba(20, 20, 30, 0.9)',
            border: '1px solid #ff6b9d',
            boxShadow: '0 0 15px rgba(255,107,157,0.3)',
          }}>
            <span className="text-sm font-mono" style={{ color: '#e8d44d' }}>
              Press <span className="px-1 py-0.5 mx-1 rounded text-xs" style={{
                background: '#ff6b9d',
                color: '#1a1a1a',
                fontWeight: 'bold',
              }}>E</span> to Buy Cigarettes
            </span>
          </div>
        )}

        {/* Quest Complete Notification */}
        {showCompletion && (
          <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 px-6 py-4 rounded text-center" style={{
            background: 'rgba(20, 20, 30, 0.95)',
            border: '2px solid #00ffcc',
            boxShadow: '0 0 30px rgba(0,255,204,0.3)',
            animation: 'fadeIn 0.5s ease-out',
          }}>
            <div className="text-lg font-mono font-bold mb-2" style={{ color: '#00ffcc' }}>
              ✓ QUEST COMPLETE
            </div>
            <div className="text-sm font-mono" style={{ color: '#e0e0e0' }}>
              Cigarettes Bought
            </div>
            <div className="text-xs font-mono mt-2" style={{ color: '#808080' }}>
              You can keep exploring...
            </div>
          </div>
        )}

        {/* Controls hint */}
        <div className="absolute bottom-3 right-4 text-xs font-mono" style={{ color: '#505050' }}>
          <span>A/D or ←/→ Move</span>
          <span className="mx-2">|</span>
          <span>SHIFT Run</span>
          <span className="mx-2">|</span>
          <span>E Interact</span>
        </div>

        {/* Inventory indicator */}
        {showCompletion && (
          <div className="absolute bottom-4 left-4 px-3 py-2 rounded" style={{
            background: 'rgba(20, 20, 30, 0.9)',
            border: '1px solid #e8d44d',
          }}>
            <div className="text-xs font-mono" style={{ color: '#e8d44d' }}>
              📦 INVENTORY
            </div>
            <div className="text-xs font-mono mt-1" style={{ color: '#c0c0c0' }}>
              🚬 Cigarettes x1
            </div>
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="mt-3 text-center">
        <p className="text-xs font-mono text-gray-600">
          Walk right to find the kiosk (Ларек) • Explore the bleak city
        </p>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </div>
  );
}
