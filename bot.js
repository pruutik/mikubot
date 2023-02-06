// Require the necessary discord.js classes
const { Client, Intents, MessageEmbed } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, NoSubscriberBehavior, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
// const { token } = require('./config.json');
const ytdl = require('ytdl-core');
const fs = require('fs');
const yts = require('yt-search');

// Create a new client instance
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_VOICE_STATES] });

//TODO: make visual queue system with buttons that let you get info for tracks
//TODO: add playlist support
//TODO: add spotify support
//TODO: make query system with buttons
//TODO: make seek system
//TODO: make volume controller
//TODO: make remove and swap nicer(?)
//TODO: redo queue, player system to allow multiple server usage. Maybe add ability to listen across servers?
var queue = [];
var connection;
var starttime;
var nowplaying = null;

const player = createAudioPlayer({
	behaviors: {
		noSubscriber: NoSubscriberBehavior.Pause,
	},
});

function truncate( str, n, chopChar = ' '){
    if (str.length <= n) { return str; }
    var subString = str.substr(0, n-1); // the original check
    do{
        subString = subString.substr(0, subString.lastIndexOf(chopChar))
    }while(subString[subString.lastIndexOf(chopChar) + 1] === chopChar);
    return subString + "..."
};

function nextQueue(force = false){
    if((queue.length !== 0 && player.state.status !== 'playing') || force){
        nowplaying = queue.shift();
        const resource = createAudioResource("./downloaded/" + nowplaying.videoDetails.videoId + '.webm');
        player.play(resource);
        starttime = Date.now();
        client.user.setActivity({name: nowplaying.videoDetails.title, type: 'PLAYING', url: nowplaying.videoDetails.video_url})
    }
    else if(queue.length === 0){
        nowplaying = null;
        client.user.setActivity();
        if(connection){
            setTimeout(() => {
                if(player.state.status === 'idle'){
                    if(connection){
                        connection.destroy();
                        connection = null;
		    };
                }
            },180_000);
        }
    }
}

function joinChannel(channel){
    connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
    });
    connection.subscribe(player);
}

function secondToNiceMinutes(seconds){
    if(Math.floor(seconds / 3600) > 0){
        return Math.floor(seconds / 3600).toString() + ':' + Math.floor((seconds % 3600) / 60).toString().padStart(2,'0') + ':' + (seconds % 60).toString().padStart(2,'0');
    }
    return Math.floor(seconds / 60).toString() + ':' + (seconds % 60).toString().padStart(2,'0');
}

player.on(AudioPlayerStatus.Playing, () => {
	console.log('The audio player has started playing!');
});

player.on(AudioPlayerStatus.Idle, () => {
    console.log('The audio player is idle!');
    nextQueue();
});

player.on(AudioPlayerStatus.Paused, () => {
    setTimeout(() => {
        if(player.state.status === 'paused'){
            if(connection){
                connection.destroy();
                connection = null;
	    }
        }
    },600_000);
});

// When the client is ready, run this code (only once)
client.once('ready', () => {
    if (!fs.existsSync('./downloaded/')){
        fs.mkdirSync('./downloaded/');
    }
	console.log('The World is Mine!');
});

client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;

    // console.log(player.state.status === 'idle');

	if (interaction.commandName === 'youtube' || interaction.commandName === 'play' || interaction.commandName === 'unpause' || interaction.commandName === 'lucky' || interaction.commandName === 'playnext' ) {
        const input = interaction.options.getString('input');
        const channel = interaction.member.voice.channel;

        if(!input){
            switch(player.state.status) {
                case 'paused':
                    if(channel){
                        joinChannel(channel);
                    }
                    else if(!client.voice.channel){
                        try{await interaction.reply({content: 'I\'m not in any channel', ephemeral: true});}catch{console.log('Couldn\'t send message')};
                        return;
                    }
                    player.unpause();
                    try{await interaction.reply('Resuming...');}catch{console.log('Couldn\'t send message')};
                    break;
                case 'autopaused':
                    if(!channel){
                        try{await interaction.reply({content: 'You\'re not in any channel!', ephemeral: true});}catch{console.log('Couldn\'t send message')};
                    }else{
                        joinChannel(channel);
                        try{await interaction.reply('Resuming...');}catch{console.log('Couldn\'t send message')};
                    }
                    break;
                case 'idle':
                    try{await interaction.reply({content: 'Not playing anything!', ephemeral: true});}catch{console.log('Couldn\'t send message')};
                    break;
                case 'playing':
                    try{await interaction.reply({content: 'Already playing!', ephemeral: true});}catch{console.log('Couldn\'t send message')};
                    break;
            } 
            return;
        }

        if(player.state.status === 'paused' || player.state.status === 'autopaused'){
            player.stop();
            interaction.commandName = 'playnext';
        }

        if(!channel){
            try{await interaction.reply({content: 'You\'re not in any channel!', ephemeral: true});}catch{console.log('Couldn\'t send message')};
            return;
        }

        if(!ytdl.validateURL(input) && interaction.commandName !== 'lucky'){
            try{await interaction.reply({content: 'Please enter a valid youtube URL.', ephemeral: true});}catch{console.log('Couldn\'t send message')};
            return;
        }

        var stateEmbed = new MessageEmbed()
            .setColor('#00ffff')
            .setAuthor({ name: 'The World is Mine!', iconURL: client.user.displayAvatarURL()})
            .setTitle('Getting info...')
            .setDescription('Query: ' + input)
            .setTimestamp()
            .setFooter({ text: 'Queued by: ' + interaction.member.user.username, iconURL: interaction.member.user.displayAvatarURL()});
        try{await interaction.reply({embeds: [stateEmbed]});}catch{console.log('Couldn\'t send message')};

        var link;
        if(!ytdl.validateURL(input)){
            const r = await yts(input);
            link = r.videos[0].url;
        }else{
            link = input;
        }

        stateEmbed.setDescription('Query: [' + input + '](' + link + ')');
        try{await interaction.editReply({embeds: [stateEmbed]});}catch{console.log('Couldn\'t edit message')};

        //Player code starts here
        const info = await ytdl.getInfo(link);

        var descriptionText = '';
        if(info.videoDetails.description){
            descriptionText += truncate(info.videoDetails.description, 400, '\n') + '\n\n';
        };
        descriptionText += info.videoDetails.uploadDate + ' \u2022 ' +
        info.videoDetails.viewCount + ' views \u2022 ' + 
        secondToNiceMinutes(info.videoDetails.lengthSeconds);

        const vidEmbed = new MessageEmbed()
            .setColor('#ff0000')
            .setTitle(info.videoDetails.title)
            .setURL(link)
            .setAuthor({ name: info.videoDetails.author.name, iconURL: info.videoDetails.author.thumbnails[0].url, url: info.videoDetails.author.channel_url})
            .setThumbnail(info.videoDetails.thumbnails[0].url)
            .setTimestamp()
            .setFooter({ text: 'Queued by: ' + interaction.member.user.username, iconURL: interaction.member.user.displayAvatarURL()})
            .setDescription(descriptionText);

        if(interaction.commandName === 'playnext'){
            queue.unshift(info)
        }else{
            queue.push(info);
        }

        if(channel !== client.voice.channel){
            joinChannel(channel);
        }

        setTimeout(() => nextQueue(),1000);

        if(!fs.existsSync("./downloaded/" + info.videoDetails.videoId + '.webm')){
            const video = ytdl.downloadFromInfo(info, { filter: 'audioonly', dlChunkSize: 0 });
            video.pipe(fs.createWriteStream("./downloaded/" + info.videoDetails.videoId + '.webm'));
            video.on('progress', async (chunkLength, downloaded, total) => {
                stateEmbed = new MessageEmbed()
                    .setColor('#00ffff')
                    .setDescription(`Downloading: (${(downloaded / 1024).toFixed(2)}KB of ${(total / 1024).toFixed(2)}KB)`);
                try{await interaction.editReply({embeds: [vidEmbed, stateEmbed]});}catch{console.log('Couldn\'t edit message')};
            });
            video.on('end', async () => {
                stateEmbed = new MessageEmbed()
                    .setColor('#00ffff')
                    .setDescription('Done!');
                try{await interaction.editReply({embeds: [vidEmbed, stateEmbed]});}catch{console.log('Couldn\'t edit message')};
                setTimeout(() => {try{interaction.editReply({embeds: [vidEmbed]});}catch{console.log('Couldn\'t edit message')};}, 3_000);
            });
        }
        else{
            stateEmbed = new MessageEmbed()
                .setColor('#00ffff')
                .setDescription('Already downloaded!');
            try{await interaction.editReply({embeds: [vidEmbed, stateEmbed]});}catch{console.log('Couldn\'t edit message')};
            setTimeout(() => {try{interaction.editReply({embeds: [vidEmbed]})}catch{console.log('Couldn\'t edit message')};}, 3_000);
        }
	}
    else if(interaction.commandName === 'pause'){
        if(player.state.status !== 'playing'){
            try{await interaction.reply({content: 'Not playing anything...', ephemeral: true});}catch{console.log('Couldn\'t send message')};
            return;
        }
        player.pause();
        try{await interaction.reply('Paused.');}catch{console.log('Couldn\'t send message')};
    }
    else if(interaction.commandName === 'stop'){
        if(player.state.status === 'idle'){
            try{await interaction.reply({content: 'Already idle...', ephemeral: true});}catch{console.log('Couldn\'t send message')};
            return;
        }
        queue = [];
        player.stop();
        try{await interaction.reply('Stopped.');}catch{console.log('Couldn\'t send message')};
    }
    else if(interaction.commandName === 'next' || interaction.commandName === 'skip' ){
        if(player.state.status === 'idle'){
            try{await interaction.reply({content: 'Already idle...', ephemeral: true});}catch{console.log('Couldn\'t send message')};
            return;
        }
        player.stop();
        try{await interaction.reply('Skipped!');}catch{console.log('Couldn\'t send message')};
    }
    else if(interaction.commandName === 'nowplaying'){
        if(nowplaying){
            var descriptionText = '';
            if(nowplaying.videoDetails.description){
                descriptionText += truncate(nowplaying.videoDetails.description, 4096) + '\n\n';
            };
            descriptionText += nowplaying.videoDetails.uploadDate + ' \u2022 ' +
            nowplaying.videoDetails.viewCount + ' views \u2022 ' + 
            secondToNiceMinutes(Math.floor((Date.now() - starttime) / 1000)) + '/' + secondToNiceMinutes(nowplaying.videoDetails.lengthSeconds);

            const vidEmbed = new MessageEmbed()
                .setColor('#ff0000')
                .setTitle(nowplaying.videoDetails.title)
                .setURL(nowplaying.videoDetails.video_url)
                .setAuthor({ name: nowplaying.videoDetails.author.name, iconURL: nowplaying.videoDetails.author.thumbnails[0].url, url: nowplaying.videoDetails.author.channel_url})
                .setThumbnail(nowplaying.videoDetails.thumbnails[0].url)
                .setDescription(descriptionText);
            try{await interaction.reply({embeds: [vidEmbed], ephemeral: true});}catch{console.log('Couldn\'t send message')};
        }
        else{
            try{await interaction.reply({content: 'Not playing anything...', ephemeral: true});}catch{console.log('Couldn\'t send message')};
        }
    }
    else if(interaction.commandName === 'queue'){
        if(!nowplaying){
            try{await interaction.reply({content: 'Not playing anything...', ephemeral: true});}catch{console.log('Couldn\'t send message')};
            return;
        }
        var string = '';
        queue.forEach(function (queue, idx, array){
            string += (idx + 1).toString() + '. [' + queue.videoDetails.title + '](' + queue.videoDetails.video_url + ') \u2022 ' + secondToNiceMinutes(queue.videoDetails.lengthSeconds);
            if (idx !== array.length - 1){
                string += '\n';
            }
        });
        const queueEmbed = new MessageEmbed()
            .setColor('#00ffff')
            .setAuthor({name: 'The World is Mine!' ,iconURL: client.user.displayAvatarURL()})
            .setTitle('Queue: ')
            .addField('Now playing: ', '[' + nowplaying.videoDetails.title + '](' + nowplaying.videoDetails.video_url + ') \u2022 ' + secondToNiceMinutes(nowplaying.videoDetails.lengthSeconds));
        if(string){
            queueEmbed.addField('Up next: ', string);
        }
        try{await interaction.reply({embeds: [queueEmbed]});}catch{console.log('Couldn\'t send message')};
    }
    else if(interaction.commandName === 'leave'){
        if(connection){
            connection.destroy();
            connection = null;
        }
        try{await interaction.reply('Left the voice channel!');}catch{console.log('Couldn\'t send message')};
    }
    else if(interaction.commandName === 'swap'){
        const index1 = interaction.options.getString('index1');
        const index2 = interaction.options.getString('index2');
        if(index1 > queue.length || index2 > queue.length || index1 < 0 || index2 < 0){
            try{await interaction.reply({content: 'Invalid index positions.', ephemeral: true});}catch{console.log('Couldn\'t send message')};
            return;
        }
        const temp = queue[index1 - 1];
        queue[index1 - 1] = queue[index2 - 1];
        queue[index2 - 1] = temp;

        const swapEmbed = new MessageEmbed()
            .setColor('#00ffff')
            .setAuthor({name: 'The World is Mine!' ,iconURL: client.user.displayAvatarURL()})
            .setTitle('Shifted: ')
            .setDescription(index1 + '. [' + queue[index1].videoDetails.title + '](' + queue[index1].videoDetails.video_url + ') \u2022 ' + secondToNiceMinutes(queue[index1].videoDetails.lengthSeconds) + '\n' +
            index2 + '. [' + queue[index2].videoDetails.title + '](' + queue[index2].videoDetails.video_url + ') \u2022 ' + secondToNiceMinutes(queue[index2].videoDetails.lengthSeconds));
        try{await interaction.reply({embeds: [swapEmbed]});}catch{console.log('Couldn\'t send message')};
    }
    else if(interaction.commandName === 'remove'){
        const index = interaction.options.getString('index') - 1;
        if(index > queue.length || index < 0){
            try{await interaction.reply({content: 'Invalid index positions.', ephemeral: true});}catch{console.log('Couldn\'t send message')};
            return;
        }

        const removeEmbed = new MessageEmbed()
            .setColor('#00ffff')
            .setAuthor({name: 'The World is Mine!' ,iconURL: client.user.displayAvatarURL()})
            .setTitle('Removed: ')
            .setDescription((index + 1) + '. [' + queue[index].videoDetails.title + '](' + queue[index].videoDetails.video_url + ') \u2022 ' + secondToNiceMinutes(queue[index].videoDetails.lengthSeconds));
        
        queue.splice(index, 1);
        try{await interaction.reply({embeds: [removeEmbed]});}catch{console.log('Couldn\'t send message')};
    }
});

// Login to Discord with your client's token
client.login(process.env.token);
