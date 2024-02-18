# Cheater report generator for SquadJS based on [JetDave's Code](https://github.com/fantinodavide/Squad-Log-To-Graph)
<div align="center">

[![GitHub Release](https://img.shields.io/github/release/IgnisAlienus/SquadJS-Cheater-Detection.svg?style=flat-square)](https://github.com/IgnisAlienus/SquadJS-Cheater-Detection/releases)
[![GitHub Contributors](https://img.shields.io/github/contributors/IgnisAlienus/SquadJS-Cheater-Detection.svg?style=flat-square)](https://github.com/IgnisAlienus/SquadJS-Cheater-Detection/graphs/contributors)
[![GitHub Release](https://img.shields.io/github/license/IgnisAlienus/SquadJS-Cheater-Detection.svg?style=flat-square)](https://github.com/IgnisAlienus/SquadJS-Cheater-Detection/blob/master/LICENSE)

<br>

[![GitHub Issues](https://img.shields.io/github/issues/IgnisAlienus/SquadJS-Cheater-Detection.svg?style=flat-square)](https://github.com/IgnisAlienus/SquadJS-Cheater-Detection/issues)
[![GitHub Pull Requests](https://img.shields.io/github/issues-pr-raw/IgnisAlienus/SquadJS-Cheater-Detection.svg?style=flat-square)](https://github.com/IgnisAlienus/SquadJS-Cheater-Detection/pulls)
[![GitHub Stars](https://img.shields.io/github/stars/IgnisAlienus/SquadJS-Cheater-Detection.svg?style=flat-square)](https://github.com/IgnisAlienus/SquadJS-Cheater-Detection/stargazers)
[![Discord](https://img.shields.io/discord/1174357658971668551.svg?style=flat-square&logo=discord)](https://discord.gg/onlybans)

<br><br>
</div>

# JUST BECAUSE THIS PLUGIN FINDS A SUSPECTED CHEATER DOES NOT GUARANTEE THAT THEY ARE A CHEATER!
- Please do your best to verify with in-game recordings of the Identified Suspected Cheaters. If you ever have any questions, please come to the [Guardian Discord](https://discord.gg/example).

## Installation
- Add the bits to your SquadJS
    - Add lines from `config.json` to your `config.json`
    - Drop `discord-cheaters.js` in `./squad-server/plugins`
    - Drop `analyzer.js` in `./squad-server/utils`
    - Drop `data-store.js` in `./squad-server/utils`
- Customize your `config.json` Settings.
    - `pingGroups` - Leave it as `[]` if you don't want to ping Admins if Suspected Cheaters are found.
        - If you do wish to ping admins, use as many, or as little, Role IDs as you wish: `"pingGroups":  ["723400310667870230", "550182386219089921"],`
        - Only Pings on `enableFullLog`, not on `enableEmbed`.
    - `enableFullLog` - This will make a Full Log Output of results like this [Example Image](https://github.com/IgnisAlienus/SquadJS-Cheater-Detection/blob/master/example-console-output.png).
    - `enableEmbed` - This will post an Embed for each Suspected Cheater with the results.
    - `color` - The color of the Embed.
    - `channelID` - Channel that the Full Log and/or Embed will be posted to.
    - `warnInGameAdmins` - Warns in-game admins when Suspected Cheaters are Detected.
        - Requires you to have `adminLists` configured at the top of your SquadJS `config.json` file.
    - `interval` - The interval to check for Cheaters.
        - I recommend setting your Interval to at least 5 Minutes (300000 milliseconds) apart. There is a small spike on the CPU and Memory at each Interval.
    - Detection Methods
        - You can disable any of the Detection Methods by setting the Value to `0`
        - The default `config.json` in this Repository has Recommended Thresholds. These are subject to change.
            - `explosionThreshold` - Tracks explosions such as frags, C4, HATs, LATs, etc.
            - `serverMoveTimeStampExpiredThreshold` - Cheaters, and laggy players, trigger this log line.
            - `knifeWoundsThreshold` - Detects the Total Amount of Knife Kills in a Player's Session.
            - `fobHitsThreshold` - Detects Explosive Damage ONLY, NOT shovels.
            - `liveThreshold` - Player Count that your Server goes Live.
            - `seedingMinThreshold` - Minimum Player Count you require to consider that Seeding has Started.
                - `1` is the minimum Value this should be set to. NOT `0`.

## What it do?
- At a configurable interval, this plugin will read your `SquadGame.log` for Suspected Cheaters.
- It checks configurable values such as `Explosions`, `ServerMoveTimeStampExpired`, `ClientNetSpeed`, `Kills`, and `FOBHits`.
- If any Suspected Cheaters are found, it pushes it to a configurable Discord Channel.

## Detection Methods and the Possible False Positives
For More info on what each line means in the Output, please visit: https://www.guardianonlybans.com/logcheck-info
- `Explosions`: it's possible for someone to be a false positive on explosions particularly if they're driving around an armor piece such as a BTR spamming HE.
- `ServerMoveTimeStampExpired`: it's possible for someone to be a false positive on this if they lag a lot or have high ping.
- `ClientNetSpeed`: Unknown if tied to Cheaters yet. Set Threshold to `0` to Disable.
- `KnifeWounds`: Detects the Total Amount of Knife Kills in a Player's Session, Connect to Disconnect, not per Match. Set Threshold to `0` to Disable.
- `FOBHits`: Damage to a FOB Radio. Restricted to only what is logged currently in the logs.

## What in the world is `ServerMoveTimeStampExpired`???
- The best explanation I can find is from `{ASG} Skillet` in OWI Hosting Discord.
> Cheats exploit a weakness with how the server uses timestamps to determine how much time difference there is between the client and the server. So far whenever there's a cheat (for remote action) the player cheating creates log lines like `[2023.05.11-04.25.07:162][532]LogNetPlayerMovement: Warning: ServerMove: TimeStamp expired: 239.967377, CurrentTimeStamp: 1.065638, Character: BP_Soldier_MIL_Grenadier_C_2147143984`, where if the CurrentTimeStamp is less than the TimeStamp expired then you most likely have a cheater, problem is that these lines are also generated when someone lags a lot, however their timestamp times don't violate the rule stated previously. There is an edge case however where the timestamps circulate back (i think from 255 back to 0), at this point you can have someone not be a cheater but trip the rule, to remedy this you just ignore it if the current timestamp is a small value (say less than 2). When someone cheats using this method they generate a lot of these warnings in the log, you just need to catch one though. You can relate the Character: field to a players character name, this can then let you find their SteamID and username.

## What in the world is `ClientNetSpeed`???
- `ClientNetSpeed` has been disabled as it's not ready yet.
- Explaination from `-✘- Vohk` in Squad Guardian Discord.
> Unreal engine parameter that sets the max bandwidth to the client. Too low and you get a lot of desync; too high and it murders TPS. The server setting is supposed to be authoritative but there seems to be some inconsistency. Unclear if it's exploiting, people just setting ini parameters, or just the game making more spaghetti
I don't think there is anything firm tying it to cheating. I think the thought process was it might be worth tracking, but probably not something that needs to be flagged for admins in the moment.

## Example Discord Output
![Example](https://raw.githubusercontent.com/IgnisAlienus/SquadJS-Cheater-Detection/master/example-discord-output.png)

## Example Discord Embed Output
![Exampe](https://raw.githubusercontent.com/IgnisAlienus/SquadJS-Cheater-Detection/master/example-embed-output.png)

## Example Console Output
![Example](https://raw.githubusercontent.com/IgnisAlienus/SquadJS-Cheater-Detection/master/example-console-output.png)

## Example AdminWarn
![Example](https://raw.githubusercontent.com/IgnisAlienus/SquadJS-Cheater-Detection/master/example-adminwarn.png)

## Known Issues
- It's possible that if you set your Detection Thresholds too low that the output text will be longer than 4,000 Characters which will cause an API error with Discord since that will make the message too large to send.