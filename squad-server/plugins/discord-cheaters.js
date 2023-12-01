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
      color: {
        required: false,
        description: 'The color of the embed.',
        default: 16761867
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
    const files = fs.readdirSync(logDirectory).filter(f => f.endsWith('SquadGameThis.log'));
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
    return new Promise((resolve, reject) => {
      const data = new DataStore();

      let serverName = '';

      let explosionCountersPerController = []
      let serverMoveTimestampExpiredPerPawn = []
      let pawnsToPlayerNames = []
      let chainIdToPlayerController = []
      let playerNameToPlayerController = []
      let playerControllerToPlayerName = []
      let playerControllerToSteamID = []
      let steamIDToPlayerController = new Map();
      let killsPerPlayerController = []
      let connectionTimesByPlayerController = []
      let disconnectionTimesByPlayerController = []


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
        }

        regex = / ServerName: \'(.+)\' RegisterTimeout:/
        res = regex.exec(line);
        if (res) {
          serverName = res[1];
        }

        regex = /CloseBunch/
        res = regex.exec(line);
        if (res) {
          // queuePoints[ queuePoints.length - 1 ].y -= 1;
          data.incrementCounter('queue', -1)
        }

        regex = /LogSquad: PostLogin: NewPlayer:/;
        res = regex.exec(line);
        if (res) {
          data.incrementCounter('players', 1);
        }

        regex = /^\[([0-9.:-]+)]\[([ 0-9]*)]LogNet: UChannel::Close: Sending CloseBunch\. ChIndex == [0-9]+\. Name: \[UChannel\] ChIndex: [0-9]+, Closing: [0-9]+ \[UNetConnection\] RemoteAddr: (.+):[0-9]+, Name: (Steam|EOSIp)NetConnection_[0-9]+, Driver: GameNetDriver (Steam|EOS)NetDriver_[0-9]+, IsServer: YES, PC: ([^ ]+PlayerController_C_[0-9]+), Owner: [^ ]+PlayerController_C_[0-9]+/
        res = regex.exec(line);
        if (res) {
          data.incrementCounter('players', -1);
          disconnectionTimesByPlayerController[res[6]] = getDateTime(res[1])
        }

        regex = /\[(.+)\].+LogSquad: OnPreLoadMap: Loading map .+\/([^\/]+)$/;
        res = regex.exec(line);
        if (res) {
          const timePoint = getDateTime(res[1]);
          data.setNewCounterValue('layers', 150, res[2], timePoint)
        }

        regex = /\[(.+)\]\[\d+].*LogWorld: SeamlessTravel to: .+\/([^\/]+)$/;
        res = regex.exec(line);
        if (res) {
          data.setNewCounterValue('layers', 150, res[2])
        }

        regex = /Frag_C.*DamageInstigator=([^ ]+PlayerController_C_\d+) /;
        res = regex.exec(line);
        if (res) {
          data.incrementFrequencyCounter('frags', 1)

          const playerController = res[1];
          if (!explosionCountersPerController[playerController]) explosionCountersPerController[playerController] = 0;
          explosionCountersPerController[playerController]++;
        }

        regex = /ServerMove\: TimeStamp expired.+Character: (.+)/;
        res = regex.exec(line);
        if (res) {
          data.incrementFrequencyCounter('serverMove', 0.05)

          const playerName = pawnsToPlayerNames[res[1]];
          const playerController = playerNameToPlayerController[playerName]
          if (!serverMoveTimestampExpiredPerPawn[playerController]) serverMoveTimestampExpiredPerPawn[playerController] = 0;
          serverMoveTimestampExpiredPerPawn[playerController]++;
        }

        regex = /Warning: UNetConnection::Tick/;
        res = regex.exec(line);
        if (res) {
          data.incrementFrequencyCounter('unetConnectionTick', 1)
        }

        regex = /SetReplicates called on non-initialized actor/;
        res = regex.exec(line);
        if (res) {
          data.incrementFrequencyCounter('nonInitializedActor', 1)
        }

        regex = /RotorWashEffectListener/;
        res = regex.exec(line);
        if (res) {
          data.incrementFrequencyCounter('rotorWashEffectListener', 1)
        }

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

        regex = /\[.+\]\[ ?(\d+)\]LogSquad: Player (.+) has been added to Team/;
        res = regex.exec(line);
        if (res) {
          // data.incrementCounter('players', 1);
          playerNameToPlayerController[res[2]] = chainIdToPlayerController[res[1]];
          playerControllerToPlayerName[chainIdToPlayerController[res[1]]] = res[2];
        }
        regex = /\[(.+)\]\[ ?(\d+)\]LogNet: Join succeeded: (.+)/;
        res = regex.exec(line);
        if (res) {
          delete chainIdToPlayerController[res[2]];
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
            else
              playerControllerHistory.push(playerController)
          }
        }

        regex = /Die\(\): Player:.+from (.+) caused by (.+)/;
        res = regex.exec(line);
        if (res) {
          data.incrementFrequencyCounter('playerDeaths', 0.1)
          let playerController = res[1]
          if (!playerController || playerController == 'nullptr') {
            playerController = playerNameToPlayerController[pawnsToPlayerNames[res[2]]]
          }
          if (!killsPerPlayerController[playerController]) killsPerPlayerController[playerController] = 0;
          killsPerPlayerController[playerController]++;
        }
      })


      // Cheater Report
      rl.on("close", () => {
        let contentBuilding = [];

        contentBuilding.push({
          row: `### ${serverName} SUSPECTED CHEATER REPORT: ${fileNameNoExt} ###`
        })
        this.verbose(1, `\x1b[1m\x1b[34m### ${serverName} CHEATING REPORT: \x1b[32m${fileNameNoExt}\x1b[34m ###\x1b[0m`)
        const cheaters = {
          Explosions: explosionCountersPerController,
          ServerMoveTimeStampExpired: serverMoveTimestampExpiredPerPawn,
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
            case 'Kills':
              minCount = this.options.killsThreshold;
              break;
          }

          contentBuilding.push({
            row: `# == ${cK.toUpperCase()}`
          })

          this.verbose(1, `\x1b[1m\x1b[34m#\x1b[0m == \x1b[1m\x1b[31m${cK.toUpperCase()}\x1b[0m`)
          for (let playerId in cheaters[cK])
            if (cheaters[cK][playerId] > minCount && minCount != 0) {
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
              let stringifiedDisconnectionTime = disconnectionTimesByPlayerController[playerController].toLocaleString()

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
        }
      })

      rl.on('error', (err) => {
        reject(err);
      });
    });
  }
}

function getDateTime(date) {
  const parts = date.replace(/:\d+$/, '').replace(/-/, 'T').split('T');
  parts[0] = parts[0].replace(/\./g, '-')
  parts[1] = parts[1].replace(/\./g, ':')
  const res = `${parts.join('T')}Z`;
  return new Date(res)
}