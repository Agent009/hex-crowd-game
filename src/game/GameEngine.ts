import Phaser from 'phaser';
import {
  CubeCoords,
  cubeToPixel,
  pixelToCube,
  HexTile,
  coordsToKey,
  coordsEqual,
  isIsometricGrid, getHexPoints, DEFAULT_HEX_SIZE
} from '../utils/hexGrid';
import {resourceData, ResourceType, terrainData, TerrainTypeData} from '../data/gameData';
import { AtmosphericParticleSystem } from './ParticleSystem';
import { GameAnimationSystem } from './AnimationSystem';
import {BuildingType} from "../data/buildingsData.ts";

export class GameScene extends Phaser.Scene {
  private tiles: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private fogTiles: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private fogOverlays: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private gridGraphics!: Phaser.GameObjects.Graphics;
  private particleSystem!: AtmosphericParticleSystem;
  private animationSystem!: GameAnimationSystem;
  private hexSize = DEFAULT_HEX_SIZE;
  private gameData: { [key: string]: HexTile } = {};
  private selectedTile: CubeCoords | null = null;
  private onTileClick?: (coords: CubeCoords) => void;
  private onTileHover?: (coords: CubeCoords | null) => void;
  private showFogOfWar: boolean = true;
  private isInitialized: boolean = false;

  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    console.log('GameScene > preload()');

    // Load terrain textures
    // this.load.image('dirt_01', 'src/assets/textures/dirt_01.png');
    // this.load.image('fire_01', 'src/assets/textures/fire_01.png');
    // this.load.image('flame_01', 'src/assets/textures/flame_01.png');
    // this.load.image('flare_01', 'src/assets/textures/flare_01.png');
    // this.load.image('light_01', 'src/assets/textures/light_01.png');
    // this.load.image('magic_05', 'src/assets/textures/magic_05.png');
    // this.load.image('scorch_01', 'src/assets/textures/scorch_01.png');
    // this.load.image('scorch_02', 'src/assets/textures/scorch_02.png');
    // this.load.image('scorch_03', 'src/assets/textures/scorch_03.png');
    this.load.image('smoke_01', 'src/assets/textures/64_64/smoke_01.png');
    // this.load.image('smoke_02', 'src/assets/textures/smoke_02.png');
    // this.load.image('spark_01', 'src/assets/textures/spark_01.png');
    // this.load.image('star_01', 'src/assets/textures/star_01.png');
  }

  create() {
    console.log('GameScene > create()');

    // Set up camera
    this.cameras.main.setZoom(1);
    this.cameras.main.centerOn(0, 0);

    if (isIsometricGrid) {
      // Adjust camera for better isometric viewing
      this.cameras.main.setRotation(0); // Keep rotation at 0 for true isometric
      this.cameras.main.setBackgroundColor('#2D5016'); // Darker background for depth
    }

    // Enable input
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('wheel', this.handleWheel, this);

    // Create grid graphics
    this.gridGraphics = this.add.graphics();

    // Initialize particle system
    this.particleSystem = new AtmosphericParticleSystem(this, this.hexSize);

    // Initialize animation system
    this.animationSystem = new GameAnimationSystem(this, this.hexSize);

    // Add keyboard controls
    const cursors = this.input.keyboard?.createCursorKeys();
    if (cursors) {
      // Handle camera movement in update loop
    }

    console.log('GameScene setup complete');
  }

  // Custom initialization method to avoid conflicts with Phaser's init
  public initializeScene(data: {
    tiles: { [key: string]: HexTile };
    onTileClick: (coords: CubeCoords) => void;
    onTileHover: (coords: CubeCoords | null) => void;
    showFogOfWar: boolean;
  }) {
    console.log('GameScene > initializeScene() > initializing scene with data:', Object.keys(data.tiles).length, 'tiles');

    this.gameData = data.tiles;
    this.onTileClick = data.onTileClick;
    this.onTileHover = data.onTileHover;
    this.showFogOfWar = data.showFogOfWar;
    this.isInitialized = true;

    // Render initial tiles
    this.renderWorld();
  }

  update() {
    console.log('GameScene > update()');
    // Handle camera movement
    const cursors = this.input.keyboard?.createCursorKeys();
    if (cursors) {
      const speed = 5;
      if (cursors.left?.isDown) this.cameras.main.scrollX -= speed;
      if (cursors.right?.isDown) this.cameras.main.scrollX += speed;
      if (cursors.up?.isDown) this.cameras.main.scrollY -= speed;
      if (cursors.down?.isDown) this.cameras.main.scrollY += speed;
    }
  }

  private renderWorld() {
    console.log('GameScene > renderWorld() > rendering world with', Object.keys(this.gameData).length, 'tiles');
    this.clearTiles();

    Object.keys(this.gameData).forEach(key => {
      const tile = this.gameData[key];
      this.renderTile(tile);
    });

    this.renderGrid();
    this.updateAtmosphericEffects();
    console.log('World rendering complete');
  }

  private renderTile(tile: HexTile) {
    const key = coordsToKey(tile.coords);
    const pixel = cubeToPixel(tile.coords, this.hexSize);

    // Remove existing tile graphics if they exist
    const existingTile = this.tiles.get(key);
    if (existingTile) {
      existingTile.destroy();
    }

    // Remove existing fog overlay if it exists
    const existingFog = this.fogOverlays.get(key);
    if (existingFog) {
      existingFog.destroy();
      this.fogOverlays.delete(key);
    }

    // Create hex graphics
    const graphics = this.add.graphics();
    graphics.setPosition(pixel.x, pixel.y);

    this._redrawTileGraphics(graphics, tile, false, false);

    // Clear any existing icons/objects on this tile
    const existingObjects = this.children.list.filter(child => {
      // Check if the child has position properties
      return (
        child !== graphics &&
        'x' in child &&
        'y' in child &&
        (child as unknown as Phaser.GameObjects.Components.Transform).x === pixel.x &&
        (child as unknown as Phaser.GameObjects.Components.Transform).y === pixel.y
      );
    });
    existingObjects.forEach(obj => {
      if (obj.type === 'Text') {
        obj.destroy();
      }
    });

    // Add terrain features
    if (tile.resource) {
      const resource = resourceData[tile.resource];
      this.add.text(pixel.x, pixel.y - 8, resource.emoji, {
        fontSize: '16px',
        align: 'center'
      }).setOrigin(0.5);
    }

    if (tile.building) {
      this.add.text(pixel.x, pixel.y + 8, '🏰', {
        fontSize: '20px',
        align: 'center'
      }).setOrigin(0.5);
    }

    if (tile.hero) {
      this.add.text(pixel.x, pixel.y, '🧙‍♂️', {
        fontSize: '18px',
        align: 'center'
      }).setOrigin(0.5).setDepth(1010); // Higher depth to render on top
    }

    // Add fog of war
    if (this.showFogOfWar && tile.fogLevel < 2) {
      const fogGraphics = this.add.graphics();
      fogGraphics.setPosition(pixel.x, pixel.y);

      // Create gradient fog effect
      const alpha = tile.fogLevel === 0 ? 0.85 : 0.5;
      const fogColor = tile.fogLevel === 0 ? 0x1a1a2e : 0x2d2d44;

      fogGraphics.fillStyle(fogColor, alpha);
      const hexPoints = getHexPoints(0, 0, this.hexSize);
      fogGraphics.beginPath();
      fogGraphics.moveTo(hexPoints[0].x, hexPoints[0].y);
      for (let i = 1; i < hexPoints.length; i++) {
        fogGraphics.lineTo(hexPoints[i].x, hexPoints[i].y);
      }
      fogGraphics.closePath();
      fogGraphics.fillPath();

      // Add subtle border for fog transition
      if (tile.fogLevel === 1) {
        fogGraphics.lineStyle(1, 0x4a4a6a, 0.3);
        fogGraphics.strokePath();
      }

      fogGraphics.setDepth(1300);
      this.fogOverlays.set(key, fogGraphics);
    }

    // Make tile interactive only if it's visible or explored
    const hexPoints = getHexPoints(0, 0, this.hexSize);

    // Only make tiles interactive if they are visible (fogLevel > 0) or fog of war is disabled
    const isInteractive = !this.showFogOfWar || tile.fogLevel > 0;

    if (isInteractive) {
      graphics.setInteractive(new Phaser.Geom.Polygon(hexPoints), Phaser.Geom.Polygon.Contains);
      graphics.on('pointerover', () => {
        this._redrawTileGraphics(graphics, tile, true, (this.selectedTile && coordsEqual(this.selectedTile, tile.coords)) || false);
        this.onTileHover?.(tile.coords);
      });
      graphics.on('pointerout', () => {
        this._redrawTileGraphics(graphics, tile, false, (this.selectedTile && coordsEqual(this.selectedTile, tile.coords)) || false);
        this.onTileHover?.(null);
      });
      graphics.on('pointerdown', () => {
        this.selectTile(tile.coords);
      });
    }

    this.tiles.set(key, graphics);
  }

  private _redrawTileGraphics(graphics: Phaser.GameObjects.Graphics, tile: HexTile, isHovered: boolean, isSelected: boolean) {
    graphics.clear();

    const { y } = cubeToPixel(tile.coords, this.hexSize);
    const terrain = terrainData[tile.terrain];
    const baseColor = Phaser.Display.Color.HexStringToColor(terrain.color).color;

    // Determine stroke style based on state
    let strokeColor = 0x666666;
    let strokeAlpha = 0.5;
    let strokeWidth = 1;

    if (isSelected) {
      strokeColor = 0xFFFF00;
      strokeAlpha = 1;
      strokeWidth = 3;
    } else if (isHovered) {
      strokeColor = 0xFFFFFF;
      strokeAlpha = 0.8;
      strokeWidth = 2;
    }

    // Draw the hex tile
    // console.log("Drawing hex tile at", tile.coords, "with terrain", terrain.name, "and depth", y);
    this.drawHex(graphics, baseColor, terrain, strokeColor, strokeWidth, strokeAlpha);
    // Farthest (small y) drawn first, then closer on top
    graphics.setDepth(Math.round(y - 1000));
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
      return this.drawIsometricHex(graphics, baseColor, strokeColor, strokeWidth, strokeAlpha);
    }

    // Draw hex shape
    graphics.lineStyle(strokeWidth, strokeColor, strokeAlpha);
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(terrain.color).color);

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
      100, 30 // Increase darkness for better contrast
    ).color;
    const rightColor = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.IntegerToColor(baseColor),
      Phaser.Display.Color.IntegerToColor(0x000000),
      100, 45 // Increase darkness for better contrast
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

    // Left face outline
    // graphics.beginPath();
    // graphics.moveTo(points[4].x, points[4].y);
    // graphics.lineTo(points[5].x, points[5].y);
    // graphics.lineTo(points[5].x, points[5].y + height);
    // graphics.lineTo(points[4].x, points[4].y + height);
    // graphics.closePath();
    // graphics.strokePath();

    // Right face outline
    // graphics.beginPath();
    // graphics.moveTo(points[3].x, points[3].y);
    // graphics.lineTo(points[4].x, points[4].y);
    // graphics.lineTo(points[4].x, points[4].y + height);
    // graphics.lineTo(points[3].x, points[3].y + height);
    // graphics.closePath();
    // graphics.strokePath();
  }

  private renderGrid() {
    console.log("GameScene > renderGrid()");
    if (!this.gridGraphics) {
      return;
    }

    this.gridGraphics.clear();
    this.gridGraphics.lineStyle(1, 0x444444, isIsometricGrid ? 0.2 : 0.3);

    // Get an array of [key, tile], sort by depth
    const sorted = Object.entries(this.gameData).sort(([, tileA], [, tileB]) => {
      const pa = cubeToPixel(tileA.coords, this.hexSize);
      const pb = cubeToPixel(tileB.coords, this.hexSize);
      return (pa.y - pb.y) || (pa.x - pb.x);
    });

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

    // Only allow selection of visible tiles
    if (this.showFogOfWar && tileData && tileData.fogLevel === 0) {
      return; // Cannot select tiles in dense fog
    }

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

  private updateAtmosphericEffects() {
    if (!this.particleSystem) {
      return;
    }

    Object.keys(this.gameData).forEach(key => {
      const tile = this.gameData[key];

      // Update fog particles based on fog level
      this.particleSystem.updateFogIntensity(tile.coords, tile.fogLevel);

      // Add ambient effects for explored tiles
      if (tile.fogLevel === 2 && Math.random() < 0.3) {
        this.particleSystem.createAmbientEffect(tile.coords, tile.terrain);
      }
    });
  }

  public triggerExplorationEffect(coords: CubeCoords) {
    // Use new animation system for exploration effects
    this.animationSystem.createFogRevealAnimation({
      coords,
      revealRadius: 2,
      duration: 1000
    });
  }

  public triggerResourceDiscovery(coords: CubeCoords, resourceType: ResourceType, amount: number) {
    this.animationSystem.createResourceDiscoveryAnimation({
      coords,
      resourceType,
      amount,
      duration: 2300 // Total duration of all phases
    });
  }

  public triggerConstructionCompletion(coords: CubeCoords, buildingType: BuildingType, level: number) {
    this.animationSystem.createConstructionCompletionAnimation({
      coords,
      buildingType,
      level,
      duration: 1500 // Total duration of all phases
    });
  }

  public triggerMovementEffect(fromCoords: CubeCoords, toCoords: CubeCoords) {
    this.particleSystem.createUnitMovementEffect(fromCoords, toCoords);
  }

  private clearTiles() {
    // Destroy all existing tile graphics
    this.tiles.forEach(tile => tile.destroy());
    this.tiles.clear();

    // Destroy all fog tiles
    this.fogTiles.forEach(fog => fog.destroy());
    this.fogTiles.clear();

    // Destroy all fog overlays
    this.fogOverlays.forEach(fog => fog.destroy());
    this.fogOverlays.clear();

    // Clear all text objects (icons) that might be left over
    const textObjects = this.children.list.filter(child => child.type === 'Text');
    textObjects.forEach(obj => obj.destroy());
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer) {
    // Handle camera panning with middle mouse or right mouse
    if (pointer.isDown && (pointer.middleButtonDown() || pointer.rightButtonDown())) {
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

    // Only allow clicks on visible tiles or when fog of war is disabled
    if (tile && (!this.showFogOfWar || tile.fogLevel > 0)) {
      this.selectTile(coords);
    }
  }

  private handleWheel(event: WheelEvent) {
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Phaser.Math.Clamp(this.cameras.main.zoom * zoomFactor, 0.5, 2);
    this.cameras.main.setZoom(newZoom);
    this.particleSystem.setZoomLevel(newZoom);
  }

  // Public methods for external control
  public updateTiles(tiles: { [key: string]: HexTile }) {
    console.log('Updating tiles in scene:', Object.keys(tiles).length);
    this.gameData = tiles;
    if (this.isInitialized) {
      // Force a complete re-render to ensure hero icons are properly updated
      this.renderWorld();
    }
  }

  public setFogOfWar(enabled: boolean) {
    this.showFogOfWar = enabled;
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

  // Method to update event handlers from React
  public updateEventHandlers(handlers: {
    onTileClick: (coords: CubeCoords) => void;
    onTileHover: (coords: CubeCoords | null) => void;
  }) {
    this.onTileClick = handlers.onTileClick;
    this.onTileHover = handlers.onTileHover;
  }


  cleanup() {
    // Clean up particle system
    if (this.particleSystem) {
      this.particleSystem.destroy();
    }

    // Clean up animation system
    if (this.animationSystem) {
      this.animationSystem.destroy();
    }

    // Clear all graphics and game objects
    this.clearTiles();
    if (this.gridGraphics) {
      this.gridGraphics.destroy();
    }

    // Remove event listeners
    this.input.off('pointermove', this.handlePointerMove, this);
    this.input.off('pointerdown', this.handlePointerDown, this);
    this.input.off('wheel', this.handleWheel, this);

    // Reset state
    this.isInitialized = false;
  }

  shutdown() {
    this.cleanup();
  }

  destroy() {
    this.cleanup();
  }
}
