const { SlashCommandBuilder } = require('@discordjs/builders');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const { clientId, token } = require('./config.json');

const commands = [
	// Add all commands here. Empty to clear.
	new SlashCommandBuilder().setName('youtube')
	.setDescription('Play any youtube video')
	.addStringOption(option =>
		option.setName('input')
			.setDescription('The link to the youtube video')
			.setRequired(true)),

	new SlashCommandBuilder().setName('play')
	.setDescription('Play any youtube video or resume audio')
	.addStringOption(option =>
		option.setName('input')
			.setDescription('The link to the youtube video')
			.setRequired(true)),

	new SlashCommandBuilder().setName('playnext')
	.setDescription('Inserts video to beginning of queue')
	.addStringOption(option =>
		option.setName('input')
			.setDescription('The link to the youtube video')
			.setRequired(true)),

	new SlashCommandBuilder().setName('pause')
	.setDescription('Pause audio'),

	new SlashCommandBuilder().setName('unpause')
	.setDescription('Unpause audio'),

	new SlashCommandBuilder().setName('stop')
	.setDescription('Stop player and delete queue'),

	new SlashCommandBuilder().setName('nowplaying')
	.setDescription('Displays the currently playing video'),

	new SlashCommandBuilder().setName('skip')
	.setDescription('Skip to next video'),

	new SlashCommandBuilder().setName('next')
	.setDescription('Skip to next video'),

	new SlashCommandBuilder().setName('queue')
	.setDescription('Shows the queue of videos left'),

	new SlashCommandBuilder().setName('leave')
	.setDescription('Makes the bot leave'),

	new SlashCommandBuilder().setName('lucky')
	.setDescription('I\'m feeling lucky! Plays the first video found.')
	.addStringOption(option =>
		option.setName('input')
			.setDescription('The video you want to search')
			.setRequired(true)),

	new SlashCommandBuilder().setName('swap')
	.setDescription('Swap 2 videos on the queue')
	.addStringOption(option =>
		option.setName('index1')
			.setDescription('The index position of the 1st video')
			.setRequired(true)
		)
	.addStringOption(option =>
		option.setName('index2')
			.setDescription('The index position of the 2nd video')
			.setRequired(true)
		),
]
	.map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(token);

// console.log(clientId)
// console.log(guildId)
// console.log(token)

// Remember to set the application.commands scope

rest.put(Routes.applicationCommands(clientId), { body: commands })
	.then(() => console.log('Successfully registered application commands.'))
	.catch(console.error);
