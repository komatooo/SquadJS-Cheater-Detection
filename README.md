# Cheater report generator for SquadJS based on JetDave's Code

# What it do?
- At a configurable interval, this plugin will read your `SquadGame.log` for Suspected Cheaters.
- It checks configurable values such as `Explosions`, `ServerMoveTimeStampExpired`, and `Kills`.
- If any Suspected Cheaters are found, it pushes it to a configurable Discord Channel.

# Known Issues
- It will send the same found Suspected Cheaters at each interval until the Server is restarted. This is due to reading the entire `SquadGame.log` every interval and not storing any results in any form of database. The plus of this is that you can see if any values increase at each interval for the found Supsected Cheaters.

## Installation
- Add the bits to your SquadJS
- You may have to run `npm install` in your SquadJS's directory after adding the files.