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
        this.rootWidget = ParseUI({
            name: "root_container",
            type: "Container",
            size: [this.SCORE_BAR_WIDTH, 200],
            position: [0, 100],
            anchor: mod.UIAnchor.TopCenter,
            bgFill: mod.UIBgFill.None,
            bgColor: COLORS.black,
            bgAlpha: 0.8
        });
        
        if (!this.rootWidget) return;

        this.playerPlacementWidget = ParseUI({
            name: "placement_player",
            type: "Text",
            parent: this.rootWidget,
            textSize: 24,
            position: [0, 0, 0],
            size: [100, 50],
            anchor: mod.UIAnchor.TopLeft,
            textAnchor: mod.UIAnchor.CenterLeft,
            bgAlpha: 0,
            bgFill: mod.UIBgFill.Blur,
            textLabel: mod.Message(mod.stringkeys.text_num_st_user, 1, player),
            textColor: COLORS.blue
        })

        this.enemyPlacementWidget = ParseUI({
            name: "placement_enemy",
            type: "Text",
            parent: this.rootWidget,
            textSize: 24,
            position: [0, 0, 0],
            size: [100, 50],
            anchor: mod.UIAnchor.TopRight,
            textAnchor: mod.UIAnchor.CenterRight,
            bgAlpha: 0,
            bgFill: mod.UIBgFill.Blur,
            textLabel: mod.Message(mod.stringkeys.text_num_nd_user, 2, player),
            textColor: COLORS.red
        })
        
        this.progressBarWidget = ParseUI({
            name: "progress_bar",
            type: "Container",
            parent: this.rootWidget,
            position: [0, 0, 0],
            size: [this.SCORE_BAR_WIDTH, 50],
            anchor: mod.UIAnchor.Center,
            bgAlpha: 0,
            bgFill: mod.UIBgFill.Solid,
            bgColor: COLORS.gray
        });

        if (!this.progressBarWidget) return;
        
        this.playerIndicatorWidget = ParseUI({
            name: "player_indicator",
            type: "Image",
            parent: this.progressBarWidget,
            position: [0, 0, 0],
            size: [50, 50],
            anchor: mod.UIAnchor.CenterLeft,
            bgAlpha: 0,
            imageType: mod.UIImageType.CrownSolid, 
            imageColor: COLORS.blue,
        });

        this.enemyIndicatorWidget = ParseUI({
            name: "enemy_indicator",
            type: "Image",
            parent: this.progressBarWidget,
            position: [0, 0, 0],
            size: [50, 50],
            anchor: mod.UIAnchor.CenterLeft,
            bgAlpha: 0,
            imageType: mod.UIImageType.CrownSolid, 
            imageColor: COLORS.red,
        });
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

export function OnPlayerJoinGame(player: mod.Player) {
    const id = mod.GetObjId(player);
    PLAYERS[id] = new Player(player);
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

// ****************************** PARSE UI HELPER ****************************** //
type UIVector = mod.Vector | number[];

interface UIParams {
    name: string;
    type: string;
    position: any;
    size: any;
    anchor: mod.UIAnchor;
    parent: mod.UIWidget;
    visible: boolean;
    textLabel: string;
    textColor: UIVector;
    textAlpha: number;
    textSize: number;
    textAnchor: mod.UIAnchor;
    padding: number;
    bgColor: UIVector;
    bgAlpha: number;
    bgFill: mod.UIBgFill;
    imageType: mod.UIImageType;
    imageColor: UIVector;
    imageAlpha: number;
    teamId?: mod.Team;
    playerId?: mod.Player;
    children?: any[];
    buttonEnabled: boolean;
    buttonColorBase: UIVector;
    buttonAlphaBase: number;
    buttonColorDisabled: UIVector;
    buttonAlphaDisabled: number;
    buttonColorPressed: UIVector;
    buttonAlphaPressed: number;
    buttonColorHover: UIVector;
    buttonAlphaHover: number;
    buttonColorFocused: UIVector;
    buttonAlphaFocused: number;
}

function __asModVector(param: number[] | mod.Vector) {
    if (Array.isArray(param)) return mod.CreateVector(param[0], param[1], param.length == 2 ? 0 : param[2]);
    else return param;
}

function __asModMessage(param: string | mod.Message) {
    if (typeof param === 'string') return mod.Message(param);
    return param;
}

function __fillInDefaultArgs(params: UIParams) {
    if (!params.hasOwnProperty('name')) params.name = '';
    if (!params.hasOwnProperty('position')) params.position = mod.CreateVector(0, 0, 0);
    if (!params.hasOwnProperty('size')) params.size = mod.CreateVector(100, 100, 0);
    if (!params.hasOwnProperty('anchor')) params.anchor = mod.UIAnchor.TopLeft;
    if (!params.hasOwnProperty('parent')) params.parent = mod.GetUIRoot();
    if (!params.hasOwnProperty('visible')) params.visible = true;
    if (!params.hasOwnProperty('padding')) params.padding = params.type == 'Container' ? 0 : 8;
    if (!params.hasOwnProperty('bgColor')) params.bgColor = mod.CreateVector(0.25, 0.25, 0.25);
    if (!params.hasOwnProperty('bgAlpha')) params.bgAlpha = 0.5;
    if (!params.hasOwnProperty('bgFill')) params.bgFill = mod.UIBgFill.Solid;
}

function __setNameAndGetWidget(uniqueName: any, params: any) {
    let widget = mod.FindUIWidgetWithName(uniqueName) as mod.UIWidget;
    mod.SetUIWidgetName(widget, params.name);
    return widget;
}

const __cUniqueName = '----uniquename----';

function __addUIContainer(params: UIParams) {
    __fillInDefaultArgs(params);
    let restrict = params.teamId ?? params.playerId;
    if (restrict) {
        mod.AddUIContainer(
            __cUniqueName,
            __asModVector(params.position),
            __asModVector(params.size),
            params.anchor,
            params.parent,
            params.visible,
            params.padding,
            __asModVector(params.bgColor),
            params.bgAlpha,
            params.bgFill,
            restrict
        );
    } else {
        mod.AddUIContainer(
            __cUniqueName,
            __asModVector(params.position),
            __asModVector(params.size),
            params.anchor,
            params.parent,
            params.visible,
            params.padding,
            __asModVector(params.bgColor),
            params.bgAlpha,
            params.bgFill
        );
    }
    let widget = __setNameAndGetWidget(__cUniqueName, params);
    if (params.children) {
        params.children.forEach((childParams: any) => {
            childParams.parent = widget;
            __addUIWidget(childParams);
        });
    }
    return widget;
}

function __fillInDefaultTextArgs(params: UIParams) {
    if (!params.hasOwnProperty('textLabel')) params.textLabel = '';
    if (!params.hasOwnProperty('textSize')) params.textSize = 0;
    if (!params.hasOwnProperty('textColor')) params.textColor = mod.CreateVector(1, 1, 1);
    if (!params.hasOwnProperty('textAlpha')) params.textAlpha = 1;
    if (!params.hasOwnProperty('textAnchor')) params.textAnchor = mod.UIAnchor.CenterLeft;
}

function __addUIText(params: UIParams) {
    __fillInDefaultArgs(params);
    __fillInDefaultTextArgs(params);
    let restrict = params.teamId ?? params.playerId;
    if (restrict) {
        mod.AddUIText(
            __cUniqueName,
            __asModVector(params.position),
            __asModVector(params.size),
            params.anchor,
            params.parent,
            params.visible,
            params.padding,
            __asModVector(params.bgColor),
            params.bgAlpha,
            params.bgFill,
            __asModMessage(params.textLabel),
            params.textSize,
            __asModVector(params.textColor),
            params.textAlpha,
            params.textAnchor,
            restrict
        );
    } else {
        mod.AddUIText(
            __cUniqueName,
            __asModVector(params.position),
            __asModVector(params.size),
            params.anchor,
            params.parent,
            params.visible,
            params.padding,
            __asModVector(params.bgColor),
            params.bgAlpha,
            params.bgFill,
            __asModMessage(params.textLabel),
            params.textSize,
            __asModVector(params.textColor),
            params.textAlpha,
            params.textAnchor
        );
    }
    return __setNameAndGetWidget(__cUniqueName, params);
}

function __fillInDefaultImageArgs(params: any) {
    if (!params.hasOwnProperty('imageType')) params.imageType = mod.UIImageType.None;
    if (!params.hasOwnProperty('imageColor')) params.imageColor = mod.CreateVector(1, 1, 1);
    if (!params.hasOwnProperty('imageAlpha')) params.imageAlpha = 1;
}

function __addUIImage(params: UIParams) {
    __fillInDefaultArgs(params);
    __fillInDefaultImageArgs(params);
    let restrict = params.teamId ?? params.playerId;
    if (restrict) {
        mod.AddUIImage(
            __cUniqueName,
            __asModVector(params.position),
            __asModVector(params.size),
            params.anchor,
            params.parent,
            params.visible,
            params.padding,
            __asModVector(params.bgColor),
            params.bgAlpha,
            params.bgFill,
            params.imageType,
            __asModVector(params.imageColor),
            params.imageAlpha,
            restrict
        );
    } else {
        mod.AddUIImage(
            __cUniqueName,
            __asModVector(params.position),
            __asModVector(params.size),
            params.anchor,
            params.parent,
            params.visible,
            params.padding,
            __asModVector(params.bgColor),
            params.bgAlpha,
            params.bgFill,
            params.imageType,
            __asModVector(params.imageColor),
            params.imageAlpha
        );
    }
    return __setNameAndGetWidget(__cUniqueName, params);
}

function __fillInDefaultArg(params: any, argName: any, defaultValue: any) {
    if (!params.hasOwnProperty(argName)) params[argName] = defaultValue;
}

function __fillInDefaultButtonArgs(params: any) {
    if (!params.hasOwnProperty('buttonEnabled')) params.buttonEnabled = true;
    if (!params.hasOwnProperty('buttonColorBase')) params.buttonColorBase = mod.CreateVector(0.7, 0.7, 0.7);
    if (!params.hasOwnProperty('buttonAlphaBase')) params.buttonAlphaBase = 1;
    if (!params.hasOwnProperty('buttonColorDisabled')) params.buttonColorDisabled = mod.CreateVector(0.2, 0.2, 0.2);
    if (!params.hasOwnProperty('buttonAlphaDisabled')) params.buttonAlphaDisabled = 0.5;
    if (!params.hasOwnProperty('buttonColorPressed')) params.buttonColorPressed = mod.CreateVector(0.25, 0.25, 0.25);
    if (!params.hasOwnProperty('buttonAlphaPressed')) params.buttonAlphaPressed = 1;
    if (!params.hasOwnProperty('buttonColorHover')) params.buttonColorHover = mod.CreateVector(1, 1, 1);
    if (!params.hasOwnProperty('buttonAlphaHover')) params.buttonAlphaHover = 1;
    if (!params.hasOwnProperty('buttonColorFocused')) params.buttonColorFocused = mod.CreateVector(1, 1, 1);
    if (!params.hasOwnProperty('buttonAlphaFocused')) params.buttonAlphaFocused = 1;
}

function __addUIButton(params: UIParams) {
    __fillInDefaultArgs(params);
    __fillInDefaultButtonArgs(params);
    let restrict = params.teamId ?? params.playerId;
    if (restrict) {
        mod.AddUIButton(
            __cUniqueName,
            __asModVector(params.position),
            __asModVector(params.size),
            params.anchor,
            params.parent,
            params.visible,
            params.padding,
            __asModVector(params.bgColor),
            params.bgAlpha,
            params.bgFill,
            params.buttonEnabled,
            __asModVector(params.buttonColorBase),
            params.buttonAlphaBase,
            __asModVector(params.buttonColorDisabled),
            params.buttonAlphaDisabled,
            __asModVector(params.buttonColorPressed),
            params.buttonAlphaPressed,
            __asModVector(params.buttonColorHover),
            params.buttonAlphaHover,
            __asModVector(params.buttonColorFocused),
            params.buttonAlphaFocused,
            restrict
        );
    } else {
        mod.AddUIButton(
            __cUniqueName,
            __asModVector(params.position),
            __asModVector(params.size),
            params.anchor,
            params.parent,
            params.visible,
            params.padding,
            __asModVector(params.bgColor),
            params.bgAlpha,
            params.bgFill,
            params.buttonEnabled,
            __asModVector(params.buttonColorBase),
            params.buttonAlphaBase,
            __asModVector(params.buttonColorDisabled),
            params.buttonAlphaDisabled,
            __asModVector(params.buttonColorPressed),
            params.buttonAlphaPressed,
            __asModVector(params.buttonColorHover),
            params.buttonAlphaHover,
            __asModVector(params.buttonColorFocused),
            params.buttonAlphaFocused
        );
    }
    return __setNameAndGetWidget(__cUniqueName, params);
}

function __addUIWidget(params: UIParams) {
    if (params == null) return undefined;
    if (params.type == 'Container') return __addUIContainer(params);
    else if (params.type == 'Text') return __addUIText(params);
    else if (params.type == 'Image') return __addUIImage(params);
    else if (params.type == 'Button') return __addUIButton(params);
    return undefined;
}

function ParseUI(...params: any[]) {
    let widget: mod.UIWidget | undefined;
    for (let a = 0; a < params.length; a++) {
        widget = __addUIWidget(params[a] as UIParams);
    }
    return widget;
}