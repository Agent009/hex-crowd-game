import Phaser from "phaser";
import {
  CubeCoords,
  cubeToPixel,
  pixelToCube,
  HexTile,
  coordsToKey,
  coordsEqual,
  isIsometricGrid,
  getHexPoints,
  DEFAULT_HEX_SIZE,
} from "../utils/hexGrid";
import { terrainData, TerrainTypeData } from "../data/gameData";
import { disasterData } from "../data/gameData";
import { AtmosphericParticleSystem } from "./ParticleSystem";
import { GameAnimationSystem } from "./AnimationSystem";
import { TextureFactory } from "./TextureFactory";
import { ParticleEmitterManager } from "./ParticleEmitterManager";
import { setPhaserGame, clearPhaserGame } from "./phaserRef";
import { GameConfig } from "./GameConfig";
import { Hero } from "../store/types";
import { heroClasses } from "../data/heroesData";

export class GameScene extends Phaser.Scene {
  private tiles: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private tileTerrainIcons: Map<string, Phaser.GameObjects.Text> = new Map();
  private playerNumbers: Map<string, Phaser.GameObjects.Text> = new Map();
  private playerMarkers: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private heroMarkerBadges: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private heroMarkers: Map<string, Phaser.GameObjects.Text> = new Map();
  private gridGraphics!: Phaser.GameObjects.Graphics;
  private sharedEmitterManager!: ParticleEmitterManager;
  private particleSystem!: AtmosphericParticleSystem;
  private animationSystem!: GameAnimationSystem;
  private hexSize = DEFAULT_HEX_SIZE;
  private gameData: { [key: string]: HexTile } = {};
  private previousGameData: { [key: string]: HexTile } = {};
  private heroes: Hero[] = [];
  private selectedTile: CubeCoords | null = null;
  private onTileClick?: (coords: CubeCoords) => void;
  private onTileHover?: (coords: CubeCoords | null) => void;
  private showPlayerNumbers: boolean = true;
  private isInitialized: boolean = false;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
  private gridNeedsRedraw: boolean = true;

  constructor() {
    super({ key: "GameScene" });
  }

  preload() {}

  create() {

    // Set up camera
    this.cameras.main.setZoom(0.82);
    this.cameras.main.centerOn(0, 0);

    // Make the game instance globally accessible for coordinate conversion
    setPhaserGame(this.game);

    if (isIsometricGrid) {
      this.cameras.main.setRotation(0);
      this.cameras.main.setBackgroundColor(GameConfig.camera.backgroundColor);
    }

    // Enable input
    this.input.on("pointermove", this.handlePointerMove, this);
    this.input.on("pointerdown", this.handlePointerDown, this);
    this.input.on("wheel", this.handleWheel, this);

    // Create grid graphics
    this.gridGraphics = this.add.graphics();

    // Initialize all textures first (must be before particle/animation systems)
    TextureFactory.initialize(this);

    this.sharedEmitterManager = new ParticleEmitterManager(this);
    this.particleSystem = new AtmosphericParticleSystem(this, this.hexSize, this.sharedEmitterManager);
    this.animationSystem = new GameAnimationSystem(this, this.hexSize, this.sharedEmitterManager);

    this.cursors = this.input.keyboard?.createCursorKeys();

    this.events.on("shutdown", this.cleanup, this);
  }

  // Custom initialization method to avoid conflicts with Phaser's init
  public initializeScene(data: {
    tiles: { [key: string]: HexTile };
    heroes: Hero[];
    onTileClick: (coords: CubeCoords) => void;
    onTileHover: (coords: CubeCoords | null) => void;
    showPlayerNumbers: boolean;
  }) {

    this.gameData = data.tiles;
    this.heroes = data.heroes;
    this.onTileClick = data.onTileClick;
    this.onTileHover = data.onTileHover;
    this.showPlayerNumbers = data.showPlayerNumbers;
    this.isInitialized = true;

    // Render initial tiles
    this.renderWorld();
  }

  update() {
    if (this.cursors) {
      const speed = GameConfig.camera.keyboardSpeed;
      if (this.cursors.left?.isDown) this.cameras.main.scrollX -= speed;
      if (this.cursors.right?.isDown) this.cameras.main.scrollX += speed;
      if (this.cursors.up?.isDown) this.cameras.main.scrollY -= speed;
      if (this.cursors.down?.isDown) this.cameras.main.scrollY += speed;
    }
  }

  private renderWorld(fullRedraw: boolean = true) {
    if (fullRedraw) {
      this.clearTiles();
      Object.keys(this.gameData).forEach((key) => {
        this.renderTile(this.gameData[key]);
      });
      this.gridNeedsRedraw = true;
    } else {
      const dirtyKeys = this.getDirtyTileKeys();
      dirtyKeys.forEach((key) => {
        const tile = this.gameData[key];
        if (tile) {
          this.destroyTileObjects(key);
          this.renderTile(tile);
        } else {
          this.destroyTileObjects(key);
        }
      });
    }

    this.previousGameData = { ...this.gameData };

    if (this.gridNeedsRedraw) {
      this.renderGrid();
      this.gridNeedsRedraw = false;
    }
  }

  private getDirtyTileKeys(): Set<string> {
    const dirty = new Set<string>();
    const allKeys = new Set([
      ...Object.keys(this.gameData),
      ...Object.keys(this.previousGameData),
    ]);

    for (const key of allKeys) {
      const curr = this.gameData[key];
      const prev = this.previousGameData[key];

      if (!curr || !prev) {
        dirty.add(key);
        continue;
      }

      const currPlayers = this.playerSignature(curr.players);
      const prevPlayers = this.playerSignature(prev.players);

      if (
        curr.terrain !== prev.terrain ||
        curr.isActive !== prev.isActive ||
        curr.fogLevel !== prev.fogLevel ||
        currPlayers !== prevPlayers
      ) {
        dirty.add(key);
      }
    }
    return dirty;
  }

  private destroyTileObjects(key: string) {
    const tileGraphic = this.tiles.get(key);
    if (tileGraphic) {
      tileGraphic.destroy();
      this.tiles.delete(key);
    }

    const terrainIcon = this.tileTerrainIcons.get(key);
    if (terrainIcon) {
      terrainIcon.destroy();
      this.tileTerrainIcons.delete(key);
    }

    const keysToRemove: string[] = [];
    this.playerNumbers.forEach((text, pKey) => {
      if (pKey.startsWith(`${key}_`)) {
        text.destroy();
        keysToRemove.push(pKey);
      }
    });
    keysToRemove.forEach((k) => this.playerNumbers.delete(k));

    const markerKeysToRemove: string[] = [];
    this.playerMarkers.forEach((marker, pKey) => {
      if (pKey.startsWith(`${key}_`)) {
        marker.destroy();
        markerKeysToRemove.push(pKey);
      }
    });
    markerKeysToRemove.forEach((k) => this.playerMarkers.delete(k));

    const heroKeysToRemove: string[] = [];
    this.heroMarkers.forEach((text, pKey) => {
      if (pKey.startsWith(`${key}_`)) {
        text.destroy();
        heroKeysToRemove.push(pKey);
      }
    });
    heroKeysToRemove.forEach((k) => this.heroMarkers.delete(k));

    const heroBadgeKeysToRemove: string[] = [];
    this.heroMarkerBadges.forEach((badge, pKey) => {
      if (pKey.startsWith(`${key}_`)) {
        badge.destroy();
        heroBadgeKeysToRemove.push(pKey);
      }
    });
    heroBadgeKeysToRemove.forEach((k) => this.heroMarkerBadges.delete(k));
  }

  private renderTile(tile: HexTile) {
    const key = coordsToKey(tile.coords);
    const pixel = cubeToPixel(tile.coords, this.hexSize);

    const graphics = this.add.graphics();
    graphics.setPosition(pixel.x, pixel.y);

    this._redrawTileGraphics(graphics, tile, false, false);

    // Add players on this tile
    if (tile.players && tile.players.length > 0 && this.showPlayerNumbers) {
      const playerCount = tile.players.length;
      tile.players.forEach((player, index) => {
        const columns = Math.ceil(Math.sqrt(playerCount));
        const col = index % columns;
        const row = Math.floor(index / columns);
        const spacing = 18;
        const offsetX = (col - (columns - 1) / 2) * spacing;
        const offsetY = (row - (Math.ceil(playerCount / columns) - 1) / 2) * spacing;
        const markerKey = `${key}_${player.id}`;
        const teamColor = Phaser.Display.Color.HexStringToColor(player.color).color;

        const marker = this.add.graphics();
        marker.fillStyle(0x0f172a, 0.92);
        marker.fillCircle(pixel.x + offsetX, pixel.y + offsetY, 11);
        marker.lineStyle(3, teamColor, 1);
        marker.strokeCircle(pixel.x + offsetX, pixel.y + offsetY, 11);
        marker.lineStyle(1, 0xffffff, 0.75);
        marker.strokeCircle(pixel.x + offsetX, pixel.y + offsetY, 7);
        marker.setDepth(GameConfig.rendering.playerNumberDepth - 1);
        this.playerMarkers.set(markerKey, marker);

        // Player number circle
        const playerText = this.add
          .text(pixel.x + offsetX, pixel.y + offsetY, player.number.toString(), {
            fontSize: "12px",
            color: "#ffffff",
            fontStyle: "bold",
            stroke: "#020617",
            strokeThickness: 3,
          })
          .setOrigin(0.5)
          .setDepth(GameConfig.rendering.playerNumberDepth);

        this.playerNumbers.set(markerKey, playerText);

        const hero = this.heroes.find(h => h.ownerId === player.id);
        const heroClass = hero ? heroClasses[hero.classId] : null;
        if (hero && heroClass) {
          const heroX = pixel.x + offsetX + 10;
          const heroY = pixel.y + offsetY - 11;
          const heroColor = this.heroClassColor(hero.classId);
          const heroHealth = Phaser.Math.Clamp(hero.hp / Math.max(hero.maxHp, 1), 0, 1);
          const heroBadge = this.add.graphics();
          heroBadge.fillStyle(0x020617, 0.9);
          heroBadge.fillCircle(heroX, heroY, 10);
          heroBadge.fillStyle(heroColor, 0.95);
          heroBadge.fillCircle(heroX, heroY, 7);
          heroBadge.lineStyle(2, 0xffffff, 0.9);
          heroBadge.beginPath();
          heroBadge.arc(heroX, heroY, 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * heroHealth, false);
          heroBadge.strokePath();
          heroBadge.setDepth(GameConfig.rendering.playerNumberDepth + 1);
          this.heroMarkerBadges.set(markerKey, heroBadge);

          const heroText = this.add
            .text(heroX, heroY, heroClass.icon, {
              fontSize: "11px",
              stroke: "#020617",
              strokeThickness: 2,
            })
            .setOrigin(0.5)
            .setDepth(GameConfig.rendering.playerNumberDepth + 2);
          this.heroMarkers.set(markerKey, heroText);
        }
      });
    }

    // Make all tiles interactive in party game
    const hexPoints = getHexPoints(0, 0, this.hexSize);
    graphics.setInteractive(
      new Phaser.Geom.Polygon(hexPoints),
      Phaser.Geom.Polygon.Contains
    );
    graphics.on("pointerover", () => {
      this._redrawTileGraphics(
        graphics,
        tile,
        true,
        (this.selectedTile && coordsEqual(this.selectedTile, tile.coords)) ||
          false
      );
      this.onTileHover?.(tile.coords);
    });
    graphics.on("pointerout", () => {
      this._redrawTileGraphics(
        graphics,
        tile,
        false,
        (this.selectedTile && coordsEqual(this.selectedTile, tile.coords)) ||
          false
      );
      this.onTileHover?.(null);
    });
    graphics.on("pointerdown", () => {
      this.selectTile(tile.coords);
    });

    this.tiles.set(key, graphics);
  }

  private _redrawTileGraphics(
    graphics: Phaser.GameObjects.Graphics,
    tile: HexTile,
    isHovered: boolean,
    isSelected: boolean
  ) {
    graphics.clear();

    const { y } = cubeToPixel(tile.coords, this.hexSize);
    const terrain = terrainData[tile.terrain];
    if (!terrain) return;
    const baseColor = Phaser.Display.Color.HexStringToColor(
      terrain.color
    ).color;

    // Determine stroke style based on state
    let strokeColor = 0x0f172a;
    let strokeAlpha = 0.85;
    let strokeWidth = 2;

    if (isSelected) {
      strokeColor = 0xffff00;
      strokeAlpha = 1;
      strokeWidth = 3;
    } else if (isHovered) {
      strokeColor = 0xffffff;
      strokeAlpha = 0.8;
      strokeWidth = 2;
    }

    if (isSelected || isHovered) {
      this.drawTileHalo(graphics, isSelected ? 0xfacc15 : 0xffffff, isSelected ? 0.44 : 0.24);
    }

    this.drawHex(
      graphics,
      baseColor,
      terrain,
      strokeColor,
      strokeWidth,
      strokeAlpha
    );
    this.drawTerrainDetails(graphics, tile, baseColor);
    // Farthest (small y) drawn first, then closer on top
    graphics.setDepth(Math.round(y + GameConfig.rendering.tileDepthOffset));
  }

  private drawHex(
    graphics: Phaser.GameObjects.Graphics,
    baseColor: number,
    terrain: TerrainTypeData,
    strokeColor: number,
    strokeWidth: number,
    strokeAlpha: number
  ) {
    if (isIsometricGrid) {
      // Draw true isometric hex with 3D depth
      return this.drawIsometricHex(
        graphics,
        baseColor,
        strokeColor,
        strokeWidth,
        strokeAlpha
      );
    }

    // Draw hex shape
    this.drawTopDownShadow(graphics);
    graphics.lineStyle(strokeWidth, strokeColor, strokeAlpha);
    const lightColor = this.mixColor(baseColor, 0xffffff, 0.18);
    const darkColor = this.mixColor(baseColor, 0x000000, 0.2);
    graphics.fillGradientStyle(
      lightColor,
      lightColor,
      darkColor,
      darkColor,
      1,
      1,
      1,
      1
    );

    const hexPoints = getHexPoints(0, 0, this.hexSize);
    graphics.beginPath();
    graphics.moveTo(hexPoints[0].x, hexPoints[0].y);
    for (let i = 1; i < hexPoints.length; i++) {
      graphics.lineTo(hexPoints[i].x, hexPoints[i].y);
    }
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();
    this.drawTopDownRim(graphics, lightColor, darkColor);
  }

  private drawTerrainDetails(
    graphics: Phaser.GameObjects.Graphics,
    tile: HexTile,
    baseColor: number
  ) {
    const active = tile.isActive !== false;
    const detailColor = this.mixColor(baseColor, 0xffffff, active ? 0.35 : 0.18);
    const shadowColor = this.mixColor(baseColor, 0x000000, 0.35);
    const size = this.hexSize;

    this.drawSurfaceGrain(graphics, tile, baseColor, active);
    graphics.lineStyle(1.5, detailColor, active ? 0.65 : 0.25);

    switch (tile.terrain) {
      case "lake":
        this.drawWaterLines(graphics, size, detailColor);
        graphics.lineStyle(1.1, 0xffffff, active ? 0.28 : 0.1);
        graphics.strokeCircle(-size * 0.12, size * 0.08, size * 0.18);
        graphics.strokeCircle(size * 0.24, -size * 0.14, size * 0.12);
        break;
      case "river":
        graphics.lineStyle(5, shadowColor, active ? 0.35 : 0.12);
        this.drawSinuousLine(graphics, [
          { x: -size * 0.55, y: -size * 0.18 },
          { x: -size * 0.3, y: size * 0.05 },
          { x: -size * 0.08, y: size * 0.18 },
          { x: size * 0.2, y: size * 0.1 },
          { x: size * 0.55, y: -size * 0.08 },
        ]);
        graphics.lineStyle(3, detailColor, active ? 0.7 : 0.3);
        this.drawSinuousLine(graphics, [
          { x: -size * 0.52, y: -size * 0.15 },
          { x: -size * 0.28, y: size * 0.06 },
          { x: -size * 0.08, y: size * 0.16 },
          { x: size * 0.18, y: size * 0.08 },
          { x: size * 0.5, y: -size * 0.05 },
        ]);
        graphics.lineStyle(1.5, 0xffffff, active ? 0.35 : 0.15);
        this.drawSinuousLine(graphics, [
          { x: -size * 0.35, y: size * 0.02 },
          { x: -size * 0.08, y: size * 0.18 },
          { x: size * 0.16, y: size * 0.16 },
          { x: size * 0.35, y: size * 0.08 },
        ]);
        break;
      case "mountain":
        graphics.fillStyle(shadowColor, active ? 0.75 : 0.35);
        graphics.fillTriangle(-size * 0.48, size * 0.35, -size * 0.08, -size * 0.45, size * 0.18, size * 0.35);
        graphics.fillStyle(detailColor, active ? 0.85 : 0.35);
        graphics.fillTriangle(-size * 0.16, size * 0.28, size * 0.18, -size * 0.38, size * 0.52, size * 0.28);
        graphics.fillStyle(0xffffff, active ? 0.45 : 0.16);
        graphics.fillTriangle(-size * 0.12, -size * 0.36, -size * 0.08, -size * 0.45, -size * 0.02, -size * 0.32);
        graphics.fillTriangle(size * 0.14, -size * 0.3, size * 0.18, -size * 0.38, size * 0.25, -size * 0.28);
        graphics.lineStyle(1.3, shadowColor, active ? 0.62 : 0.2);
        graphics.beginPath();
        graphics.moveTo(-size * 0.08, -size * 0.28);
        graphics.lineTo(-size * 0.18, size * 0.1);
        graphics.lineTo(-size * 0.04, size * 0.28);
        graphics.moveTo(size * 0.2, -size * 0.24);
        graphics.lineTo(size * 0.08, size * 0.05);
        graphics.lineTo(size * 0.22, size * 0.24);
        graphics.strokePath();
        break;
      case "desert":
        for (let i = 0; i < 3; i++) {
          const y = -size * 0.22 + i * size * 0.22;
          this.drawSinuousLine(graphics, [
            { x: -size * 0.45, y },
            { x: -size * 0.22, y: y - size * 0.11 },
            { x: size * 0.08, y: y - size * 0.08 },
            { x: size * 0.35, y },
          ]);
        }
        graphics.fillStyle(this.mixColor(baseColor, 0xffffff, 0.45), active ? 0.28 : 0.1);
        graphics.fillCircle(-size * 0.1, -size * 0.05, 1.4);
        graphics.fillCircle(size * 0.28, size * 0.18, 1.2);
        graphics.fillCircle(-size * 0.34, size * 0.17, 1.1);
        break;
      case "plains":
        graphics.fillStyle(detailColor, active ? 0.65 : 0.25);
        graphics.fillCircle(-size * 0.28, -size * 0.1, 2.5);
        graphics.fillCircle(size * 0.18, size * 0.08, 2.2);
        graphics.fillCircle(size * 0.34, -size * 0.22, 1.8);
        graphics.lineStyle(1.2, detailColor, active ? 0.45 : 0.18);
        graphics.beginPath();
        graphics.moveTo(-size * 0.45, size * 0.22);
        graphics.lineTo(-size * 0.3, size * 0.08);
        graphics.lineTo(-size * 0.18, size * 0.24);
        graphics.moveTo(size * 0.05, -size * 0.28);
        graphics.lineTo(size * 0.16, -size * 0.42);
        graphics.lineTo(size * 0.28, -size * 0.26);
        graphics.moveTo(size * 0.28, size * 0.28);
        graphics.lineTo(size * 0.38, size * 0.14);
        graphics.lineTo(size * 0.48, size * 0.28);
        graphics.strokePath();
        break;
      case "forest":
        [-0.36, -0.12, 0.14, 0.36].forEach((x, index) => {
          const y = index % 2 === 0 ? 0.08 : -0.16;
          graphics.fillStyle(detailColor, active ? 0.75 : 0.28);
          graphics.fillTriangle(size * x - 7, size * y + 8, size * x, size * y - 11, size * x + 7, size * y + 8);
          graphics.fillStyle(this.mixColor(detailColor, 0xffffff, 0.18), active ? 0.45 : 0.14);
          graphics.fillCircle(size * x - 3, size * y - 1, 3);
          graphics.fillStyle(shadowColor, active ? 0.85 : 0.28);
          graphics.fillRect(size * x - 1.5, size * y + 6, 3, 8);
        });
        break;
    }

    if (!active) {
      graphics.fillStyle(0x020617, 0.38);
      const hexPoints = getHexPoints(0, 0, size);
      graphics.beginPath();
      graphics.moveTo(hexPoints[0].x, hexPoints[0].y);
      for (let i = 1; i < hexPoints.length; i++) {
        graphics.lineTo(hexPoints[i].x, hexPoints[i].y);
      }
      graphics.closePath();
      graphics.fillPath();
      graphics.lineStyle(1, 0xffffff, 0.14);
      for (let x = -size; x <= size; x += 10) {
        graphics.beginPath();
        graphics.moveTo(x - size * 0.25, -size * 0.55);
        graphics.lineTo(x + size * 0.25, size * 0.55);
        graphics.strokePath();
      }
    }
  }

  private drawWaterLines(
    graphics: Phaser.GameObjects.Graphics,
    size: number,
    color: number
  ) {
    [-0.24, 0, 0.24].forEach((offset) => {
      graphics.lineStyle(1.6, color, 0.62);
      this.drawSinuousLine(graphics, [
        { x: -size * 0.42, y: size * offset },
        { x: -size * 0.18, y: size * (offset - 0.12) },
        { x: size * 0.04, y: size * offset },
        { x: size * 0.26, y: size * (offset + 0.12) },
        { x: size * 0.48, y: size * offset },
      ]);
    });
  }

  private drawSinuousLine(
    graphics: Phaser.GameObjects.Graphics,
    points: Array<{ x: number; y: number }>
  ) {
    if (points.length === 0) return;
    graphics.beginPath();
    graphics.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      graphics.lineTo(points[i].x, points[i].y);
    }
    graphics.strokePath();
  }

  private drawTileHalo(
    graphics: Phaser.GameObjects.Graphics,
    color: number,
    alpha: number
  ) {
    const hexPoints = getHexPoints(0, 0, this.hexSize + 4);
    graphics.lineStyle(8, color, alpha);
    graphics.beginPath();
    graphics.moveTo(hexPoints[0].x, hexPoints[0].y);
    for (let i = 1; i < hexPoints.length; i++) {
      graphics.lineTo(hexPoints[i].x, hexPoints[i].y);
    }
    graphics.closePath();
    graphics.strokePath();
  }

  private drawTopDownShadow(graphics: Phaser.GameObjects.Graphics) {
    const hexPoints = getHexPoints(0, 0, this.hexSize);
    graphics.fillStyle(0x020617, 0.26);
    graphics.beginPath();
    graphics.moveTo(hexPoints[0].x + 2, hexPoints[0].y + 4);
    for (let i = 1; i < hexPoints.length; i++) {
      graphics.lineTo(hexPoints[i].x + 2, hexPoints[i].y + 4);
    }
    graphics.closePath();
    graphics.fillPath();
  }

  private drawTopDownRim(
    graphics: Phaser.GameObjects.Graphics,
    lightColor: number,
    darkColor: number
  ) {
    const points = getHexPoints(0, 0, this.hexSize - 2);
    graphics.lineStyle(1.8, lightColor, 0.38);
    graphics.beginPath();
    graphics.moveTo(points[5].x, points[5].y);
    graphics.lineTo(points[0].x, points[0].y);
    graphics.lineTo(points[1].x, points[1].y);
    graphics.strokePath();

    graphics.lineStyle(2.2, darkColor, 0.34);
    graphics.beginPath();
    graphics.moveTo(points[2].x, points[2].y);
    graphics.lineTo(points[3].x, points[3].y);
    graphics.lineTo(points[4].x, points[4].y);
    graphics.strokePath();
  }

  private drawSurfaceGrain(
    graphics: Phaser.GameObjects.Graphics,
    tile: HexTile,
    baseColor: number,
    active: boolean
  ) {
    const size = this.hexSize;
    const grainColor = this.mixColor(baseColor, 0xffffff, 0.32);
    const shadowGrain = this.mixColor(baseColor, 0x000000, 0.24);

    for (let i = 0; i < 7; i++) {
      const x = (this.tileNoise(tile, i * 2) - 0.5) * size * 1.15;
      const y = (this.tileNoise(tile, i * 2 + 1) - 0.5) * size * 0.95;
      const radius = 0.8 + this.tileNoise(tile, i + 19) * 1.4;
      graphics.fillStyle(i % 2 === 0 ? grainColor : shadowGrain, active ? 0.16 : 0.06);
      graphics.fillCircle(x, y, radius);
    }
  }

  private tileNoise(tile: HexTile, salt: number): number {
    const seed = (
      tile.coords.q * 73856093
      ^ tile.coords.r * 19349663
      ^ tile.coords.s * 83492791
      ^ salt * 2654435761
    ) >>> 0;
    return (seed % 1000) / 1000;
  }

  private mixColor(baseColor: number, targetColor: number, amount: number): number {
    return Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.IntegerToColor(baseColor),
      Phaser.Display.Color.IntegerToColor(targetColor),
      100,
      Math.round(amount * 100)
    ).color;
  }

  private heroClassColor(classId: string): number {
    switch (classId) {
      case "knight":
        return 0x60a5fa;
      case "barbarian":
        return 0xf97316;
      case "ranger":
        return 0x22c55e;
      case "paladin":
        return 0xfacc15;
      case "sorceress":
        return 0xd946ef;
      case "wizard":
        return 0x818cf8;
      case "druid":
        return 0x84cc16;
      case "necromancer":
        return 0xa855f7;
      default:
        return 0xe2e8f0;
    }
  }

  private drawIsometricHex(
    graphics: Phaser.GameObjects.Graphics,
    baseColor: number,
    strokeColor: number,
    strokeWidth: number,
    strokeAlpha: number
  ) {
    const size = this.hexSize;
    const height = size * 0.35; // 3D height of the hex (depth perception)

    // Calculate isometric hex points (diamond shape)
    const points = getHexPoints(0, 0, size);

    // Create color variations for 3D effect with more contrast
    const topColor = baseColor;
    const leftColor = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.IntegerToColor(baseColor),
      Phaser.Display.Color.IntegerToColor(0x000000),
      100,
      30 // Increase darkness for better contrast
    ).color;
    const rightColor = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.IntegerToColor(baseColor),
      Phaser.Display.Color.IntegerToColor(0x000000),
      100,
      45 // Increase darkness for better contrast
    ).color;

    // Draw the three visible faces of the isometric hex in correct order for proper overlap
    // console.log("drawIsometricHex > topColor", topColor, "leftColor", leftColor, "rightColor", rightColor);
    // 3. Right face (visible in isometric view) - Draw first for proper layering
    graphics.fillStyle(rightColor);
    graphics.beginPath();
    graphics.moveTo(points[3].x, points[3].y); // Bottom of hex
    graphics.lineTo(points[4].x, points[4].y); // Bottom left of hex
    graphics.lineTo(points[4].x, points[4].y + height); // Bottom left + depth
    graphics.lineTo(points[3].x, points[3].y + height); // Bottom + depth
    graphics.closePath();
    graphics.fillPath();

    // 2. Left face (visible in isometric view) - Draw second for proper layering
    graphics.fillStyle(leftColor);
    graphics.beginPath();
    graphics.moveTo(points[4].x, points[4].y); // Bottom left of hex
    graphics.lineTo(points[5].x, points[5].y); // Top left of hex
    graphics.lineTo(points[5].x, points[5].y + height); // Top left + depth
    graphics.lineTo(points[4].x, points[4].y + height); // Bottom left + depth
    graphics.closePath();
    graphics.fillPath();

    // 1. Top face (main hex surface) - Draw last to be on top
    graphics.fillGradientStyle(
      this.mixColor(topColor, 0xffffff, 0.16),
      this.mixColor(topColor, 0xffffff, 0.1),
      this.mixColor(topColor, 0x000000, 0.18),
      this.mixColor(topColor, 0x000000, 0.14),
      1,
      1,
      1,
      1
    );
    graphics.beginPath();
    graphics.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      graphics.lineTo(points[i].x, points[i].y);
    }
    graphics.closePath();
    graphics.fillPath();

    // Draw outlines for definition with adjusted alpha for better visibility
    graphics.lineStyle(strokeWidth, strokeColor, strokeAlpha * 0.8);

    // Top face outline
    graphics.beginPath();
    graphics.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      graphics.lineTo(points[i].x, points[i].y);
    }
    graphics.closePath();
    graphics.strokePath();

  }

  private renderGrid() {
    if (!this.gridGraphics) {
      return;
    }

    this.gridGraphics.clear();
    this.gridGraphics.lineStyle(1.5, 0xe2e8f0, isIsometricGrid ? 0.34 : 0.42);
    this.gridGraphics.setDepth(GameConfig.rendering.terrainIconDepth - 5);

    // Get an array of [key, tile], sort by depth
    const sorted = Object.entries(this.gameData).sort(
      ([, tileA], [, tileB]) => {
        const pa = cubeToPixel(tileA.coords, this.hexSize);
        const pb = cubeToPixel(tileB.coords, this.hexSize);
        return pa.y - pb.y || pa.x - pb.x;
      }
    );

    for (const [, tile] of sorted) {
      const pixel = cubeToPixel(tile.coords, this.hexSize);
      const hexPoints = getHexPoints(pixel.x, pixel.y, this.hexSize);

      this.gridGraphics.beginPath();
      this.gridGraphics.moveTo(hexPoints[0].x, hexPoints[0].y);
      for (let i = 1; i < hexPoints.length; i++) {
        this.gridGraphics.lineTo(hexPoints[i].x, hexPoints[i].y);
      }
      this.gridGraphics.closePath();
      this.gridGraphics.strokePath();
    }
  }

  private selectTile(coords: CubeCoords) {
    const key = coordsToKey(coords);
    const tileData = this.gameData[key];

    if (!tileData) return;

    // Clear previous selection
    if (this.selectedTile) {
      const prevKey = coordsToKey(this.selectedTile);
      const prevTile = this.tiles.get(prevKey);
      const prevTileData = this.gameData[prevKey];
      if (prevTile && prevTileData) {
        this._redrawTileGraphics(prevTile, prevTileData, false, false);
      }
    }

    // Highlight new selection
    this.selectedTile = coords;
    const tile = this.tiles.get(key);
    if (tile && tileData) {
      this._redrawTileGraphics(tile, tileData, false, true);
    }

    this.onTileClick?.(coords);
  }

  private clearTiles() {
    this.tiles.forEach((tile) => tile.destroy());
    this.tiles.clear();

    this.tileTerrainIcons.forEach((icon) => icon.destroy());
    this.tileTerrainIcons.clear();

    this.playerNumbers.forEach((text) => text.destroy());
    this.playerNumbers.clear();

    this.playerMarkers.forEach((marker) => marker.destroy());
    this.playerMarkers.clear();

    this.heroMarkers.forEach((text) => text.destroy());
    this.heroMarkers.clear();

    this.heroMarkerBadges.forEach((badge) => badge.destroy());
    this.heroMarkerBadges.clear();
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer) {
    // Handle camera panning with middle mouse or right mouse
    if (
      pointer.isDown &&
      (pointer.middleButtonDown() || pointer.rightButtonDown())
    ) {
      this.cameras.main.scrollX -= pointer.velocity.x / this.cameras.main.zoom;
      this.cameras.main.scrollY -= pointer.velocity.y / this.cameras.main.zoom;
    }
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer) {
    // Convert screen coordinates to world coordinates
    const worldX = pointer.worldX;
    const worldY = pointer.worldY;
    const coords = pixelToCube({ x: worldX, y: worldY }, this.hexSize);
    const key = coordsToKey(coords);
    const tile = this.gameData[key];

    // Allow clicks on all tiles in party game
    if (tile) {
      this.selectTile(coords);
    }
  }

  private handleWheel(event: WheelEvent) {
    const zoomFactor = event.deltaY > 0 ? GameConfig.camera.zoomOutFactor : GameConfig.camera.zoomInFactor;
    const newZoom = Phaser.Math.Clamp(
      this.cameras.main.zoom * zoomFactor,
      GameConfig.camera.minZoom,
      GameConfig.camera.maxZoom
    );
    this.cameras.main.setZoom(newZoom);
    this.particleSystem.setZoomLevel(newZoom);
  }

  public updateTiles(tiles: { [key: string]: HexTile }) {
    this.gameData = tiles;
    if (this.isInitialized) {
      this.renderWorld(false);
    }
  }

  public updateHeroes(heroes: Hero[]) {
    this.heroes = heroes;
    if (this.isInitialized) {
      this.renderWorld();
    }
  }

  private playerSignature(players?: HexTile["players"]): string {
    return (players ?? [])
      .map(player => {
        const hero = this.heroes.find(h => h.ownerId === player.id);
        return `${player.id}:${player.number}:${player.color}:${hero?.classId ?? ""}`;
      })
      .sort()
      .join("|");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public setFogOfWar(_enabled: boolean): void {
    // Not used in party game - parameter kept for API compatibility
  }

  public setPlayerNumbersVisibility(enabled: boolean) {
    this.showPlayerNumbers = enabled;
    if (this.isInitialized) {
      this.renderWorld();
    }
  }

  public centerOnTile(coords: CubeCoords) {
    const pixel = cubeToPixel(coords, this.hexSize);
    this.cameras.main.centerOn(pixel.x, pixel.y);
  }

  public setZoom(zoom: number) {
    this.cameras.main.setZoom(zoom);
    this.particleSystem.setZoomLevel(zoom);
  }

  // Method to trigger disaster animation - delegates to AnimationSystem
  public triggerDisasterAnimation(
    disasterId: string,
    affectedTiles: CubeCoords[]
  ): void {
    const disaster = disasterData[disasterId];
    if (!disaster) {
      console.warn(`Unknown disaster: ${disasterId}`);
      return;
    }

    // Delegate to animation system
    this.animationSystem
      .createDisasterAnimation({
        disasterId,
        affectedTiles,
      })
      .catch((error: unknown) => {
        console.error("Error creating disaster animation:", error);
      });
  }

  // Method to update event handlers from React
  public updateEventHandlers(handlers: {
    onTileClick: (coords: CubeCoords) => void;
    onTileHover: (coords: CubeCoords | null) => void;
  }) {
    this.onTileClick = handlers.onTileClick;
    this.onTileHover = handlers.onTileHover;
  }

  public getTileScreenPosition(
    coords: CubeCoords
  ): { x: number; y: number } | null {
    const key = coordsToKey(coords);
    const tile = this.tiles.get(key);

    if (!tile) return null;

    const worldX = tile.x;
    const worldY = tile.y;
    const camera = this.cameras.main;

    // Convert world position to screen position
    const screenX = (worldX - camera.scrollX) * camera.zoom;
    const screenY = (worldY - camera.scrollY) * camera.zoom;

    return { x: screenX, y: screenY };
  }

  cleanup() {
    if (!this.isInitialized) return;

    if (this.particleSystem) {
      this.particleSystem.destroy();
    }

    if (this.animationSystem) {
      this.animationSystem.destroy();
    }

    if (this.sharedEmitterManager) {
      this.sharedEmitterManager.destroy();
    }

    this.clearTiles();
    if (this.gridGraphics) {
      this.gridGraphics.destroy();
    }

    this.input.off("pointermove", this.handlePointerMove, this);
    this.input.off("pointerdown", this.handlePointerDown, this);
    this.input.off("wheel", this.handleWheel, this);
    this.events.off("shutdown", this.cleanup, this);

    this.isInitialized = false;
    clearPhaserGame();
  }

  shutdown() {
    this.cleanup();
  }

  destroy() {
    this.cleanup();
  }
}
