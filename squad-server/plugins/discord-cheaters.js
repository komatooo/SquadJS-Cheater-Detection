import DiscordBasePlugin from './discord-base-plugin.js';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import DataStore from '../utils/data-store.js';

export default class DiscordCheaters extends DiscordBasePlugin {
  static get description() {
    return 'The <code>DiscordCheater</code> plugin will log suspected Cheaters to a Discord channel.';
  }

  static get defaultEnabled() {
    return true;
  }

  static get optionsSpecification() {
    return {
      ...DiscordBasePlugin.optionsSpecification,
      logDir: {
        required: true,
        description: 'Squad Log Directory.',
        default: ''
      },
      pingGroups: {
        required: false,
        description: 'A list of Discord role IDs to ping.',
        default: [],
        example: ['500455137626554379']
      },
      channelID: {
        required: true,
        description: 'The ID of the channel to log to.',
        default: '',
        example: '667741905228136459'
      },
      warnInGameAdmins: {
        required: false,
        description:
          'Should in-game admins be warned if a Suspected Cheater is detected.',
        default: false
      },
      interval: {
        required: false,
        description: 'Frequency of the cheater checks in milliseconds.',
        default: 5 * 60 * 1000
      },
      explosionThreshold: {
        required: false,
        description: 'Explosion Detection Threshold.',
        default: 200
      },
      serverMoveTimeStampExpiredThreshold: {
        required: false,
        description: 'ServerMoveTimeStampExpired Detection Threshold.',
        default: 3000
      },
      clientNetSpeedThreshold: {
        required: false,
        description: 'Client Net Speed Threshold.',
        default: 1800
      },
      killsThreshold: {
        required: false,
        description: 'Kills Detection Threshold.',
        default: 200
      }
    };
  }

  constructor(server, options, connectors) {
    super(server, options, connectors);
    // Set to store unique rows
    this.uniqueRowsSet = new Set();
    this.cheaterCheck = this.cheaterCheck.bind(this);
  }

  async mount() {
    this.cheaterCheck = setInterval(this.cheaterCheck, this.options.interval);
  }

  async unmount() {
    clearInterval(this.interval);
  }

  async cheaterCheck() {
    const logDirectory = this.options.logDir;
    const files = fs.readdirSync(logDirectory).filter(f => f.endsWith('SquadGame.log'));
    this.verbose(1, `Logs found (${files.length}):\n > ${files.join(`\n > `)}`);

    files.map(async (logFile) => {
      const logPath = path.join(logDirectory, logFile);
      const fileNameNoExt = logFile.replace(/\.[^\.]+$/, '');

      try {
        await fs.promises.access(logPath, fs.constants.R_OK)
      } catch (error) {
        this.verbose(1, `\n\x1b[1m\x1b[34mUnable to read: \x1b[32m${fileNameNoExt}\x1b[0m`)
      }

      await this.drawGraph(logPath, fileNameNoExt);
    })
  }

  async drawGraph(logPath, fileNameNoExt) {
    const startTime = Date.now();
    return new Promise((resolve, reject) => {
      const data = new DataStore();

      let serverName = '';

      let uniqueClientNetSpeedValues = new Set();

      let explosionCountersPerController = []
      let serverMoveTimestampExpiredPerController = []
      let pawnsToPlayerNames = []
      let chainIdToPlayerController = []
      let playerNameToPlayerController = []
      let playerControllerToPlayerName = []
      let playerControllerToSteamID = []
      let steamIDToPlayerController = new Map();
      let killsPerPlayerController = []
      let connectionTimesByPlayerController = []
      let disconnectionTimesByPlayerController = []
      let playerControllerToNetspeed = []

      const fileStream = fs.createReadStream(logPath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
      });

      let totalLines = 0;
      rl.on("line", (line) => {
        totalLines++;
        let regex, res;

        regex = /\[(.+)\]\[\d+\]LogSquad: .+: Server Tick Rate: (\d+.?\d+)/;
        res = regex.exec(line);
        if (res) {
          const timePoint = getDateTime(res[1]);
          data.addTimePoint(timePoint);

          data.setNewCounterValue('tickRate', Math.round(+res[2]))
          return;
        }

        regex = / ServerName: \'(.+)\' RegisterTimeout:/
        res = regex.exec(line);
        if (res) {
          serverName = res[1];
          return;
        }

        regex = /CloseBunch/
        res = regex.exec(line);
        if (res) {
          // queuePoints[ queuePoints.length - 1 ].y -= 1;
          data.incrementCounter('queue', -1)
          return;
        }

        regex = /LogSquad: PostLogin: NewPlayer:/;
        res = regex.exec(line);
        if (res) {
          data.incrementCounter('players', 1);
          return;
        }

        regex = /^\[([0-9.:-]+)]\[([ 0-9]*)]LogNet: UChannel::Close: Sending CloseBunch\. ChIndex == [0-9]+\. Name: \[UChannel\] ChIndex: [0-9]+, Closing: [0-9]+ \[UNetConnection\] RemoteAddr: (.+):[0-9]+, Name: (Steam|EOSIp)NetConnection_[0-9]+, Driver: GameNetDriver (Steam|EOS)NetDriver_[0-9]+, IsServer: YES, PC: ([^ ]+PlayerController_C_[0-9]+), Owner: [^ ]+PlayerController_C_[0-9]+/
        res = regex.exec(line);
        if (res) {
          data.incrementCounter('players', -1);
          disconnectionTimesByPlayerController[res[6]] = getDateTime(res[1])
          return;
        }

        regex = /\[(.+)\].+LogSquad: OnPreLoadMap: Loading map .+\/([^\/]+)$/;
        res = regex.exec(line);
        if (res) {
          const timePoint = getDateTime(res[1]);
          data.setNewCounterValue('layers', 150, res[2], timePoint)
          return;
        }

        regex = /\[(.+)\]\[\d+].*LogWorld: SeamlessTravel to: .+\/([^\/]+)$/;
        res = regex.exec(line);
        if (res) {
          data.setNewCounterValue('layers', 150, res[2])
          return;
        }

        regex = /Frag_C.*DamageInstigator=([^ ]+PlayerController_C_\d+) /;
        res = regex.exec(line);
        if (res) {
          data.incrementFrequencyCounter('frags', 1)

          const playerController = res[1];
          if (!explosionCountersPerController[playerController]) explosionCountersPerController[playerController] = 0;
          explosionCountersPerController[playerController]++;
          return;
        }

        regex = /ServerMove\: TimeStamp expired: ([\d\.]+), CurrentTimeStamp: ([\d\.]+), Character: (.+)/;
        res = regex.exec(line);
        if (res) {
          data.incrementFrequencyCounter('serverMove', 0.05)

          const timestampExpired = +res[1];
          const currentTimeStamp = +res[2];
          const delta = currentTimeStamp - timestampExpired
          const playerName = pawnsToPlayerNames[res[3]];
          const playerController = playerNameToPlayerController[playerName]
          if (delta > 20) {
            if (!serverMoveTimestampExpiredPerController[playerController]) {
              // console.log("Found sus player", playerName, res[ 3 ])
              serverMoveTimestampExpiredPerController[playerController] = 0;
            }
            serverMoveTimestampExpiredPerController[playerController]++;
          }
          return;
        }

        regex = /Warning: UNetConnection::Tick/;
        res = regex.exec(line);
        if (res) {
          data.incrementFrequencyCounter('unetConnectionTick', 1)
          return;
        }

        regex = /SetReplicates called on non-initialized actor/;
        res = regex.exec(line);
        if (res) {
          data.incrementFrequencyCounter('nonInitializedActor', 1)
          return;
        }

        regex = /RotorWashEffectListener/;
        res = regex.exec(line);
        if (res) {
          data.incrementFrequencyCounter('rotorWashEffectListener', 1)
          return;
        }

        regex = /\[(.+)\]\[ ?(\d+)\].+Client netspeed is (\d+)/;
        res = regex.exec(line);
        if (res) {
          data.setNewCounterValue('clientNetSpeed', (+res[3]) / 1000)
          uniqueClientNetSpeedValues.add(+res[3]);
          const playerController = chainIdToPlayerController[res[2]]
          if (playerController) {
            if (!playerControllerToNetspeed[playerController]) playerControllerToNetspeed[playerController] = []
            playerControllerToNetspeed[playerController].push(+res[3])
          }
          return;
        }

        if (serverVersionMajor < 7) {
          regex = /OnPossess\(\): PC=(.+) Pawn=(.+) FullPath/;
          res = regex.exec(line);
          if (res) {
            pawnsToPlayerNames[res[2]] = res[1];
          }

          regex = /\[(.+)\]\[ ?(\d+)\]LogSquad: PostLogin: NewPlayer: [^ ]+PlayerController_C.+PersistentLevel\.(.+)/;
          res = regex.exec(line);
          if (res) {
            chainIdToPlayerController[res[2]] = res[3];
            connectionTimesByPlayerController[res[3]] = getDateTime(res[1])
          }
        } else {
          regex = /^\[([0-9.:-]+)]\[([ 0-9]*)]LogSquad: PostLogin: NewPlayer: BP_PlayerController_C .+PersistentLevel\.(.+) \(IP: ([\d\.]+) \| Online IDs: EOS: (.+) steam: (\d+)\)/;
          res = regex.exec(line);
          if (res) {
            const playerController = res[3];

            chainIdToPlayerController[res[2]] = playerController;
            connectionTimesByPlayerController[res[3]] = getDateTime(res[1])

            const steamID = res[6];
            playerControllerToSteamID[playerController] = steamID;

            const playerControllerHistory = steamIDToPlayerController.get(steamID);
            if (!playerControllerHistory)
              steamIDToPlayerController.set(steamID, [playerController]);
            else
              playerControllerHistory.push(playerController)
          }

          regex = /OnPossess\(\): PC=(.+) \(Online IDs: EOS: (.+) steam: (\d+)\) Pawn=(.+) FullPath/;
          res = regex.exec(line);
          if (res) {
            pawnsToPlayerNames[res[4]] = res[1];
          }
        }

        regex = /\[.+\]\[ ?(\d+)\]LogSquad: Player (.+) has been added to Team/;
        res = regex.exec(line);
        if (res) {
          // data.incrementCounter('players', 1);
          playerNameToPlayerController[res[2]] = chainIdToPlayerController[res[1]];
          playerControllerToPlayerName[chainIdToPlayerController[res[1]]] = res[2];
          return;
        }
        regex = /\[(.+)\]\[ ?(\d+)\]LogNet: Join succeeded: (.+)/;
        res = regex.exec(line);
        if (res) {
          delete chainIdToPlayerController[res[2]];
          return;
        }

        regex = /\[.+\]\[ ?(\d+)\]LogEOS: \[Category: LogEOSAntiCheat\] \[AntiCheatServer\] \[RegisterClient-001\].+AccountId: (\d+) IpAddress/;
        res = regex.exec(line);
        if (res) {
          const playerController = chainIdToPlayerController[res[1]];

          if (playerController) {
            const steamID = res[2];
            playerControllerToSteamID[playerController] = steamID;

            const playerControllerHistory = steamIDToPlayerController.get(steamID);
            if (!playerControllerHistory)
              steamIDToPlayerController.set(steamID, [playerController]);
            else if (!playerControllerHistory.includes(playerController))
              playerControllerHistory.push(playerController)
          }
          return;
        }

        regex = /Die\(\): Player:.+from (.+) caused by (.+)/;
        res = regex.exec(line);
        if (res) {
          data.incrementFrequencyCounter('playerDeaths', 1 / 5)
          let playerController = res[1]
          if (!playerController || playerController == 'nullptr') {
            playerController = playerNameToPlayerController[pawnsToPlayerNames[res[2]]]
          }
          if (!killsPerPlayerController[playerController]) killsPerPlayerController[playerController] = 0;
          killsPerPlayerController[playerController]++;
          return;
        }
        regex = /LogSquadVoiceChannel: Warning: Unable to find channel for packet sender/;
        res = regex.exec(line);
        if (res) {
          data.incrementFrequencyCounter('unableToFindVoiceChannel', 0.005)
          return;
        }

        regex = /DealDamage was called but there was no valid actor or component/;
        res = regex.exec(line);
        if (res) {
          data.incrementFrequencyCounter('dealDamageOnInvalidActorOrComponent', 1)
          return;
        }

        regex = /TraceAndMessageClient\(\): SQVehicleSeat::TakeDamage/;
        res = regex.exec(line);
        if (res) {
          data.incrementFrequencyCounter('SQVehicleSeatTakeDamage', 1)
          return;
        }

        regex = /LogSquadCommon: SQCommonStatics Check Permissions/;
        res = regex.exec(line);
        if (res) {
          data.incrementFrequencyCounter('SQCommonStaticsCheckPermissions', 1)
          return;
        }

        regex = /Updated suppression multiplier/;
        res = regex.exec(line);
        if (res) {
          data.incrementFrequencyCounter('updatedSuppressionMultiplier', 1)
          return;
        }

        regex = /PlayerWounded_Implementation\(\): Driver Assist Points:/;
        res = regex.exec(line);
        if (res) {
          data.incrementFrequencyCounter('driverAssistPoints', 1)
          return;
        }
      })


      // Cheater Report
      rl.on("close", () => {
        const endAnalysisTIme = Date.now();
        let contentBuilding = [];

        const endTime = Date.now();
        const analysisDuration = ((endAnalysisTIme - startTime) / 1000).toFixed(1)
        const totalDuration = ((endTime - startTime) / 1000).toFixed(1)

        contentBuilding.push({
          row: `### ${serverName} SUSPECTED CHEATER REPORT: ${fileNameNoExt} ###`
        })

        contentBuilding.push({
          row: `# == Analysis duration: ${analysisDuration}`
        })

        contentBuilding.push({
          row: `# == Total duration: ${totalDuration}`
        })

        this.verbose(1, `\x1b[1m\x1b[34m#\x1b[0m == \x1b[1m\x1b[31mAnalysis duration:\x1b[0m ${analysisDuration}`)
        this.verbose(1, `\x1b[1m\x1b[34m#\x1b[0m == \x1b[1m\x1b[31mTotal duration:\x1b[0m ${totalDuration}`)
        this.verbose(1, `\x1b[1m\x1b[34m### ${serverName} CHEATING REPORT: \x1b[32m${fileNameNoExt}\x1b[34m ###\x1b[0m`)
        const cheaters = {
          Explosions: explosionCountersPerController,
          ServerMoveTimeStampExpired: serverMoveTimestampExpiredPerController,
          ClientNetSpeed: playerControllerToNetspeed,
          Kills: killsPerPlayerController
        }
        let suspectedCheaters = [];
        for (let cK in cheaters) {
          let minCount = 200;
          switch (cK) {
            case 'Explosions':
              minCount = this.options.explosionThreshold;
              break;
            case 'ServerMoveTimeStampExpired':
              minCount = this.options.serverMoveTimeStampExpiredThreshold;
              break;
            case 'ClientNetSpeed':
              minCount = this.options.clientNetSpeedThreshold;
              break;
            case 'Kills':
              minCount = this.options.killsThreshold;
              break;
          }

          contentBuilding.push({
            row: `# == ${cK.toUpperCase()}`
          })

          this.verbose(1, `\x1b[1m\x1b[34m#\x1b[0m == \x1b[1m\x1b[31m${cK.toUpperCase()}\x1b[0m`)
          for (let playerId in cheaters[cK]) {
            const referenceValue = cheaters[cK][playerId]
            if ((typeof referenceValue === "number" && referenceValue > minCount) || (typeof referenceValue === "object" && referenceValue.find(v => v > minCount))) {
              let playerName;
              let playerSteamID;
              let playerController;

              playerController = playerId
              playerName = playerControllerToPlayerName[playerController];
              playerSteamID = playerControllerToSteamID[playerController];

              const row = `#  > ${playerSteamID} | ${playerController} | ${playerName}: ${cheaters[cK][playerId]}`;

              // Check if the row is already in the set
              if (!this.uniqueRowsSet.has(row)) {
                suspectedCheaters.push(playerSteamID);
                this.uniqueRowsSet.add(row);
                contentBuilding.push({ row });
                this.verbose(1, `\x1b[1m\x1b[34m#\x1b[0m  > \x1b[33m${playerSteamID}\x1b[90m ${playerController}\x1b[37m ${playerName}\x1b[90m: \x1b[91m${cheaters[cK][playerId]}\x1b[0m`);
              }
            }
          }
        }
        if (suspectedCheaters.length === 0) {
          this.verbose(1, `\x1b[1m\x1b[34m### NO SUSPECTED CHEATERS FOUND: \x1b[32m${fileNameNoExt}\x1b[34m ###\x1b[0m`)
          return
        } else {
          contentBuilding.push({
            row: `### SUSPECTED CHEATERS SESSIONS: ${fileNameNoExt} ###`
          })
          this.verbose(1, `\x1b[1m\x1b[34m### SUSPECTED CHEATERS SESSIONS: \x1b[32m${fileNameNoExt}\x1b[34m ###\x1b[0m`)
          for (let playerSteamID of suspectedCheaters) {
            const playerControllerHistory = steamIDToPlayerController.get(playerSteamID);
            if (!playerControllerHistory) continue;
            let playerName = playerControllerToPlayerName[playerControllerHistory[0]];
            contentBuilding.push({
              row: `# == ${playerSteamID} | ${playerName}`
            })
            this.verbose(1, `\x1b[1m\x1b[34m#\x1b[0m == \x1b[1m\x1b[33m${playerSteamID} \x1b[31m${playerName}\x1b[0m`)

            for (let playerController of playerControllerHistory) {
              let stringifiedConnectionTime = connectionTimesByPlayerController[playerController].toLocaleString();
              let stringifiedDisconnectionTime = disconnectionTimesByPlayerController[playerController]?.toLocaleString() || "N/A"

              contentBuilding.push({
                row: `#  >  ${playerController}: (${stringifiedConnectionTime} - ${stringifiedDisconnectionTime})`
              })
              this.verbose(1, `\x1b[1m\x1b[34m#\x1b[0m  > \x1b[90m ${playerController}\x1b[90m: \x1b[91m(${stringifiedConnectionTime} - ${stringifiedDisconnectionTime})\x1b[0m`)
            }
          }
          contentBuilding.push({
            row: `#### FINISHED ALL REPORTS: ${fileNameNoExt} ###`
          })
          this.verbose(1, `\x1b[1m\x1b[34m#### FINISHED ALL REPORTS: \x1b[32m${fileNameNoExt}\x1b[34m ###\x1b[0m`)

          let pingables = 'Supsected Cheater Report for Review';
          if (this.options.pingGroups.length > 0) {
            pingables = this.options.pingGroups.map((groupID) => `<@&${groupID}>`).join(' ')
          }

          this.sendDiscordMessage({
            content: `${pingables}\n\`\`\`\n${contentBuilding.map(item => item.row).join('\n')}\n\`\`\``,
          });

          this.warnInGameAdmins()
        }
      })

      rl.on('error', (err) => {
        reject(err);
      });
    });
  }
  async warnInGameAdmins() {
    const admins = await this.server.getAdminsWithPermission('canseeadminchat');
    let amountAdmins = 0;
    for (const player of this.server.players) {
      if (!admins.includes(player.steamID)) continue;
      amountAdmins++;
      if (this.options.warnInGameAdmins)
        await this.server.rcon.warn(player.steamID, `Suspected Cheater Found! Check the Discord Posting!`);
    }
  }
}

function getDateTime(date) {
  const parts = date.replace(/:\d+$/, '').replace(/-/, 'T').split('T');
  parts[0] = parts[0].replace(/\./g, '-')
  parts[1] = parts[1].replace(/\./g, ':')
  const res = `${parts.join('T')}Z`;
  return new Date(res)
}