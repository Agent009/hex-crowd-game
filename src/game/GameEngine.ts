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

export class GameScene extends Phaser.Scene {
  private tiles: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private tileTerrainIcons: Map<string, Phaser.GameObjects.Text> = new Map();
  private playerNumbers: Map<string, Phaser.GameObjects.Text> = new Map();
  private gridGraphics!: Phaser.GameObjects.Graphics;
  private sharedEmitterManager!: ParticleEmitterManager;
  private particleSystem!: AtmosphericParticleSystem;
  private animationSystem!: GameAnimationSystem;
  private hexSize = DEFAULT_HEX_SIZE;
  private gameData: { [key: string]: HexTile } = {};
  private previousGameData: { [key: string]: HexTile } = {};
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
    this.cameras.main.setZoom(1);
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
    onTileClick: (coords: CubeCoords) => void;
    onTileHover: (coords: CubeCoords | null) => void;
    showPlayerNumbers: boolean;
  }) {

    this.gameData = data.tiles;
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

      if (
        curr.terrain !== prev.terrain ||
        curr.isActive !== prev.isActive ||
        curr.fogLevel !== prev.fogLevel ||
        (curr.players?.length ?? 0) !== (prev.players?.length ?? 0) ||
        curr.players !== prev.players
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
  }

  private renderTile(tile: HexTile) {
    const key = coordsToKey(tile.coords);
    const pixel = cubeToPixel(tile.coords, this.hexSize);

    const graphics = this.add.graphics();
    graphics.setPosition(pixel.x, pixel.y);

    this._redrawTileGraphics(graphics, tile, false, false);

    if (tile.isActive !== false) {
      const terrain = terrainData[tile.terrain];
      if (terrain?.icon) {
        let terrainSymbol = "";
        switch (tile.terrain) {
          case "lake":
            terrainSymbol = "🌊";
            break;
          case "river":
            terrainSymbol = "💧";
            break;
          case "mountain":
            terrainSymbol = "⛰️";
            break;
          case "desert":
            terrainSymbol = "🏜️";
            break;
          case "plains":
            terrainSymbol = "💎";
            break;
          case "forest":
            terrainSymbol = "🌲";
            break;
        }

        if (terrainSymbol) {
          const iconText = this.add
            .text(pixel.x, pixel.y, terrainSymbol, {
              fontSize: "16px",
              align: "center",
            })
            .setOrigin(0.5)
            .setDepth(GameConfig.rendering.terrainIconDepth);
          this.tileTerrainIcons.set(key, iconText);
        }
      }
    }

    // Add players on this tile
    if (tile.players && tile.players.length > 0 && this.showPlayerNumbers) {
      const playerCount = tile.players.length;
      tile.players.forEach((player, index) => {
        const offsetY = index * 20 - (playerCount - 1) * 10;

        // Player number circle
        const playerText = this.add
          .text(pixel.x, pixel.y + offsetY, player.number.toString(), {
            fontSize: "14px",
            color: "#ffffff",
            backgroundColor: "#DC2626",
            padding: { x: 6, y: 4 },
          })
          .setOrigin(0.5)
          .setDepth(GameConfig.rendering.playerNumberDepth);

        // Make it circular
        playerText.setStyle({
          ...playerText.style,
          borderRadius: "50%",
        });

        this.playerNumbers.set(`${key}_${player.id}`, playerText);
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
    let strokeColor = 0x666666;
    let strokeAlpha = 0.5;
    let strokeWidth = 1;

    if (isSelected) {
      strokeColor = 0xffff00;
      strokeAlpha = 1;
      strokeWidth = 3;
    } else if (isHovered) {
      strokeColor = 0xffffff;
      strokeAlpha = 0.8;
      strokeWidth = 2;
    }

    // Draw the hex tile
    // console.log("Drawing hex tile at", tile.coords, "with terrain", terrain.name, "and depth", y);
    this.drawHex(
      graphics,
      baseColor,
      terrain,
      strokeColor,
      strokeWidth,
      strokeAlpha
    );
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
    graphics.lineStyle(strokeWidth, strokeColor, strokeAlpha);
    graphics.fillStyle(
      Phaser.Display.Color.HexStringToColor(terrain.color).color
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
    graphics.fillStyle(topColor);
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
    this.gridGraphics.lineStyle(1, 0x444444, isIsometricGrid ? 0.2 : 0.3);

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
