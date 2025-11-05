const POINTS_TO_WIN = 50;
const UI_PROGRESS_BAR_WIDTH = 300;
const SCORES = {
  team1: 0,
  team2: 0,
};
const PLAYER_STATS: { [key: number]: PlayerStats } = {};

createUIWidgets();

export function OnGameModeStarted() {
  mod.SetGameModeTargetScore(POINTS_TO_WIN);
  mod.SetSpawnMode(mod.SpawnModes.Deploy);
  initScoreboard();
}

const initScoreboard = () => {
  SCORES.team1 = 0;
  SCORES.team2 = 0;
  mod.SetScoreboardType(mod.ScoreboardType.CustomTwoTeams);
  mod.SetScoreboardColumnNames(
    mod.Message(mod.stringkeys.score),
    mod.Message(mod.stringkeys.kills),
    mod.Message(mod.stringkeys.headshots),
    mod.Message(mod.stringkeys.revives)
  );
  const columnWidth = 10;
  mod.SetScoreboardColumnWidths(columnWidth, columnWidth, columnWidth, columnWidth);
  updateScoreBoardTotal();
};

function updateScoreBoardTotal() {
  const score1 = SCORES.team1;
  const score2 = SCORES.team2;
  mod.SetScoreboardHeader(
    mod.Message(mod.stringkeys.team1Score, score1),
    mod.Message(mod.stringkeys.team2Score, score2)
  );
  updateUIScoreBars();
}

export function OnPlayerJoinGame(eventPlayer: mod.Player) {
  //Initialise players variables
  const id = mod.GetObjId(eventPlayer);
  const stats = new PlayerStats(id);
  PLAYER_STATS[id] = stats;

  updatePlayerScoreBoard(eventPlayer);
}

function updatePlayerScoreBoard(player: mod.Player) {
  const id = mod.GetObjId(player);
  const stats = PLAYER_STATS[id];
  mod.SetScoreboardPlayerValues(player, stats.score, stats.kills, stats.headshots, stats.revives);
}

function formatScoreDisplay(score: number): mod.Message {
  const digit1 = score % 10;
  const digit10 = Math.floor(score / 10);

  return mod.Message(mod.stringkeys.scoreFormatted, digit10, digit1);
}

function updateUIScoreBars() {
  const team1Score = SCORES.team1;
  const team2Score = SCORES.team2;

  const friendlyProgressWidth = (team1Score / POINTS_TO_WIN) * UI_PROGRESS_BAR_WIDTH;
  mod.SetUIWidgetSize(
    mod.FindUIWidgetWithName(mod.stringkeys.friendlyScorebarName),
    mod.CreateVector(friendlyProgressWidth, 15, 0)
  );
  const enemyProgressWidth = (team2Score / POINTS_TO_WIN) * UI_PROGRESS_BAR_WIDTH;
  mod.SetUIWidgetSize(
    mod.FindUIWidgetWithName(mod.stringkeys.enemyScorebarName),
    mod.CreateVector(enemyProgressWidth, 15, 0)
  );

  mod.SetUITextLabel(mod.FindUIWidgetWithName(mod.stringkeys.friendlyScoreName), formatScoreDisplay(team1Score));
  mod.SetUITextLabel(mod.FindUIWidgetWithName(mod.stringkeys.enemyScoreName), formatScoreDisplay(team2Score));
}

export function OnPlayerEarnedKill(
  eventPlayer: mod.Player,
  eventOtherPlayer: mod.Player,
  eventDeathType: mod.DeathType,
  eventWeaponUnlock: mod.WeaponUnlock
) {
  const playerId = mod.GetObjId(eventPlayer);
  const stats = PLAYER_STATS[playerId];
  const team = mod.GetTeam(eventPlayer);
  const isHeadshot = mod.EventDeathTypeCompare(eventDeathType, mod.PlayerDeathTypes.Headshot);
  let points = 1;
  if (isHeadshot) {
    points++;
    stats.headshots++;
  }
  // const newTeamScore = mod.GetGameModeScore(team) + points;
  // mod.SetGameModeScore(team, newTeamScore);
  const isTeam1 = mod.Equals(team, mod.GetTeam(1));
  let teamTotal: number;
  if (isTeam1) {
    SCORES.team1 += points;
    teamTotal = SCORES.team1;
  } else {
    SCORES.team2 += points;
    teamTotal = SCORES.team2;
  }
  stats.kills++;
  stats.score += points;
  updateScoreBoardTotal();
  updatePlayerScoreBoard(eventPlayer);

  if (teamTotal >= POINTS_TO_WIN) {
    mod.EndGameMode(team);
  }
  // if (newTeamScore >= mod.GetTargetScore()) {
  //   mod.EndGameMode(team);
  // }
}

export function OnPlayerEarnedKillAssist(eventPlayer: mod.Player, eventOtherPlayer: mod.Player) {
  const playerId = mod.GetObjId(eventPlayer);
  const stats = PLAYER_STATS[playerId];
  stats.assists++;
  updatePlayerScoreBoard(eventPlayer);
}

export function OnRevived(eventPlayer: mod.Player, eventOtherPlayer: mod.Player) {
  const playerId = mod.GetObjId(eventOtherPlayer);
  logMessage(mod.Message(mod.stringkeys.placeholder, playerId));
  const stats = PLAYER_STATS[playerId];
  stats.revives++;
  updatePlayerScoreBoard(eventOtherPlayer);
}

var spawnerNumber = 0;
export function OnPlayerDeployed(eventPlayer: mod.Player) {
  try {
    const allPlayers = mod.AllPlayers();
    const numPlayers = mod.CountOf(allPlayers);
    logMessage(mod.Message(mod.stringkeys.numPlayers, numPlayers));
    const playerPositions: mod.Vector[] = [];
    const minDistances: number[] = [];

    for (let i = 0; i < numPlayers; i++) {
      const player = mod.ValueInArray(allPlayers, i) as mod.Player;
      playerPositions.push(mod.GetObjectPosition(player));
    }

    const numSpawners = 10;
    for (let i = 0; i < numSpawners; i++) {
      spawnerNumber = i;
      const spawner = mod.GetSpawner(i);
      const spawnerPosition = mod.GetObjectPosition(spawner);
      minDistances.push(Number.POSITIVE_INFINITY);
      for (let j = 0; j < numPlayers; j++) {
        minDistances[i] = Math.min(minDistances[i], mod.DistanceBetween(spawnerPosition, playerPositions[j]));
      }
    }
    const maxDistance = Math.max(...minDistances);
    const minDistance = Math.min(...minDistances);
    logError(mod.Message(mod.stringkeys.minMaxDistances, minDistance, maxDistance));
    const bestSpawnerIndex = minDistances.indexOf(Math.max(...minDistances));
    spawnerNumber = bestSpawnerIndex;
    mod.SpawnPlayerFromSpawnPoint(eventPlayer, bestSpawnerIndex);
  } catch (e: any) {
    logError(mod.Message(mod.stringkeys.placeholder, spawnerNumber));
  }
}

function createUIWidgets() {
  mod.AddUIContainer(
    mod.stringkeys.scoreWidgetContainerName, // name
    mod.CreateVector(0, 50, 0), //position
    mod.CreateVector(790, 50, 0), //size
    mod.UIAnchor.TopCenter, //anchor
    mod.GetUIRoot(), //parent
    true, //visible
    0, //padding
    mod.CreateVector(1, 1, 1), //background color
    0, //background alpha
    mod.UIBgFill.None, //background fill
    mod.UIDepth.AboveGameUI // UI Depth
  );

  const scoreWidgetContainer: mod.UIWidget = mod.FindUIWidgetWithName(mod.stringkeys.scoreWidgetContainerName);
  //LEFT OUTER SCORE BAR - GREY CONTAINER OUTLINE
  mod.AddUIContainer(
    mod.stringkeys.friendlyScorebarOuterName, // name
    mod.CreateVector(60, 25, 0), //position
    mod.CreateVector(UI_PROGRESS_BAR_WIDTH, 15, 0), //size
    mod.UIAnchor.TopLeft, //anchor
    scoreWidgetContainer, //parent
    true, //visible
    0, //padding
    mod.CreateVector(0.3, 0.3, 0.3), //background color
    0.2, //background alpha
    mod.UIBgFill.Solid, //background fill
    mod.UIDepth.AboveGameUI // UI Depth
  );

  //LEFT SCORE BAR THAT REPRESENTS THE CURRENT SCORE FOR TEAM 1
  mod.AddUIContainer(
    mod.stringkeys.friendlyScorebarName, // name
    mod.CreateVector(60, 25, 0), //position
    mod.CreateVector(0, 15, 0), //size
    mod.UIAnchor.TopLeft, //anchor
    scoreWidgetContainer, //parent
    true, //visible
    0, //padding
    mod.CreateVector(0.6, 0.9, 0.9), //background color
    0.8, //background alpha
    mod.UIBgFill.Solid, //background fill
    mod.UIDepth.AboveGameUI // UI Depth
  );

  //RIGHT OUTER SCORE BAR - GREY CONTAINER OUTLINE
  mod.AddUIContainer(
    mod.stringkeys.enemyScorebarOuterName, // name
    mod.CreateVector(60, 25, 0), //position
    mod.CreateVector(UI_PROGRESS_BAR_WIDTH, 15, 0), //size
    mod.UIAnchor.TopRight, //anchor
    scoreWidgetContainer, //parent
    true, //visible
    0, //padding
    mod.CreateVector(0.3, 0.3, 0.3), //background color
    0.2, //background alpha
    mod.UIBgFill.Solid, //background fill
    mod.UIDepth.AboveGameUI // UI Depth
  );

  //RIGHT SCORE BAR THAT REPRESENTS THE CURRENT SCORE FOR TEAM 2
  mod.AddUIContainer(
    mod.stringkeys.enemyScorebarName, // name
    mod.CreateVector(60, 25, 0), //position
    mod.CreateVector(0, 15, 0), //size
    mod.UIAnchor.TopRight, //anchor
    scoreWidgetContainer, //parent
    true, //visible
    0, //padding
    mod.CreateVector(0.9, 0.3, 0.3), //background color
    0.8, //background alpha
    mod.UIBgFill.Solid, //background fill
    mod.UIDepth.AboveGameUI // UI Depth
  );

  // Target score display in the center
  mod.AddUIText(
    mod.stringkeys.targetScoreName,
    mod.CreateVector(0, 15, 0),
    mod.CreateVector(50, 35, 0),
    mod.UIAnchor.TopCenter,
    formatScoreDisplay(POINTS_TO_WIN)
  );
  const targetScoreWidget = mod.FindUIWidgetWithName(mod.stringkeys.targetScoreName);
  mod.SetUITextSize(targetScoreWidget, 25);
  mod.SetUITextAnchor(targetScoreWidget, mod.UIAnchor.Center);
  mod.SetUITextColor(targetScoreWidget, mod.CreateVector(1, 1, 1));
  mod.SetUIWidgetBgFill(targetScoreWidget, mod.UIBgFill.Solid);
  mod.SetUIWidgetBgAlpha(targetScoreWidget, 0.6);
  mod.SetUIWidgetDepth(targetScoreWidget, mod.UIDepth.AboveGameUI); // maybe try below game ui if it doesn't work
  mod.SetUIWidgetParent(targetScoreWidget, scoreWidgetContainer);
  mod.SetUIWidgetVisible(targetScoreWidget, true);

  // displays friendly score on left
  mod.AddUIText(
    mod.stringkeys.friendlyScoreName,
    mod.CreateVector(0, 15, 0),
    mod.CreateVector(50, 35, 0),
    mod.UIAnchor.TopLeft,
    mod.Message(mod.stringkeys.text00)
  );
  const friendlyScoreWidget = mod.FindUIWidgetWithName(mod.stringkeys.friendlyScoreName);
  if (!friendlyScoreWidget) logMessage(mod.Message(mod.stringkeys.placeholder, 777));
  mod.SetUITextSize(friendlyScoreWidget, 25);
  mod.SetUITextAnchor(friendlyScoreWidget, mod.UIAnchor.Center);
  mod.SetUITextColor(friendlyScoreWidget, mod.CreateVector(0.6, 0.9, 0.9));
  mod.SetUIWidgetBgFill(friendlyScoreWidget, mod.UIBgFill.Solid);
  mod.SetUIWidgetBgAlpha(friendlyScoreWidget, 0.6);
  mod.SetUIWidgetDepth(friendlyScoreWidget, mod.UIDepth.BelowGameUI); // maybe try below game ui if it doesn't work
  mod.SetUIWidgetParent(friendlyScoreWidget, scoreWidgetContainer);
  mod.SetUIWidgetVisible(friendlyScoreWidget, true);

  // displays enemy score on right
  mod.AddUIText(
    mod.stringkeys.enemyScoreName,
    mod.CreateVector(0, 15, 0),
    mod.CreateVector(50, 35, 0),
    mod.UIAnchor.TopRight,
    mod.Message(mod.stringkeys.text00)
  );
  const enemyScoreWidget = mod.FindUIWidgetWithName(mod.stringkeys.enemyScoreName);
  mod.SetUITextSize(enemyScoreWidget, 25);
  mod.SetUITextAnchor(enemyScoreWidget, mod.UIAnchor.Center);
  mod.SetUITextColor(enemyScoreWidget, mod.CreateVector(0.9, 0.3, 0.3));
  mod.SetUIWidgetBgFill(enemyScoreWidget, mod.UIBgFill.Solid);
  mod.SetUIWidgetBgAlpha(enemyScoreWidget, 0.6);
  mod.SetUIWidgetDepth(enemyScoreWidget, mod.UIDepth.BelowGameUI); // maybe try below game ui if it doesn't work
  mod.SetUIWidgetParent(enemyScoreWidget, scoreWidgetContainer);
  mod.SetUIWidgetVisible(enemyScoreWidget, true);

  //displays crown in center
  mod.AddUIImage(
    mod.stringkeys.centerIcon, // name
    mod.CreateVector(0, 0, 0), // position
    mod.CreateVector(30, 14, 0), //size
    mod.UIAnchor.TopCenter, // anchor for position
    scoreWidgetContainer, // parent
    true, //visible
    0, //padding
    mod.CreateVector(0.3, 0.3, 0.3), // background color (r, g, b)
    0.6, // background alpha
    mod.UIBgFill.Solid, // background fill
    mod.UIImageType.CrownSolid,
    mod.CreateVector(1, 1, 1),
    1
  );
  // mod.AddUIIcon
}

function logError(message: mod.Message) {
  mod.ClearCustomNotificationMessage(mod.CustomNotificationSlots.HeaderText);
  mod.DisplayCustomNotificationMessage(message, mod.CustomNotificationSlots.HeaderText, 10);
}

function logMessage(message: mod.Message) {
  mod.ClearCustomNotificationMessage(mod.CustomNotificationSlots.MessageText1);
  mod.DisplayCustomNotificationMessage(message, mod.CustomNotificationSlots.MessageText1, 10);
}

/**********************************************************
  Player Stats Class
 **********************************************************/
class PlayerStats {
  id: number;
  kills: number;
  deaths: number;
  score: number;
  headshots: number;
  assists: number;
  revives: number;

  constructor(id: number) {
    this.id = id;
    this.kills = 0;
    this.deaths = 0;
    this.score = 0;
    this.headshots = 0;
    this.assists = 0;
    this.revives = 0;
  }
}
