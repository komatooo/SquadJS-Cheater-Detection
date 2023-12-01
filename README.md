# Cheater report generator for SquadJS based on JetDave's Code

# THIS PLUGIN IS VERY MUCH IN A BETA STATE
- It does what I intended it to do but has some very much needed Quality of Life updates.

## Installation
- Add the bits to your SquadJS
- Set the Threshold to `0` to Disable one of the Detections.
- I recommend setting your Interval to at least 5 Minutes (300000 milliseconds) apart. There is a small spike on the CPU and Memory at each Interval.

## What it do?
- At a configurable interval, this plugin will read your `SquadGame.log` for Suspected Cheaters.
- It checks configurable values such as `Explosions`, `ServerMoveTimeStampExpired`, and `Kills`.
- If any Suspected Cheaters are found, it pushes it to a configurable Discord Channel.

## Detection Methods and the Possible False Positives
- `Explosions:` it's possible for someone to be a false positive on explosions particularly if they're driving around an armor piece such as a BTR spamming HE.
- `ServerMoveTimeStampExpired:` it's possible for someone to be a false positive on this if they lag a lot or have high ping.
- `Kills:` this one is obviously possible to easily put out a false positive for the better players.

## What in the world is `ServerMoveTimeStampExpired`???
- The best explanation I can find is from `{ASG} Skillet` in OWI Hosting Discord
> Cheats exploit a weakness with how the server uses timestamps to determine how much time difference there is between the client and the server. So far whenever there's a cheat (for remote action) the player cheating creates log lines like `[2023.05.11-04.25.07:162][532]LogNetPlayerMovement: Warning: ServerMove: TimeStamp expired: 239.967377, CurrentTimeStamp: 1.065638, Character: BP_Soldier_MIL_Grenadier_C_2147143984`, where if the CurrentTimeStamp is less than the TimeStamp expired then you most likely have a cheater, problem is that these lines are also generated when someone lags a lot, however their timestamp times don't violate the rule stated previously. There is an edge case however where the timestamps circulate back (i think from 255 back to 0), at this point you can have someone not be a cheater but trip the rule, to remedy this you just ignore it if the current timestamp is a small value (say less than 2). When someone cheats using this method they generate a lot of these warnings in the log, you just need to catch one though. You can relate the Character: field to a players character name, this can then let you find their SteamID and username.

## Example Output
![Example](https://raw.githubusercontent.com/IgnisAlienus/SquadJS-Cheater-Detection/master/example-output.png)

## Known Issues
- It's possible that if you set your Detection Thresholds too low that the output text will be longer than 4,000 Characters which will cause an API error with Discord since that will make the message too large to send.