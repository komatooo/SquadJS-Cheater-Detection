# Cheater report generator for SquadJS based on [JetDave's Code](https://github.com/fantinodavide/Squad-Log-To-Graph)
<div align="center">

[![GitHub Release](https://img.shields.io/github/release/Team-Silver-Sphere/SquadJS.svg?style=flat-square)](https://github.com/Team-Silver-Sphere/SquadJS/releases)
[![GitHub Contributors](https://img.shields.io/github/contributors/Team-Silver-Sphere/SquadJS.svg?style=flat-square)](https://github.com/Team-Silver-Sphere/SquadJS/graphs/contributors)
[![GitHub Release](https://img.shields.io/github/license/Team-Silver-Sphere/SquadJS.svg?style=flat-square)](https://github.com/Team-Silver-Sphere/SquadJS/blob/master/LICENSE)

<br>

[![GitHub Issues](https://img.shields.io/github/issues/Team-Silver-Sphere/SquadJS.svg?style=flat-square)](https://github.com/Team-Silver-Sphere/SquadJS/issues)
[![GitHub Pull Requests](https://img.shields.io/github/issues-pr-raw/Team-Silver-Sphere/SquadJS.svg?style=flat-square)](https://github.com/Team-Silver-Sphere/SquadJS/pulls)
[![GitHub Stars](https://img.shields.io/github/stars/Team-Silver-Sphere/SquadJS.svg?style=flat-square)](https://github.com/Team-Silver-Sphere/SquadJS/stargazers)
[![Discord](https://img.shields.io/discord/266210223406972928.svg?style=flat-square&logo=discord)](https://discord.gg/onlybans)

<br><br>
</div>

# THIS PLUGIN IS VERY MUCH IN A BETA STATE
- It does what I intended it to do but has some very much needed Quality of Life updates.

## Installation
- Add the bits to your SquadJS
- If you want to setup Role Pinging use `"pingGroups":  ["723400310667870230", "550182386219089921"],` with your RoleID(s) in place of the example IDs.
- Set if you want to warn in game admins when a Detection was posted to your Discord.
- The Config has the current recommended Thresholds. You are welcome to tweak them as needed.
- Set the Threshold to `0` to Disable one of the Detections.
- I recommend setting your Interval to at least 5 Minutes (300000 milliseconds) apart. There is a small spike on the CPU and Memory at each Interval.
- `liveThreshold` is the Player Count you go Live at.
- `seedMinThreshold` is the Minimum Player Count to be considering in "Seeding".

## What it do?
- At a configurable interval, this plugin will read your `SquadGame.log` for Suspected Cheaters.
- It checks configurable values such as `Explosions`, `ServerMoveTimeStampExpired`, `ClientNetSpeed`, `Kills`, and `FOBHits`.
- If any Suspected Cheaters are found, it pushes it to a configurable Discord Channel.

## Detection Methods and the Possible False Positives
- `Explosions`: it's possible for someone to be a false positive on explosions particularly if they're driving around an armor piece such as a BTR spamming HE.
- `ServerMoveTimeStampExpired`: it's possible for someone to be a false positive on this if they lag a lot or have high ping.
- `ClientNetSpeed`: Unknown if tied to Cheaters yet. Set Threshold to `0` to Disable.
- `Kills`: this one it's obviously possible for false positives on good players.
- `FOBHits`: damage to a FOB Radio. Restricted to only what is logged currently in the logs.

## What in the world is `ServerMoveTimeStampExpired`???
- The best explanation I can find is from `{ASG} Skillet` in OWI Hosting Discord.
> Cheats exploit a weakness with how the server uses timestamps to determine how much time difference there is between the client and the server. So far whenever there's a cheat (for remote action) the player cheating creates log lines like `[2023.05.11-04.25.07:162][532]LogNetPlayerMovement: Warning: ServerMove: TimeStamp expired: 239.967377, CurrentTimeStamp: 1.065638, Character: BP_Soldier_MIL_Grenadier_C_2147143984`, where if the CurrentTimeStamp is less than the TimeStamp expired then you most likely have a cheater, problem is that these lines are also generated when someone lags a lot, however their timestamp times don't violate the rule stated previously. There is an edge case however where the timestamps circulate back (i think from 255 back to 0), at this point you can have someone not be a cheater but trip the rule, to remedy this you just ignore it if the current timestamp is a small value (say less than 2). When someone cheats using this method they generate a lot of these warnings in the log, you just need to catch one though. You can relate the Character: field to a players character name, this can then let you find their SteamID and username.

## What in the world is `ClientNetSpeed`???
- Explaination from `-✘- Vohk` in Squad Guardian Discord.
> Unreal engine parameter that sets the max bandwidth to the client. Too low and you get a lot of desync; too high and it murders TPS. The server setting is supposed to be authoritative but there seems to be some inconsistency. Unclear if it's exploiting, people just setting ini parameters, or just the game making more spaghetti
I don't think there is anything firm tying it to cheating. I think the thought process was it might be worth tracking, but probably not something that needs to be flagged for admins in the moment.

## Example Discord Output
![Example](https://raw.githubusercontent.com/IgnisAlienus/SquadJS-Cheater-Detection/master/example-discord-output.png)

## Example Console Output
![Example](https://raw.githubusercontent.com/IgnisAlienus/SquadJS-Cheater-Detection/master/example-console-output.png)

## Example AdminWarn
![Example](https://raw.githubusercontent.com/IgnisAlienus/SquadJS-Cheater-Detection/master/example-adminwarn.png)

## Known Issues
- It's possible that if you set your Detection Thresholds too low that the output text will be longer than 4,000 Characters which will cause an API error with Discord since that will make the message too large to send.