// ****************************** GLOBAL VARIABLES ****************************** //
const COLORS = {
  blue: mod.CreateVector(0.18, 0.11, 1),
  red: mod.CreateVector(1, 0.11, 0.11),
  gray: mod.CreateVector(0.3, 0.3, 0.3),
  white: mod.CreateVector(1, 1, 1),
  black: mod.CreateVector(0, 0, 0),
};

const POINTS_TO_WIN = 30;
const PLAYERS: { [id: number]: Player } = {};
var SCOREBOARD: Scoreboard;
// ****************************** GAME LOGIC ****************************** //
var GameStarted: boolean = false;
export async function OnGameModeStarted() {
  SCOREBOARD = new Scoreboard();
  const gameCountdown = new GameCountdown();
  gameCountdown.hide();
  mod.SetSpawnMode(mod.SpawnModes.AutoSpawn);
  mod.EnableUIInputMode(true);
  while (!arePlayersReady()) {
    await mod.Wait(1);
  }

  gameCountdown.show();
  await gameCountdown.beginCountdown();
  gameCountdown.hide();
  GameStarted = true;
  mod.EnableUIInputMode(false);
  enableAllPlayers();
}

function enableAllPlayers() {
  const players = Object.values(PLAYERS);
  players.forEach((player) => {
    player.enable();
    player.ui.hideReadyButton();
    mod.EnableUIInputMode(false, player.modPlayer);
  });
}

function arePlayersReady() {
  const players = Object.values(PLAYERS);
  let totalHumans = 0;
  let totalReady = 0;
  players.forEach((player) => {
    if (player.isHuman) {
      totalHumans++;
      if (player.isReady) {
        totalReady++;
      }
    }
  });
  if (totalHumans === 0) return false;
  players.forEach((player) => {
    if (player.isHuman) {
      player.ui.updateReadyLabel(totalReady, totalHumans);
    }
  });

  return totalReady >= totalHumans;
}

export function OnPlayerJoinGame(modPlayer: mod.Player) {
  const id = mod.GetObjId(modPlayer);
  const player = new Player(modPlayer);
  if (!PLAYERS[id]) {
    PLAYERS[id] = player;
    player.setTeam(0);
  }
  if (!GameStarted) {
    player.disable();
  } else {
    player.enable();
  }
}

export function OnPlayerDeployed(modPlayer: mod.Player) {
  const player = getPlayerFromModPlayer(modPlayer);
  player.applySniperLoadout();
  if (!GameStarted) {
    player.disable();
  } else {
    player.enable();
  }
}

export function OnPlayerDied(
  eventPlayer: mod.Player,
  eventOtherPlayer: mod.Player,
  eventDeathType: mod.DeathType,
  eventWeaponUnlock: mod.WeaponUnlock
) {
  const player = getPlayerFromModPlayer(eventPlayer);
  player.stats.deaths++;
  SCOREBOARD.updatePlayerScoreboard(player);
}

export function OnPlayerEarnedKill(
  eventPlayer: mod.Player,
  eventOtherPlayer: mod.Player,
  eventDeathType: mod.DeathType,
  eventWeaponUnlock: mod.WeaponUnlock
) {
  const player = getPlayerFromModPlayer(eventPlayer);
  player.stats.kills++;
  player.stats.score++;
  if (mod.EventDeathTypeCompare(eventDeathType, mod.PlayerDeathTypes.Headshot)) {
    player.stats.headshots++;
    player.stats.score++;
  } else if (mod.EventDeathTypeCompare(eventDeathType, mod.PlayerDeathTypes.Weapon) === false) {
    mod.DisplayNotificationMessage(mod.Message(mod.stringkeys.killed_player_with_knife, eventOtherPlayer), eventPlayer);
  }
  SCOREBOARD.updatePlayerScoreboard(player);
  const sortedPlayers = Object.values(PLAYERS).sort((a, b) => b.stats.score - a.stats.score); // highest score first
  sortedPlayers.forEach((p: Player, index) => {
    p.stats.placement = index + 1;
  });
  const bestPlayer = sortedPlayers[0];
  // update player ui to show their score compared to the best player in the lobby (that isn't them)
  Object.values(PLAYERS).forEach((p: Player) => {
    if (bestPlayer.equals(p)) {
      p.updateUI(sortedPlayers[1], POINTS_TO_WIN);
    } else {
      p.updateUI(bestPlayer, POINTS_TO_WIN);
    }
  });

  if (player.stats.score >= POINTS_TO_WIN) {
    mod.EndGameMode(player.modPlayer);
  }
}

export function OnPlayerEarnedKillAssist(eventPlayer: mod.Player, eventOtherPlayer: mod.Player) {
  const player = getPlayerFromModPlayer(eventPlayer);
  player.stats.assists++;
  SCOREBOARD.updatePlayerScoreboard(player);
}

export function OnPlayerUIButtonEvent(
  eventPlayer: mod.Player,
  eventUIWidget: mod.UIWidget,
  eventUIButtonEvent: mod.UIButtonEvent
) {
  const player = getPlayerFromModPlayer(eventPlayer);
  const buttonName = mod.GetUIWidgetName(eventUIWidget);
  mod.DisplayNotificationMessage(
    player.isReady ? mod.Message(mod.stringkeys.ui_not_ready) : mod.Message(mod.stringkeys.ui_ready), player.modPlayer
  );
  if (buttonName.includes("ui_ready_button")) {
    if (eventUIButtonEvent === mod.UIButtonEvent.ButtonDown) {
      player.toggleReady();
    }
  }
}

// ****************************** SCOREBOARD ****************************** //
class Scoreboard {
  constructor() {
    mod.SetScoreboardType(mod.ScoreboardType.CustomFFA);
    mod.SetScoreboardColumnNames(
      mod.stringkeys.scoreboard_column_1, // Score
      mod.stringkeys.scoreboard_column_2, // Kills
      mod.stringkeys.scoreboard_column_3, // Headshots
      mod.stringkeys.scoreboard_column_4, // Assists
      mod.stringkeys.scoreboard_column_5 // Deaths
    );
    const COLUMN_WIDTH = 12;
    mod.SetScoreboardColumnWidths(COLUMN_WIDTH, COLUMN_WIDTH, COLUMN_WIDTH, COLUMN_WIDTH, COLUMN_WIDTH);
  }

  updatePlayerScoreboard(player: Player) {
    mod.SetScoreboardPlayerValues(
      player.modPlayer,
      player.stats.score,
      player.stats.kills,
      player.stats.headshots,
      player.stats.assists,
      player.stats.deaths
    );
  }
}

// ****************************** PLAYER ****************************** //
interface PlayerStats {
  score: number;
  kills: number;
  headshots: number;
  assists: number;
  revives: number;
  deaths: number;
  placement: number;
}

class Player {
  id: number;
  modPlayer: mod.Player;
  stats: PlayerStats;
  team: mod.Team;
  ui: PlayerUI;
  isHuman: boolean;
  isAI: boolean;
  isReady: boolean;

  constructor(modPlayer: mod.Player) {
    this.id = mod.GetObjId(modPlayer);
    this.modPlayer = modPlayer;
    this.team = mod.GetTeam(modPlayer);
    this.stats = {
      score: 0,
      kills: 0,
      headshots: 0,
      assists: 0,
      revives: 0,
      deaths: 0,
      placement: 1,
    };
    this.ui = new PlayerUI(modPlayer);
    const isAI = mod.GetSoldierState(modPlayer, mod.SoldierStateBool.IsAISoldier);
    this.isHuman = !isAI;
    this.isAI = isAI;
    if (isAI) {
      this.isReady = true;
    } else {
      this.isReady = false;
    }
  }

  updateUI(bestEnemy: Player, targetScore: number) {
    this.ui.updateScores(this, bestEnemy, targetScore);
  }

  equals(otherPlayer: Player) {
    return this.id === otherPlayer.id;
  }

  applySniperLoadout() {
    mod.AddEquipment(this.modPlayer, mod.Weapons.Sniper_M2010_ESR, mod.InventorySlots.PrimaryWeapon);
    mod.ForceSwitchInventory(this.modPlayer, mod.InventorySlots.PrimaryWeapon);
    mod.RemoveEquipment(this.modPlayer, mod.InventorySlots.ClassGadget);
    mod.RemoveEquipment(this.modPlayer, mod.InventorySlots.GadgetOne);
    mod.RemoveEquipment(this.modPlayer, mod.InventorySlots.GadgetTwo);
    mod.RemoveEquipment(this.modPlayer, mod.InventorySlots.MiscGadget);
    mod.RemoveEquipment(this.modPlayer, mod.InventorySlots.SecondaryWeapon);
    mod.RemoveEquipment(this.modPlayer, mod.InventorySlots.Throwable);
    mod.AddEquipment(this.modPlayer, mod.Gadgets.Throwable_Throwing_Knife, mod.InventorySlots.Throwable);
    mod.AddEquipment(this.modPlayer, mod.Gadgets.Throwable_Throwing_Knife, mod.InventorySlots.Throwable);
  }

  toggleReady() {
    this.isReady = !this.isReady;
    this.ui.toggleReady(this);
  }

  disable() {
    if (this.isAI) {
      mod.AIIdleBehavior(this.modPlayer);
    } else {
      mod.EnableAllInputRestrictions(this.modPlayer, true);
    }
  }

  enable() {
    if (this.isAI) {
      mod.AIBattlefieldBehavior(this.modPlayer);
    } else {
      mod.EnableAllInputRestrictions(this.modPlayer, false);
    }
  }

  setTeam(teamId: number): void;
  setTeam(team: mod.Team): void;
  setTeam(team?: number | mod.Team): void {
    if (typeof team === "number") {
        this.team = mod.GetTeam(team)
        mod.SetTeam(this.modPlayer, this.team);
    }
    else if (team) {
        this.team = team;
        mod.SetTeam(this.modPlayer, this.team);
    }
  }
}

class PlayerUI {
  SCORE_BAR_WIDTH: number = 400;
  rootWidget?: mod.UIWidget;
  progressBarWidget?: mod.UIWidget;
  playerIndicatorWidget?: mod.UIWidget;
  playerPlacementWidget?: mod.UIWidget;
  enemyIndicatorWidget?: mod.UIWidget;
  enemyPlacementWidget?: mod.UIWidget;
  readyButtonContainer?: mod.UIWidget;
  readyButton?: mod.UIWidget;
  readyButtonLabel?: mod.UIWidget;

  constructor(player: mod.Player) {
    const rootName: string = "ui_root_" + player;
    const playerPlacementName: string = "ui_player_placement_" + player;
    const enemyPlacementName: string = "ui_enemy_placement_" + player;
    const progressBarName: string = "ui_progress_bar_" + player;
    const playerIndicatorName: string = "ui_player_indicator_" + player;
    const enemyIndicatorName: string = "ui_enemy_indicator_" + player;
    const readyButtonContainerName: string = "ui_ready_button_container_" + player;
    const readyButtonName: string = "ui_ready_button_" + player;
    const readyButtonLabelName: string = "ui_ready_button_label_" + player;

    mod.AddUIContainer(
      rootName, // name
      mod.CreateVector(0, 100, 0), // position
      mod.CreateVector(this.SCORE_BAR_WIDTH, 200, 0), // size
      mod.UIAnchor.TopCenter, // anchor
      mod.GetUIRoot(), // parent
      true, // visible
      0, // padding
      COLORS.black, // bgColor
      0.8, // bgAlpha
      mod.UIBgFill.None, // bgFill
      player // player
    );
    this.rootWidget = mod.FindUIWidgetWithName(rootName);

    if (!this.rootWidget) return;

    mod.AddUIText(
      playerPlacementName, // name
      mod.CreateVector(0, 0, 0), // position
      mod.CreateVector(100, 50, 0), // size
      mod.UIAnchor.TopLeft, // anchor
      this.rootWidget, // parent
      true, // visible
      1, // padding
      COLORS.blue, // bgColor
      0.1, // bgAlpha
      mod.UIBgFill.Blur, // bgFill
      mod.Message(mod.stringkeys.text_num_st_user, 1, player), // message
      24, // textSize
      COLORS.blue, // textColor
      1, // textAlpha
      mod.UIAnchor.CenterLeft, // textAnchor
      player
    );
    this.playerPlacementWidget = mod.FindUIWidgetWithName(playerPlacementName);

    mod.AddUIText(
      enemyPlacementName, // name
      mod.CreateVector(0, 0, 0), // position
      mod.CreateVector(100, 50, 0), // size
      mod.UIAnchor.TopRight, // anchor
      this.rootWidget, // parent
      true, // visible
      1, // padding
      COLORS.red, // bgColor
      0.1, // bgAlpha
      mod.UIBgFill.Blur, // bgFill
      mod.Message(mod.stringkeys.text_num_nd_user, 2, player), // message
      24, // textSize
      COLORS.red, // textColor
      1, // textAlpha
      mod.UIAnchor.CenterRight, // textAnchor
      player
    );
    this.enemyPlacementWidget = mod.FindUIWidgetWithName(enemyPlacementName);

    mod.AddUIContainer(
      progressBarName, // name
      mod.CreateVector(0, 0, 0), // position
      mod.CreateVector(this.SCORE_BAR_WIDTH, 50, 0), // size
      mod.UIAnchor.Center, // anchor
      this.rootWidget, // parent
      true, // visible
      0, // padding
      COLORS.gray, // bgColor
      0.3, // bgAlpha
      mod.UIBgFill.Blur, // bgFill
      player // player
    );
    this.progressBarWidget = mod.FindUIWidgetWithName(progressBarName);

    if (!this.progressBarWidget) return;

    mod.AddUIImage(
      playerIndicatorName, // name
      mod.CreateVector(0, 0, 0), // position
      mod.CreateVector(50, 50, 0), // size
      mod.UIAnchor.CenterLeft, // anchor
      this.progressBarWidget, //parent
      true, // visible
      0, // padding
      mod.CreateVector(0, 0, 0), //bgColor
      0, // bgAlpha
      mod.UIBgFill.None, // bgFill
      mod.UIImageType.CrownSolid, // imageType
      COLORS.blue, // imageColor
      1, // imageAlpha
      player
    );
    this.playerIndicatorWidget = mod.FindUIWidgetWithName(playerIndicatorName);

    mod.AddUIImage(
      enemyIndicatorName, // name
      mod.CreateVector(0, 0, 0), // position
      mod.CreateVector(50, 50, 0), // size
      mod.UIAnchor.CenterLeft, // anchor
      this.progressBarWidget, //parent
      true, // visible
      0, // padding
      mod.CreateVector(0, 0, 0), //bgColor
      0, // bgAlpha
      mod.UIBgFill.None, // bgFill
      mod.UIImageType.CrownSolid, // imageType
      COLORS.red, // imageColor
      1, // imageAlpha
      player
    );
    this.playerIndicatorWidget = mod.FindUIWidgetWithName(enemyIndicatorName);

    mod.AddUIContainer(
        readyButtonContainerName, // name
        mod.CreateVector(0, 0, 0), // position
        mod.CreateVector(350, 100, 0), // size
        mod.UIAnchor.Center, // anchor
        mod.GetUIRoot(), // parent
        true, // visible
        0, // padding
        COLORS.black, // bgColor
        0, // bgAlpha
        mod.UIBgFill.None, // bgFill
        player // player
    );
    this.readyButtonContainer = mod.FindUIWidgetWithName(readyButtonContainerName);
    
    if (!this.readyButtonContainer) return;

    mod.AddUIButton(
      readyButtonName, // name
      mod.CreateVector(0, 0, 0), // position
      mod.CreateVector(300, 60, 0), // size
      mod.UIAnchor.Center, // anchor
      this.readyButtonContainer, // parent
      true, // visible
      5, // padding
      COLORS.gray, // bgColor
      0.8, // bgAlpha
      mod.UIBgFill.OutlineThick, // bgFill
      true, // Enabled
      COLORS.gray, // baseColor green
      1.0, // baseAlpha
      mod.CreateVector(0.2, 0.2, 0.2), // disabledColor Gray
      0.5, // disabledAlpha
      mod.CreateVector(0.2, 0.7, 0.2), // pressedColor Bright green
      1.0, // pressedAlpha
      mod.CreateVector(0.4, 0.7, 0.4), // hoverColor Light green
      1.0, // hoverAlpha
      mod.CreateVector(0.5, 0.8, 0.5), // focusColor Lighter green focused
      1.0, // focusAlpha
      player
    );
    this.readyButton = mod.FindUIWidgetWithName(readyButtonName);

    // Add button label
    mod.AddUIText(
      readyButtonLabelName, // name
      mod.CreateVector(0, 0, 0), // position
      mod.CreateVector(300, 60, 0), // size
      mod.UIAnchor.Center, // anchor
      this.readyButtonContainer, // parent
      true, // visible
      0, // padding
      COLORS.black, // bgColor
      0.5, // bgAlpha
      mod.UIBgFill.Blur, // bgFill
      mod.Message(mod.stringkeys.ui_button_label_ready, 0, 1), // message
      24, // textSize
      COLORS.white, // textColor
      0.8, // textAlpha
      mod.UIAnchor.Center, // textAnchor
      player
    );
    this.readyButtonLabel = mod.FindUIWidgetWithName(readyButtonLabelName);
  }

  updateScores(player: Player, enemy: Player, targetScore: number) {
    const playerScore = player.stats.score;
    const enemyScore = enemy.stats.score;
    if (this.playerIndicatorWidget) {
      const progress = (this.SCORE_BAR_WIDTH * playerScore) / targetScore;
      mod.SetUIWidgetPosition(this.playerIndicatorWidget, mod.CreateVector(progress, 0, 0));
    }
    if (this.enemyIndicatorWidget) {
      const progress = (this.SCORE_BAR_WIDTH * enemyScore) / targetScore;
      mod.SetUIWidgetPosition(this.enemyIndicatorWidget, mod.CreateVector(progress, 0, 0));
    }
    if (this.playerPlacementWidget && this.enemyPlacementWidget) {
      if (player.stats.placement === 1) {
        mod.SetUITextLabel(
          this.playerPlacementWidget,
          mod.Message(mod.stringkeys.text_num_st_user, 1, player.modPlayer)
        );
        mod.SetUITextLabel(this.enemyPlacementWidget, mod.Message(mod.stringkeys.text_num_nd_user, 2, enemy.modPlayer));
      } else if (player.stats.placement === 2) {
        mod.SetUITextLabel(
          this.playerPlacementWidget,
          mod.Message(mod.stringkeys.text_num_nd_user, 2, player.modPlayer)
        );
        mod.SetUITextLabel(this.enemyPlacementWidget, mod.Message(mod.stringkeys.text_num_st_user, 1, enemy.modPlayer));
      } else if (player.stats.placement === 3) {
        mod.SetUITextLabel(
          this.playerPlacementWidget,
          mod.Message(mod.stringkeys.text_num_rd_user, 3, player.modPlayer)
        );
        mod.SetUITextLabel(this.enemyPlacementWidget, mod.Message(mod.stringkeys.text_num_st_user, 1, enemy.modPlayer));
      } else {
        mod.SetUITextLabel(
          this.playerPlacementWidget,
          mod.Message(mod.stringkeys.text_num_th_user, player.stats.placement, player.modPlayer)
        );
        mod.SetUITextLabel(this.enemyPlacementWidget, mod.Message(mod.stringkeys.text_num_st_user, 1, enemy.modPlayer));
      }
    }
  }

  toggleReady(player: Player) {
    if (this.readyButton) {
      if (player.isReady) {
        mod.SetUIButtonColorBase(this.readyButton, mod.CreateVector(0.3, 0.6, 0.3)); // green
      } else {
        mod.SetUIButtonColorBase(this.readyButton, COLORS.gray);
      }
    }
  }

  updateReadyLabel(numReady: number = 0, numTotal: number = 1) {
    if (this.readyButtonLabel) {
      mod.SetUITextLabel(this.readyButtonLabel, mod.Message(mod.stringkeys.ui_button_label_ready, numReady, numTotal));
    }
  }

  hideReadyButton() {
    if (this.readyButtonLabel) mod.SetUIWidgetVisible(this.readyButtonLabel, false);
    if (this.readyButton) mod.SetUIWidgetVisible(this.readyButton, false);
    if (this.readyButtonContainer) mod.SetUIWidgetVisible(this.readyButtonContainer, false);
  }
}

function getPlayerFromModPlayer(modPlayer: mod.Player) {
  const id = mod.GetObjId(modPlayer);
  return PLAYERS[id];
}

// ****************************** GAME COUNTDOWN ****************************** //
class GameCountdown {
  rootContainer?: mod.UIWidget;
  countdownText?: mod.UIWidget;
  countdownNumber: number = 5;

  constructor() {
    const rootName: string = "countdown_root_container";
    const countdownTextName: string = "countdown_text";

    mod.AddUIContainer(
      rootName, // name
      mod.CreateVector(0, 40, 0), // position
      mod.CreateVector(160, 60, 0), // size
      mod.UIAnchor.TopCenter, // anchor
      mod.GetUIRoot(), // parent
      false, // visible
      0, // padding
      COLORS.black, // bgColor
      0.8, // bgAlpha
      mod.UIBgFill.None // bgFill
    );
    this.rootContainer = mod.FindUIWidgetWithName(rootName);

    if (!this.rootContainer) return;

    mod.AddUIText(
      countdownTextName, // name
      mod.CreateVector(0, 0, 0), // position
      mod.CreateVector(150, 50, 0), // size
      mod.UIAnchor.Center, // anchor
      this.rootContainer, // parent
      false, // visible
      2, // padding
      COLORS.black, // bgColor
      0.5, // bgAlpha
      mod.UIBgFill.Blur, // bgFill
      mod.Message(mod.stringkeys.ui_countdown_label, this.countdownNumber), // message
      32, // textSize
      COLORS.white, // textColor
      1, // textAlpha
      mod.UIAnchor.Center // textAnchor
    );
    this.countdownText = mod.FindUIWidgetWithName(countdownTextName);
  }

  async beginCountdown() {
    if (this.countdownText) {
      let timeRemaining = this.countdownNumber;
      while (timeRemaining > 0) {
        mod.SetUITextLabel(this.countdownText, mod.Message(mod.stringkeys.ui_countdown_label, timeRemaining));
        timeRemaining--;
        await mod.Wait(1);
      }
    }
    return Promise.resolve();
  }

  show() {
    if (this.rootContainer) mod.SetUIWidgetVisible(this.rootContainer, true);
    if (this.countdownText) mod.SetUIWidgetVisible(this.countdownText, true);
  }

  hide() {
    if (this.rootContainer) mod.SetUIWidgetVisible(this.rootContainer, false);
    if (this.countdownText) mod.SetUIWidgetVisible(this.countdownText, false);
  }
}
