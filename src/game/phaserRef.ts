import Phaser from "phaser";

let _game: Phaser.Game | undefined;

export const setPhaserGame = (game: Phaser.Game): void => {
  _game = game;
};

export const getPhaserGame = (): Phaser.Game | undefined => _game;

export const clearPhaserGame = (): void => {
  _game = undefined;
};
