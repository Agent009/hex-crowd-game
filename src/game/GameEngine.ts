import Phaser from "phaser";
import {
  CubeCoords,
  cubeToPixel,
  pixelToCube,
  HexTile,
  coordsToKey,
  coordsEqual,
  isIsometricGrid,
  isTacticalGrid,
  getHexPoints,
  DEFAULT_HEX_SIZE,
  TACTICAL_TILT_Y,
} from "../utils/hexGrid";
import { terrainData, TerrainType, TerrainTypeData, Player } from "../data/gameData";
import { disasterData } from "../data/gameData";
import {
  terrainTextureSources,
  terrainSourceKey,
  terrainTileKey,
  TERRAIN_SAMPLE_SCALE,
} from "./terrainTextures";
import { AtmosphericParticleSystem } from "./ParticleSystem";
import { GameAnimationSystem } from "./AnimationSystem";
import { TextureFactory } from "./TextureFactory";
import { ParticleEmitterManager } from "./ParticleEmitterManager";
import { setPhaserGame, clearPhaserGame } from "./phaserRef";
import { GameConfig } from "./GameConfig";
import { Hero } from "../store/types";
import { heroClasses } from "../data/heroesData";

// Depleted/inactive tile look: a desaturated slate tint multiplied over the
// terrain photo plus reduced opacity reads clearly as "spent / not harvestable".
const INACTIVE_TINT = 0x49506a;
const INACTIVE_ALPHA = 0.78;

export class GameScene extends Phaser.Scene {
  private tiles: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private tileTerrainSprites: Map<string, Phaser.GameObjects.Image> = new Map();
  // Active flip tweens per tile, so a re-render mid-flip can cancel cleanly.
  private tileFlipTweens: Map<string, Phaser.Tweens.Tween> = new Map();
  private terrainVariantCounts: Partial<Record<TerrainType, number>> = {};
  private highlightGraphics?: Phaser.GameObjects.Graphics;
  private hoveredTile: CubeCoords | null = null;
  private tileTerrainIcons: Map<string, Phaser.GameObjects.Text> = new Map();
  // One container per player-on-tile holds the whole standing pawn (halo,
  // shadow, body, head/number, hero badge) so it can move and animate as a unit.
  private playerTokens: Map<string, Phaser.GameObjects.Container> = new Map();
  private gridGraphics!: Phaser.GameObjects.Graphics;
  private backdropGraphics?: Phaser.GameObjects.Graphics;
  private ambientGlow?: Phaser.GameObjects.Graphics;
  private ambientTween?: Phaser.Tweens.Tween;
  private sharedEmitterManager!: ParticleEmitterManager;
  private particleSystem!: AtmosphericParticleSystem;
  private animationSystem!: GameAnimationSystem;
  private hexSize = DEFAULT_HEX_SIZE;
  private gameData: { [key: string]: HexTile } = {};
  private previousGameData: { [key: string]: HexTile } = {};
  private heroes: Hero[] = [];
  private playerLastCoords: Map<string, CubeCoords> = new Map();
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

  preload() {
    // Atmospheric terrain art is only used by the tilted tactical board.
    if (isTacticalGrid) {
      (Object.keys(terrainTextureSources) as TerrainType[]).forEach((terrain) => {
        terrainTextureSources[terrain].forEach((url, variant) => {
          this.load.image(terrainSourceKey(terrain, variant), url);
        });
      });
    }
  }

  create() {

    // Set up camera
    this.cameras.main.setZoom(0.82);
    this.cameras.main.centerOn(0, 0);

    // Make the game instance globally accessible for coordinate conversion
    setPhaserGame(this.game);

    if (isIsometricGrid || isTacticalGrid) {
      this.cameras.main.setRotation(0);
      this.cameras.main.setBackgroundColor(GameConfig.camera.backgroundColor);
    }

    // Ambient backdrop framing the board with depth.
    this.createAmbientBackdrop();

    // Enable input
    this.input.on("pointermove", this.handlePointerMove, this);
    this.input.on("pointerdown", this.handlePointerDown, this);
    this.input.on("wheel", this.handleWheel, this);

    // Create grid graphics
    this.gridGraphics = this.add.graphics();

    // Initialize all textures first (must be before particle/animation systems)
    TextureFactory.initialize(this);

    // Bake atmospheric, hex-masked terrain tile textures from the loaded art.
    this.bakeTerrainTextures();

    // Single shared overlay for hover/select rings, drawn above textured tiles
    // but below tokens — avoids per-tile redraws when the texture sits on top.
    this.highlightGraphics = this.add.graphics();
    this.highlightGraphics.setDepth(GameConfig.rendering.terrainIconDepth - 4);

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

    const flipTween = this.tileFlipTweens.get(key);
    if (flipTween) {
      flipTween.stop();
      this.tileFlipTweens.delete(key);
    }

    const terrainSprite = this.tileTerrainSprites.get(key);
    if (terrainSprite) {
      terrainSprite.destroy();
      this.tileTerrainSprites.delete(key);
    }

    const terrainIcon = this.tileTerrainIcons.get(key);
    if (terrainIcon) {
      terrainIcon.destroy();
      this.tileTerrainIcons.delete(key);
    }

    const tokenKeysToRemove: string[] = [];
    this.playerTokens.forEach((token, pKey) => {
      if (pKey.startsWith(`${key}_`)) {
        this.destroyPlayerToken(token);
        tokenKeysToRemove.push(pKey);
      }
    });
    tokenKeysToRemove.forEach((k) => this.playerTokens.delete(k));
  }

  private renderTile(tile: HexTile) {
    const key = coordsToKey(tile.coords);
    const pixel = cubeToPixel(tile.coords, this.hexSize);

    const graphics = this.add.graphics();
    graphics.setPosition(pixel.x, pixel.y);

    this._redrawTileGraphics(graphics, tile, false, false);

    // Atmospheric terrain photo as the slab top face (tactical board), layered
    // just above the slab walls. The vector top drawn above is the fallback for
    // the first frame / non-tactical modes.
    if (isTacticalGrid && (this.terrainVariantCounts[tile.terrain] ?? 0) > 0) {
      const variant = this.pickTerrainVariant(tile);
      const tileKey = terrainTileKey(tile.terrain, variant);
      if (this.textures.exists(tileKey)) {
        const active = tile.isActive !== false;
        const sprite = this.add
          .image(pixel.x, pixel.y, tileKey)
          .setOrigin(0.5, 0.5)
          .setDisplaySize(this.hexTexWidth, this.hexTexHeight)
          .setDepth(Math.round(pixel.y + GameConfig.rendering.tileDepthOffset) + 0.3);
        // Dim inactive/non-harvestable tiles instead of the vector hatch overlay.
        if (!active) {
          sprite.setTint(INACTIVE_TINT);
          sprite.setAlpha(INACTIVE_ALPHA);
        }
        this.tileTerrainSprites.set(key, sprite);
      }
    }

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

        // Track movement so the token can hop in from its previous tile.
        const prevCoords = this.playerLastCoords.get(player.id);
        const movedFrom = prevCoords && !coordsEqual(prevCoords, tile.coords)
          ? cubeToPixel(prevCoords, this.hexSize)
          : null;
        this.playerLastCoords.set(player.id, tile.coords);

        const token = this.buildPlayerToken(
          player,
          pixel.x + offsetX,
          pixel.y + offsetY,
          movedFrom ? { x: movedFrom.x + offsetX, y: movedFrom.y + offsetY } : null
        );
        this.playerTokens.set(markerKey, token);
      });
    }

    // Make all tiles interactive in party game
    const hexPoints = getHexPoints(0, 0, this.hexSize);
    graphics.setInteractive(
      new Phaser.Geom.Polygon(hexPoints),
      Phaser.Geom.Polygon.Contains
    );
    graphics.on("pointerover", () => {
      // Textured tactical tiles are static; hover shows on the shared overlay
      // so we never have to redraw (and re-cover) the photo top.
      if (isTacticalGrid) {
        this.hoveredTile = tile.coords;
        this.updateHighlight();
      } else {
        this._redrawTileGraphics(
          graphics,
          tile,
          true,
          (this.selectedTile && coordsEqual(this.selectedTile, tile.coords)) ||
            false
        );
      }
      this.onTileHover?.(tile.coords);
    });
    graphics.on("pointerout", () => {
      if (isTacticalGrid) {
        if (this.hoveredTile && coordsEqual(this.hoveredTile, tile.coords)) {
          this.hoveredTile = null;
          this.updateHighlight();
        }
      } else {
        this._redrawTileGraphics(
          graphics,
          tile,
          false,
          (this.selectedTile && coordsEqual(this.selectedTile, tile.coords)) ||
            false
        );
      }
      this.onTileHover?.(null);
    });
    graphics.on("pointerdown", () => {
      this.selectTile(tile.coords);
    });

    this.tiles.set(key, graphics);
  }

  /**
   * Build a standing isometric "pawn" for a player on a tile: a foreshortened
   * ground halo + contact shadow, a shaded body rising off the board, and a
   * number-disc head (plus a hero badge if owned), grouped in a container so
   * the whole piece can hop between tiles as a unit.
   */
  private buildPlayerToken(
    player: Player,
    cx: number,
    cy: number,
    movedFrom: { x: number; y: number } | null
  ): Phaser.GameObjects.Container {
    const s = this.hexSize;
    const tilt = isTacticalGrid ? TACTICAL_TILT_Y : 1;
    const teamColor = Phaser.Display.Color.HexStringToColor(player.color).color;
    const lightCol = this.mixColor(teamColor, 0xffffff, 0.28);
    const darkCol = this.mixColor(teamColor, 0x000000, 0.4);

    const container = this.add.container(cx, cy);
    // Small per-row bias keeps nearer pawns above farther ones while staying in
    // the token depth band (above grid/highlight, below floating animations).
    container.setDepth(GameConfig.rendering.playerNumberDepth + cy * 0.02);

    // Pulsing ground glow (foreshortened) so the token pops against terrain.
    const halo = this.add.graphics();
    halo.fillStyle(teamColor, 0.26);
    halo.fillEllipse(0, 0, s * 1.1, s * 1.1 * tilt);
    halo.fillStyle(teamColor, 0.14);
    halo.fillEllipse(0, 0, s * 1.5, s * 1.5 * tilt);
    container.add(halo);
    this.tweens.add({
      targets: halo,
      alpha: { from: 0.5, to: 1 },
      scale: { from: 0.85, to: 1.12 },
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Contact shadow on the ground (shrinks while the pawn is airborne).
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.36);
    shadow.fillEllipse(0, 1.5, s * 0.66, s * 0.66 * tilt);
    container.add(shadow);

    // The figure hops as one (figure.y); an inner `bob` carries a gentle idle
    // sway (bob.y) that composes with the hop instead of fighting it.
    const figure = this.add.container(0, 0);
    const bob = this.add.container(0, 0);
    const headY = -s * 0.66;
    const headR = s * 0.33;
    const bodyW = s * 0.34;
    const bodyTop = headY + headR * 0.4;
    const bodyBot = -s * 0.03;

    const g = this.add.graphics();
    // Base plate where the pawn meets the board.
    g.fillStyle(darkCol, 1);
    g.fillEllipse(0, bodyBot, s * 0.6, s * 0.6 * tilt);
    g.fillStyle(this.mixColor(teamColor, 0x000000, 0.15), 1);
    g.fillEllipse(0, bodyBot - 1, s * 0.46, s * 0.46 * tilt);
    // Tapered body — shadow side full, lit side overlaid for volume.
    g.fillStyle(darkCol, 1);
    g.fillRoundedRect(-bodyW / 2, bodyTop, bodyW, bodyBot - bodyTop, bodyW * 0.45);
    g.fillStyle(teamColor, 1);
    g.fillRoundedRect(-bodyW / 2, bodyTop, bodyW * 0.6, bodyBot - bodyTop, bodyW * 0.45 * 0.6);
    // Head disc (number holder): dark backing + body + sheen + inner + ring.
    g.fillStyle(0x0f172a, 0.92);
    g.fillCircle(0, headY + 1.5, headR + 1.5);
    g.fillStyle(teamColor, 1);
    g.fillCircle(0, headY, headR);
    g.fillStyle(lightCol, 0.55);
    g.fillCircle(-headR * 0.3, headY - headR * 0.3, headR * 0.4);
    g.fillStyle(0x0f172a, 0.85);
    g.fillCircle(0, headY, headR * 0.68);
    g.lineStyle(2.2, 0xffffff, 0.95);
    g.strokeCircle(0, headY, headR);
    bob.add(g);

    const numberText = this.add
      .text(0, headY, player.number.toString(), {
        fontSize: `${Math.max(10, Math.round(headR * 1.05))}px`,
        color: "#ffffff",
        fontStyle: "bold",
        stroke: "#020617",
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    bob.add(numberText);

    const hero = this.heroes.find((h) => h.ownerId === player.id);
    const heroClass = hero ? heroClasses[hero.classId] : null;
    if (hero && heroClass) {
      const hx = headR * 0.95;
      const hy = headY - headR * 0.95;
      const heroColor = this.heroClassColor(hero.classId);
      const heroHealth = Phaser.Math.Clamp(hero.hp / Math.max(hero.maxHp, 1), 0, 1);
      const badge = this.add.graphics();
      badge.fillStyle(0x020617, 0.9);
      badge.fillCircle(hx, hy, 10);
      badge.fillStyle(heroColor, 0.95);
      badge.fillCircle(hx, hy, 7);
      badge.lineStyle(2, 0xffffff, 0.9);
      badge.beginPath();
      badge.arc(hx, hy, 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * heroHealth, false);
      badge.strokePath();
      bob.add(badge);
      const heroText = this.add
        .text(hx, hy, heroClass.icon, {
          fontSize: "11px",
          stroke: "#020617",
          strokeThickness: 2,
        })
        .setOrigin(0.5);
      bob.add(heroText);
    }

    figure.add(bob);
    container.add(figure);

    // Gentle idle sway, desynced per player so the field doesn't bob in unison.
    const bobPhase = (player.number % 6) * 140;
    this.tweens.add({
      targets: bob,
      y: { from: 0, to: -s * 0.16 },
      duration: 1500 + (player.number % 4) * 220,
      delay: bobPhase,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    container.setData("anim", [halo, shadow, figure, bob, numberText]);

    if (movedFrom) {
      this.animateTokenHop(container, figure, shadow, numberText, teamColor, movedFrom, cx, cy);
    }

    return container;
  }

  /**
   * Hop a token from `from` to its resting (cx,cy): the container slides along
   * the ground while the figure arcs up and back down (a parabola), with a
   * shrinking shadow, a landing squash, a number pop and a dust ring.
   */
  private animateTokenHop(
    container: Phaser.GameObjects.Container,
    figure: Phaser.GameObjects.Container,
    shadow: Phaser.GameObjects.Graphics,
    numberText: Phaser.GameObjects.Text,
    teamColor: number,
    from: { x: number; y: number },
    cx: number,
    cy: number
  ): void {
    const duration = 460;
    const hopHeight = this.hexSize * 1.1;

    container.setPosition(from.x, from.y);
    this.tweens.add({ targets: container, x: cx, y: cy, duration, ease: "Sine.easeInOut" });

    // Arc up then back down — yoyo makes the symmetric parabola.
    this.tweens.add({
      targets: figure,
      y: -hopHeight,
      duration: duration / 2,
      ease: "Quad.easeOut",
      yoyo: true,
    });
    // Shadow shrinks/fades while the pawn is high.
    this.tweens.add({
      targets: shadow,
      scale: { from: 1, to: 0.6 },
      alpha: { from: 0.36, to: 0.2 },
      duration: duration / 2,
      ease: "Quad.easeOut",
      yoyo: true,
    });
    // Landing squash as it touches down.
    this.tweens.add({
      targets: figure,
      scaleX: { from: 1, to: 1.18 },
      scaleY: { from: 1, to: 0.82 },
      delay: duration - 45,
      duration: 95,
      yoyo: true,
      ease: "Quad.easeOut",
    });
    // Number pop on arrival.
    this.tweens.add({
      targets: numberText,
      scale: { from: 1, to: 1.3 },
      delay: duration - 70,
      duration: 130,
      yoyo: true,
      ease: "Quad.easeOut",
    });
    // Foreshortened dust ring at the destination.
    const tilt = isTacticalGrid ? TACTICAL_TILT_Y : 1;
    const dust = this.add.graphics();
    dust.lineStyle(3, teamColor, 0.85);
    dust.strokeEllipse(0, 0, this.hexSize * 0.5, this.hexSize * 0.5 * tilt);
    dust.setPosition(cx, cy);
    dust.setDepth(GameConfig.rendering.playerNumberDepth - 1);
    dust.setScale(0.4).setAlpha(0);
    this.tweens.add({
      targets: dust,
      delay: duration - 60,
      scale: 2.4,
      alpha: { from: 0.9, to: 0 },
      duration: 460,
      ease: "Cubic.easeOut",
      onComplete: () => dust.destroy(),
    });
  }

  /** Kill a token's animations and destroy it (and its children). */
  private destroyPlayerToken(container: Phaser.GameObjects.Container): void {
    const anim =
      (container.getData("anim") as Phaser.GameObjects.GameObject[] | undefined) ?? [];
    anim.forEach((t) => this.tweens.killTweensOf(t));
    this.tweens.killTweensOf(container);
    container.destroy(true);
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

    // Tactical tiles are static slabs: the photo top + shared highlight overlay
    // handle terrain detail and hover/select, so the base graphics just draws
    // the extruded walls (+ a colour fallback top under the photo).
    if (isTacticalGrid) {
      // Dim the slab walls to match the depleted top when the tile is spent.
      const active = tile.isActive !== false;
      const slabColor = active ? baseColor : this.mixColor(baseColor, INACTIVE_TINT, 0.65);
      this.drawHex(graphics, slabColor, terrain, 0x0f172a, 2, 0.85);
      graphics.setDepth(Math.round(y + GameConfig.rendering.tileDepthOffset));
      return;
    }

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

    if (isTacticalGrid) {
      // Foreshortened slab tile with extruded front walls (tilted tactical map).
      return this.drawTacticalHex(
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
    this.drawTerrainFacetAccents(graphics, tile, baseColor, active);
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

  private drawTerrainFacetAccents(
    graphics: Phaser.GameObjects.Graphics,
    tile: HexTile,
    baseColor: number,
    active: boolean
  ) {
    const size = this.hexSize;
    const accentColor = this.terrainAccentColor(tile.terrain, baseColor);
    const innerPoints = getHexPoints(0, 0, size * 0.72);
    const outerPoints = getHexPoints(0, 0, size - 4);
    const alpha = active ? 0.34 : 0.12;

    graphics.lineStyle(1.25, this.mixColor(accentColor, 0xffffff, 0.25), alpha);
    graphics.beginPath();
    graphics.moveTo(innerPoints[0].x, innerPoints[0].y);
    for (let i = 1; i < innerPoints.length; i++) {
      graphics.lineTo(innerPoints[i].x, innerPoints[i].y);
    }
    graphics.closePath();
    graphics.strokePath();

    graphics.lineStyle(2.5, accentColor, active ? 0.28 : 0.1);
    graphics.beginPath();
    [0, 2, 4].forEach((index) => {
      const nextIndex = (index + 1) % outerPoints.length;
      graphics.moveTo(outerPoints[index].x, outerPoints[index].y);
      graphics.lineTo(outerPoints[nextIndex].x, outerPoints[nextIndex].y);
    });
    graphics.strokePath();
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

  /**
   * Build a static ambient backdrop centred on the board: a deep radial
   * vignette plus a soft breathing glow that gives the play surface depth.
   * Anchored in world space below every tile, so it pans/zooms with the board.
   */
  private createAmbientBackdrop() {
    // Board spans ~5 rings; cover generously so edges never show through.
    const reach = this.hexSize * 22;

    const backdrop = this.add.graphics();
    backdrop.setDepth(GameConfig.rendering.tileDepthOffset - 200);
    // Concentric rings fading from a lit centre to near-black at the edges.
    const steps = 26;
    for (let i = steps; i >= 0; i--) {
      const t = i / steps;
      const radius = reach * t;
      const color = this.mixColor(0x0b3a24, 0x020409, t);
      backdrop.fillStyle(color, 1);
      backdrop.fillCircle(0, 0, radius);
    }
    this.backdropGraphics = backdrop;

    // Decorative concentric guide rings echoing the hex board outline.
    backdrop.lineStyle(2, 0x14532d, 0.35);
    backdrop.strokeCircle(0, 0, this.hexSize * 9.5);
    backdrop.lineStyle(1.5, 0x166534, 0.25);
    backdrop.strokeCircle(0, 0, this.hexSize * 11);

    // A soft glow that gently pulses to keep the board feeling alive.
    const glow = this.add.graphics();
    glow.setDepth(GameConfig.rendering.tileDepthOffset - 150);
    const glowSteps = 14;
    for (let i = glowSteps; i >= 0; i--) {
      const t = i / glowSteps;
      glow.fillStyle(0x2dd4bf, 0.05 * (1 - t));
      glow.fillCircle(0, 0, this.hexSize * 8 * (1 - t) + this.hexSize);
    }
    glow.setAlpha(0.5);
    this.ambientGlow = glow;

    this.ambientTween = this.tweens.add({
      targets: glow,
      alpha: { from: 0.32, to: 0.7 },
      scale: { from: 0.96, to: 1.06 },
      duration: 4200,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
  }

  private mixColor(baseColor: number, targetColor: number, amount: number): number {
    return Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.IntegerToColor(baseColor),
      Phaser.Display.Color.IntegerToColor(targetColor),
      100,
      Math.round(amount * 100)
    ).color;
  }

  private terrainAccentColor(terrain: HexTile["terrain"], baseColor: number): number {
    switch (terrain) {
      case "lake":
        return 0x93c5fd;
      case "river":
        return 0x67e8f9;
      case "mountain":
        return 0xf8fafc;
      case "desert":
        return 0xfde68a;
      case "plains":
        return 0x99f6e4;
      case "forest":
        return 0x86efac;
      default:
        return this.mixColor(baseColor, 0xffffff, 0.3);
    }
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

  /**
   * Tactical tile: a foreshortened pointy-top hex extruded into a slab so the
   * board reads as a tilted 3D field. getHexPoints already returns the squashed
   * outline; we draw the camera-facing front walls below it, then the lit top
   * face. Per-tile depth sorting (by projected Y) makes near slabs occlude the
   * front walls of the row behind — the correct tilted-board look.
   *
   * Pointy-top corner indices (i*60°+30°): 0=lower-right, 1=bottom, 2=lower-left,
   * 3=upper-left, 4=top, 5=upper-right. The lower silhouette (2→1→0) faces us.
   */
  private drawTacticalHex(
    graphics: Phaser.GameObjects.Graphics,
    baseColor: number,
    strokeColor: number,
    strokeWidth: number,
    strokeAlpha: number
  ) {
    const points = getHexPoints(0, 0, this.hexSize);
    const wallHeight = this.hexSize * 0.42;

    // Soft contact shadow pooled under the slab grounds it on the board.
    graphics.fillStyle(0x020617, 0.28);
    graphics.beginPath();
    graphics.moveTo(points[2].x - 2, points[2].y + wallHeight);
    graphics.lineTo(points[1].x, points[1].y + wallHeight + 3);
    graphics.lineTo(points[0].x + 2, points[0].y + wallHeight);
    graphics.lineTo(points[0].x + 2, points[0].y + wallHeight + 4);
    graphics.lineTo(points[1].x, points[1].y + wallHeight + 7);
    graphics.lineTo(points[2].x - 2, points[2].y + wallHeight + 4);
    graphics.closePath();
    graphics.fillPath();

    // Front walls, split left/right so directional light gives them volume.
    const leftWall = this.mixColor(baseColor, 0x000000, 0.52);
    const rightWall = this.mixColor(baseColor, 0x000000, 0.36);
    graphics.fillStyle(leftWall, 1);
    this.fillExtrudedBand(graphics, [points[3], points[2], points[1]], wallHeight);
    graphics.fillStyle(rightWall, 1);
    this.fillExtrudedBand(graphics, [points[1], points[0], points[5]], wallHeight);

    // A darker base line along the very bottom edge seats the slab.
    graphics.lineStyle(1.5, this.mixColor(baseColor, 0x000000, 0.62), 0.6);
    graphics.beginPath();
    graphics.moveTo(points[2].x, points[2].y + wallHeight);
    graphics.lineTo(points[1].x, points[1].y + wallHeight);
    graphics.lineTo(points[0].x, points[0].y + wallHeight);
    graphics.strokePath();

    // Lit top face — top-lit gradient so the surface catches the light.
    graphics.fillGradientStyle(
      this.mixColor(baseColor, 0xffffff, 0.2),
      this.mixColor(baseColor, 0xffffff, 0.14),
      this.mixColor(baseColor, 0x000000, 0.14),
      this.mixColor(baseColor, 0x000000, 0.08),
      1,
      1,
      1,
      1
    );
    this.tracePolygon(graphics, points);
    graphics.fillPath();

    // Top-face outline for crisp tile separation.
    graphics.lineStyle(strokeWidth, strokeColor, strokeAlpha * 0.85);
    this.tracePolygon(graphics, points);
    graphics.strokePath();

    // Bright rim on the top-back edges sells the catch of light.
    graphics.lineStyle(1.6, this.mixColor(baseColor, 0xffffff, 0.4), 0.4);
    graphics.beginPath();
    graphics.moveTo(points[3].x, points[3].y);
    graphics.lineTo(points[4].x, points[4].y);
    graphics.lineTo(points[5].x, points[5].y);
    graphics.strokePath();
  }

  /**
   * Fill a wall quad strip by extruding a top edge (a run of outline points)
   * straight down by `height`. Used to build the camera-facing slab faces.
   */
  private fillExtrudedBand(
    graphics: Phaser.GameObjects.Graphics,
    topEdge: Phaser.Types.Math.Vector2Like[],
    height: number
  ) {
    graphics.beginPath();
    graphics.moveTo(topEdge[0].x as number, topEdge[0].y as number);
    for (let i = 1; i < topEdge.length; i++) {
      graphics.lineTo(topEdge[i].x as number, topEdge[i].y as number);
    }
    for (let i = topEdge.length - 1; i >= 0; i--) {
      graphics.lineTo(topEdge[i].x as number, (topEdge[i].y as number) + height);
    }
    graphics.closePath();
    graphics.fillPath();
  }

  /** Trace a closed polygon path from a list of points (no fill/stroke). */
  private tracePolygon(
    graphics: Phaser.GameObjects.Graphics,
    pts: Phaser.Types.Math.Vector2Like[]
  ) {
    graphics.beginPath();
    graphics.moveTo(pts[0].x as number, pts[0].y as number);
    for (let i = 1; i < pts.length; i++) {
      graphics.lineTo(pts[i].x as number, pts[i].y as number);
    }
    graphics.closePath();
  }

  /** On-screen footprint of a tactical hex top face (foreshortened bounding box). */
  private get hexTexWidth(): number {
    return Math.sqrt(3) * this.hexSize;
  }
  private get hexTexHeight(): number {
    return 2 * this.hexSize * TACTICAL_TILT_Y;
  }

  /**
   * Bake each loaded terrain artwork into a hex-masked, foreshortened tile
   * texture once at startup. We sample the dense centre of the isometric
   * diamond (avoiding its transparent corners / raised features), clip it to
   * the tactical hex silhouette, and bake in a soft top-light/bottom-shade so
   * the slab top reads with form. Supersampled so it stays crisp when zoomed.
   */
  private bakeTerrainTextures(): void {
    if (!isTacticalGrid) return;

    const ss = 4; // supersample factor for crispness up to max zoom
    const size = this.hexSize * ss;
    const w = Math.ceil(Math.sqrt(3) * size);
    const h = Math.ceil(2 * size * TACTICAL_TILT_Y);

    (Object.keys(terrainTextureSources) as TerrainType[]).forEach((terrain) => {
      let count = 0;
      terrainTextureSources[terrain].forEach((_url, variant) => {
        const tileKey = terrainTileKey(terrain, variant);
        if (this.textures.exists(tileKey)) {
          count++;
          return;
        }
        const srcKey = terrainSourceKey(terrain, variant);
        if (!this.textures.exists(srcKey)) return;
        const src = this.textures.get(srcKey).getSourceImage() as
          | HTMLImageElement
          | HTMLCanvasElement;
        const sw = (src as HTMLImageElement).naturalWidth || src.width;
        const sh = (src as HTMLImageElement).naturalHeight || src.height;
        if (!sw || !sh) return;

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Clip to the foreshortened hex silhouette.
        const pts = getHexPoints(w / 2, h / 2, size);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(pts[0].x as number, pts[0].y as number);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x as number, pts[i].y as number);
        }
        ctx.closePath();
        ctx.clip();

        // Cover the hex box with the central crop of the source art.
        const cropW = sw * TERRAIN_SAMPLE_SCALE;
        const cropH = sh * TERRAIN_SAMPLE_SCALE;
        const sx = (sw - cropW) / 2;
        const sy = (sh - cropH) / 2;
        const scale = Math.max(w / cropW, h / cropH);
        const dw = cropW * scale;
        const dh = cropH * scale;
        ctx.drawImage(src, sx, sy, cropW, cropH, (w - dw) / 2, (h - dh) / 2, dw, dh);

        // Directional light: lit toward the back, shaded toward the front edge.
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, "rgba(255,255,255,0.16)");
        grad.addColorStop(0.5, "rgba(255,255,255,0)");
        grad.addColorStop(1, "rgba(2,6,23,0.26)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();

        this.textures.addCanvas(tileKey, canvas);
        count++;
      });
      this.terrainVariantCounts[terrain] = count;
    });
  }

  /** Pick a stable per-tile texture variant so same-terrain tiles vary. */
  private pickTerrainVariant(tile: HexTile): number {
    const count = this.terrainVariantCounts[tile.terrain] ?? 0;
    if (count <= 1) return 0;
    return Math.floor(this.tileNoise(tile, 991) * count) % count;
  }

  /**
   * Redraw the shared hover/select overlay: a bold gold ring for the selected
   * tile and a soft white ring for the hovered one, in world space above the
   * textured slabs.
   */
  private updateHighlight(): void {
    const g = this.highlightGraphics;
    if (!g) return;
    g.clear();

    const drawRing = (coords: CubeCoords, selected: boolean) => {
      const pixel = cubeToPixel(coords, this.hexSize);
      const pts = getHexPoints(pixel.x, pixel.y, this.hexSize + (selected ? 3 : 2));
      g.lineStyle(8, selected ? 0xfacc15 : 0xffffff, selected ? 0.42 : 0.18);
      this.tracePolygon(g, pts);
      g.strokePath();
      g.lineStyle(selected ? 3 : 2, selected ? 0xffff00 : 0xffffff, selected ? 1 : 0.7);
      this.tracePolygon(g, pts);
      g.strokePath();
    };

    if (
      this.hoveredTile &&
      !(this.selectedTile && coordsEqual(this.hoveredTile, this.selectedTile))
    ) {
      drawRing(this.hoveredTile, false);
    }
    if (this.selectedTile) {
      drawRing(this.selectedTile, true);
    }
  }

  private renderGrid() {
    if (!this.gridGraphics) {
      return;
    }

    this.gridGraphics.clear();
    this.gridGraphics.lineStyle(1.5, 0xe2e8f0, isIsometricGrid || isTacticalGrid ? 0.3 : 0.42);
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

    // Tactical tiles use the shared highlight overlay (the photo top stays put).
    if (isTacticalGrid) {
      this.selectedTile = coords;
      this.updateHighlight();
      this.onTileClick?.(coords);
      return;
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

  private clearTiles() {
    this.tileFlipTweens.forEach((tween) => tween.stop());
    this.tileFlipTweens.clear();

    this.tiles.forEach((tile) => tile.destroy());
    this.tiles.clear();

    this.tileTerrainSprites.forEach((sprite) => sprite.destroy());
    this.tileTerrainSprites.clear();

    this.tileTerrainIcons.forEach((icon) => icon.destroy());
    this.tileTerrainIcons.clear();

    this.playerTokens.forEach((token) => this.destroyPlayerToken(token));
    this.playerTokens.clear();
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

  /**
   * Keep a tile comfortably on-screen for keyboard navigation: only pan the
   * camera when the tile drifts into the outer margin of the viewport, so the
   * board doesn't jump on every cursor step.
   */
  public ensureTileVisible(coords: CubeCoords) {
    const pixel = cubeToPixel(coords, this.hexSize);
    const view = this.cameras.main.worldView;
    const marginX = view.width * 0.18;
    const marginY = view.height * 0.18;
    const inside =
      pixel.x > view.x + marginX &&
      pixel.x < view.right - marginX &&
      pixel.y > view.y + marginY &&
      pixel.y < view.bottom - marginY;
    if (!inside) {
      this.cameras.main.centerOn(pixel.x, pixel.y);
    }
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

  /** Floating combat/heal number above a tile (e.g. "-3", "+2"). */
  public triggerFloatingNumber(coords: CubeCoords, text: string, color?: string): void {
    if (!this.animationSystem) return;
    this.animationSystem.createFloatingNumber(coords, text, color);
  }

  /** Combat clash impact (shockwave + sparks) with a brief camera shake. */
  public triggerCombatClash(coords: CubeCoords): void {
    if (!this.animationSystem) return;
    this.animationSystem.createCombatClash(coords);
    this.cameras.main.shake(180, 0.006);
  }

  /**
   * Flip a tile onto its "depleted" face when it becomes non-harvestable.
   * The tile (slab + photo top) compresses to its edge — at which point the
   * spent/dimmed face is revealed — then springs back, so the change of state
   * reads as the tile physically turning over. By the time this runs the tile
   * has already re-rendered dimmed; we briefly show the lit face during the
   * first half so the active→depleted transition is visible.
   */
  public triggerTileFlip(coords: CubeCoords): void {
    if (!isTacticalGrid) return;
    const key = coordsToKey(coords);
    const base = this.tiles.get(key);
    if (!base) return;
    const sprite = this.tileTerrainSprites.get(key);

    // Cancel any in-flight flip for this tile.
    this.tileFlipTweens.get(key)?.stop();
    this.tileFlipTweens.delete(key);

    const baseScaleY = base.scaleY || 1;
    const spriteScaleY = sprite ? sprite.scaleY : 1;
    const proxy = { f: 1 };

    const alive = () => !!base.scene; // guard against destroy mid-flip

    // First half: show the lit (active) face and flip down to the edge.
    if (sprite) { sprite.clearTint(); sprite.setAlpha(1); }
    const tween = this.tweens.add({
      targets: proxy,
      f: 0,
      duration: 150,
      ease: 'Quad.easeIn',
      onUpdate: () => {
        if (!alive()) return;
        base.scaleY = baseScaleY * proxy.f;
        if (sprite && sprite.scene) sprite.scaleY = spriteScaleY * proxy.f;
      },
      onComplete: () => {
        if (!alive()) { this.tileFlipTweens.delete(key); return; }
        // Edge reached — reveal the depleted face, then spring back up.
        if (sprite && sprite.scene) { sprite.setTint(INACTIVE_TINT); sprite.setAlpha(INACTIVE_ALPHA); }
        const back = this.tweens.add({
          targets: proxy,
          f: 1,
          duration: 220,
          ease: 'Back.easeOut',
          onUpdate: () => {
            if (!alive()) return;
            base.scaleY = baseScaleY * proxy.f;
            if (sprite && sprite.scene) sprite.scaleY = spriteScaleY * proxy.f;
          },
          onComplete: () => {
            if (alive()) {
              base.scaleY = baseScaleY;
              if (sprite && sprite.scene) sprite.scaleY = spriteScaleY;
            }
            this.tileFlipTweens.delete(key);
          },
        });
        this.tileFlipTweens.set(key, back);
      },
    });
    this.tileFlipTweens.set(key, tween);
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

    // Convert world -> canvas-screen position. `worldView` is the world rect the
    // camera currently shows (top-left already accounts for zoom-around-centre),
    // so this stays correct at any zoom level — unlike `(world - scroll) * zoom`,
    // which is only right at zoom = 1 and drifts as you zoom in/out.
    const screenX = (worldX - camera.worldView.x) * camera.zoom;
    const screenY = (worldY - camera.worldView.y) * camera.zoom;

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
    if (this.highlightGraphics) {
      this.highlightGraphics.destroy();
      this.highlightGraphics = undefined;
    }
    this.hoveredTile = null;

    if (this.ambientTween) {
      this.ambientTween.stop();
      this.ambientTween = undefined;
    }
    if (this.ambientGlow) {
      this.ambientGlow.destroy();
      this.ambientGlow = undefined;
    }
    if (this.backdropGraphics) {
      this.backdropGraphics.destroy();
      this.backdropGraphics = undefined;
    }

    this.playerLastCoords.clear();

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
