// ****************************** GLOBAL VARIABLES ****************************** //
const COLORS = {
    blue: mod.CreateVector(0.18, 0.11, 1),
    red: mod.CreateVector(1, 0.11, 0.11),
    gray: mod.CreateVector(0.3, 0.3, 0.3),
    white: mod.CreateVector(1, 1, 1),
    black: mod.CreateVector(0, 0, 0)
}

const POINTS_TO_WIN = 30;
const PLAYERS: {[id: number]: Player} = {};
var SCOREBOARD: Scoreboard;

// ****************************** SCOREBOARD ****************************** //
class Scoreboard {
    constructor() {
        mod.SetScoreboardType(mod.ScoreboardType.CustomFFA);
        mod.SetScoreboardColumnNames(
            mod.stringkeys.scoreboard_column_1, // Score
            mod.stringkeys.scoreboard_column_2, // Kills
            mod.stringkeys.scoreboard_column_3, // Headshots
            mod.stringkeys.scoreboard_column_4, // Assists
            mod.stringkeys.scoreboard_column_5, // Deaths
        );
        const COLUMN_WIDTH = 12;
        mod.SetScoreboardColumnWidths(
            COLUMN_WIDTH,
            COLUMN_WIDTH,
            COLUMN_WIDTH,
            COLUMN_WIDTH,
            COLUMN_WIDTH,
        );
    }

    updatePlayerScoreboard(player: Player) {
        mod.SetScoreboardPlayerValues(player.modPlayer,
            player.stats.score,
            player.stats.kills,
            player.stats.headshots,
            player.stats.assists,
            player.stats.deaths
        )
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
        }
        this.ui = new PlayerUI(modPlayer);
    }

    updateUI(bestEnemy: Player, targetScore: number) {
        this.ui.updateScores(this, bestEnemy, targetScore);
    }

    equals(otherPlayer: Player) {
        return (this.id === otherPlayer.id);
    }
}

class PlayerUI {
    rootWidget?: mod.UIWidget;
    progressBarWidget?: mod.UIWidget;
    playerIndicatorWidget?: mod.UIWidget;
    playerPlacementWidget?: mod.UIWidget;
    enemyIndicatorWidget?: mod.UIWidget;
    enemyPlacementWidget?: mod.UIWidget;
    SCORE_BAR_WIDTH: number = 400;

    constructor(player: mod.Player) {
       const rootName: string = "ui_root_" + player;
       const playerPlacementName: string = "ui_player_placement_" + player;
       const enemyPlacementName: string = "ui_enemy_placement_" + player;
       const progressBarName: string = "ui_progress_bar_" + player;
       const playerIndicatorName: string = "ui_player_indicator_" + player;
       const enemyIndicatorName: string = "ui_enemy_indicator_" + player;

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
        )
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
        )
        this.playerIndicatorWidget = mod.FindUIWidgetWithName(enemyIndicatorName);
    }

    updateScores(player: Player, enemy: Player, targetScore: number) {
        const playerScore = player.stats.score;
        const enemyScore = enemy.stats.score;
        if (this.playerIndicatorWidget) {
            const progress = this.SCORE_BAR_WIDTH * playerScore / targetScore;
            mod.SetUIWidgetPosition(this.playerIndicatorWidget, mod.CreateVector(progress, 0, 0));
        }
        if (this.enemyIndicatorWidget) {
            const progress = this.SCORE_BAR_WIDTH * enemyScore / targetScore;
            mod.SetUIWidgetPosition(this.enemyIndicatorWidget, mod.CreateVector(progress, 0, 0));
        }
        if (this.playerPlacementWidget && this.enemyPlacementWidget) {
            if (player.stats.placement === 1) {
                mod.SetUITextLabel(this.playerPlacementWidget, mod.Message(mod.stringkeys.text_num_st_user, 1, player.modPlayer));
                mod.SetUITextLabel(this.enemyPlacementWidget, mod.Message(mod.stringkeys.text_num_nd_user, 2, enemy.modPlayer));
            }
            else if (player.stats.placement === 2) {
                mod.SetUITextLabel(this.playerPlacementWidget, mod.Message(mod.stringkeys.text_num_nd_user, 2, player.modPlayer));
                mod.SetUITextLabel(this.enemyPlacementWidget, mod.Message(mod.stringkeys.text_num_st_user, 1, enemy.modPlayer));
            }
            else if (player.stats.placement === 3) {
                mod.SetUITextLabel(this.playerPlacementWidget, mod.Message(mod.stringkeys.text_num_rd_user, 3, player.modPlayer));
                mod.SetUITextLabel(this.enemyPlacementWidget, mod.Message(mod.stringkeys.text_num_st_user, 1, enemy.modPlayer));
            }
            else {
                mod.SetUITextLabel(this.playerPlacementWidget, mod.Message(mod.stringkeys.text_num_th_user, player.stats.placement, player.modPlayer));
                mod.SetUITextLabel(this.enemyPlacementWidget, mod.Message(mod.stringkeys.text_num_st_user, 1, enemy.modPlayer));
            }
        }
    }
}

function getPlayerFromModPlayer(modPlayer: mod.Player) {
    const id = mod.GetObjId(modPlayer);
    return PLAYERS[id];
}

// ****************************** GAME LOGIC ****************************** //
export function OnGameModeStarted() {
    SCOREBOARD = new Scoreboard();
}

var NumTeams = 0;
export function OnPlayerJoinGame(player: mod.Player) {
    const id = mod.GetObjId(player);
    PLAYERS[id] = new Player(player);
    mod.SetTeam(player, mod.GetTeam(++NumTeams));
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
    }
    SCOREBOARD.updatePlayerScoreboard(player);
    const sortedPlayers = Object.values(PLAYERS).sort((a, b) => b.stats.score - a.stats.score); // highest score first
    sortedPlayers.forEach((p: Player, index) => {
        p.stats.placement = index + 1;
    })
    const bestPlayer = sortedPlayers[0];
    // update player ui to show their score compared to the best player in the lobby (that isn't them)
    Object.values(PLAYERS).forEach((p: Player) => {
        if (bestPlayer.equals(p)) {
            p.updateUI(sortedPlayers[1], POINTS_TO_WIN);
        }
        else {
            p.updateUI(bestPlayer, POINTS_TO_WIN);
        }
    })

    if (player.stats.score >= POINTS_TO_WIN) {
        mod.EndGameMode(player.modPlayer);
    }
}

export function OnPlayerEarnedKillAssist(eventPlayer: mod.Player, eventOtherPlayer: mod.Player) {
    const player = getPlayerFromModPlayer(eventPlayer);
    player.stats.assists++;
    SCOREBOARD.updatePlayerScoreboard(player);
}
